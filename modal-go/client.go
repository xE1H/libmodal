// Client construction, auth, timeout, and retry logic for Modal.
//
// Example:
//
//	ctx := context.Background()
//	conn, cli, err := modal.NewClient()
//	if err != nil { … }
//	defer conn.Close()
//
//	resp, err := cli.AppCreate(
//	    ctx,
//	    &proto.AppCreateRequest{…},
//	    modal.WithRetry(5),
//	    modal.WithTimeout(10*time.Second),
//	)
package modal

import (
	"context"
	"crypto/tls"
	"strconv"
	"time"

	"github.com/google/uuid"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	proto "github.com/modal-labs/libmodal/modal-go/proto/modal_proto"
)

// TimeoutCallOption carries a per-RPC absolute timeout.
type TimeoutCallOption struct {
	grpc.EmptyCallOption
	timeout time.Duration
}

// WithTimeout attaches a timeout to a single RPC.
func WithTimeout(d time.Duration) TimeoutCallOption {
	return TimeoutCallOption{timeout: d}
}

// RetryCallOption carries per-RPC retry overrides.
type RetryCallOption struct {
	grpc.EmptyCallOption
	retries         *int
	baseDelay       *time.Duration
	maxDelay        *time.Duration
	delayFactor     *float64
	additionalCodes []codes.Code
}

// WithRetry overrides just the retry *count* (other parameters keep defaults).
func WithRetry(n int) RetryCallOption { return RetryCallOption{retries: &n} }

const (
	apiEndpoint            = "api.modal.com:443"
	maxMessageSize         = 100 * 1024 * 1024 // 100 MB
	defaultRetryAttempts   = 3
	defaultRetryBaseDelay  = 100 * time.Millisecond
	defaultRetryMaxDelay   = 1 * time.Second
	defaultRetryBackoffMul = 2.0
)

var defaultRetryable = map[codes.Code]struct{}{
	codes.DeadlineExceeded: {},
	codes.Unavailable:      {},
	codes.Canceled:         {},
	codes.Internal:         {},
	codes.Unknown:          {},
}

// NewClient dials api.modal.com with auth/timeout/retry interceptors installed.
// It returns (conn, stub).  Close the conn when done.
func NewClient() (*grpc.ClientConn, proto.ModalClientClient, error) {
	conn, err := grpc.NewClient(
		apiEndpoint,
		grpc.WithTransportCredentials(credentials.NewTLS(&tls.Config{})),
		grpc.WithDefaultCallOptions(
			grpc.MaxCallRecvMsgSize(maxMessageSize),
			grpc.MaxCallSendMsgSize(maxMessageSize),
		),
		grpc.WithUnaryInterceptor(chainUnary(
			authInterceptor(defaultProfile),
			retryInterceptor(),
			timeoutInterceptor(),
		)),
	)
	if err != nil {
		return nil, nil, err
	}
	return conn, proto.NewModalClientClient(conn), nil
}

func chainUnary(incs ...grpc.UnaryClientInterceptor) grpc.UnaryClientInterceptor {
	return func(
		ctx context.Context,
		method string,
		req, reply any,
		cc *grpc.ClientConn,
		inv grpc.UnaryInvoker,
		opts ...grpc.CallOption,
	) error {
		h := inv
		for i := len(incs) - 1; i >= 0; i-- {
			next := h
			inc := incs[i]
			h = func(
				c context.Context,
				m string,
				r, rep any,
				conn *grpc.ClientConn,
				op ...grpc.CallOption,
			) error {
				return inc(c, m, r, rep, conn, next, op...)
			}
		}
		return h(ctx, method, req, reply, cc, opts...)
	}
}

func authInterceptor(p Profile) grpc.UnaryClientInterceptor {
	clientType := strconv.Itoa(int(proto.ClientType_CLIENT_TYPE_LIBMODAL))

	return func(
		ctx context.Context,
		method string,
		req, reply any,
		cc *grpc.ClientConn,
		inv grpc.UnaryInvoker,
		opts ...grpc.CallOption,
	) error {
		ctx = metadata.AppendToOutgoingContext(
			ctx,
			"x-modal-client-type", clientType,
			"x-modal-client-version", "424242",
			"x-modal-token-id", p.TokenID,
			"x-modal-token-secret", p.TokenSecret,
		)
		return inv(ctx, method, req, reply, cc, opts...)
	}
}

func timeoutInterceptor() grpc.UnaryClientInterceptor {
	return func(
		ctx context.Context,
		method string,
		req, reply any,
		cc *grpc.ClientConn,
		inv grpc.UnaryInvoker,
		opts ...grpc.CallOption,
	) error {
		// pick the first TimeoutCallOption, if any
		for _, o := range opts {
			if to, ok := o.(TimeoutCallOption); ok && to.timeout > 0 {
				// honour an existing, *earlier* deadline if present
				if deadline, ok := ctx.Deadline(); ok && time.Until(deadline) <= to.timeout {
					break
				}
				var cancel context.CancelFunc
				ctx, cancel = context.WithTimeout(ctx, to.timeout)
				defer cancel()
				break
			}
		}
		return inv(ctx, method, req, reply, cc, opts...)
	}
}

func retryInterceptor() grpc.UnaryClientInterceptor {
	return func(
		ctx context.Context,
		method string,
		req, reply any,
		cc *grpc.ClientConn,
		inv grpc.UnaryInvoker,
		opts ...grpc.CallOption,
	) error {
		// start with package defaults
		retries := defaultRetryAttempts
		baseDelay := defaultRetryBaseDelay
		maxDelay := defaultRetryMaxDelay
		factor := defaultRetryBackoffMul
		retryable := defaultRetryable

		// override from call-options (first one wins)
		for _, o := range opts {
			if rc, ok := o.(RetryCallOption); ok {
				if rc.retries != nil {
					retries = *rc.retries
				}
				if rc.baseDelay != nil {
					baseDelay = *rc.baseDelay
				}
				if rc.maxDelay != nil {
					maxDelay = *rc.maxDelay
				}
				if rc.delayFactor != nil {
					factor = *rc.delayFactor
				}
				if len(rc.additionalCodes) > 0 {
					retryable = map[codes.Code]struct{}{}
					for k := range defaultRetryable {
						retryable[k] = struct{}{}
					}
					for _, c := range rc.additionalCodes {
						retryable[c] = struct{}{}
					}
				}
				break
			}
		}

		idempotency := uuid.NewString()
		start := time.Now()
		delay := baseDelay

		for attempt := 0; attempt <= retries; attempt++ {
			aCtx := metadata.AppendToOutgoingContext(
				ctx,
				"x-idempotency-key", idempotency,
				"x-retry-attempt", strconv.Itoa(attempt),
				"x-retry-delay", strconv.FormatFloat(time.Since(start).Seconds(), 'f', 3, 64),
			)

			err := inv(aCtx, method, req, reply, cc, opts...)
			if err == nil {
				return nil
			}

			if st, ok := status.FromError(err); ok { // gRPC error
				if _, ok := retryable[st.Code()]; !ok || attempt == retries {
					return err
				}
			} else { // Unexpected, non-gRPC error
				return err
			}

			if sleepCtx(ctx, delay) != nil {
				return err // ctx cancelled or deadline exceeded
			}

			// exponential back-off
			delay = min(delay*time.Duration(factor), maxDelay)
		}
		return nil // unreachable
	}
}

func sleepCtx(ctx context.Context, d time.Duration) error {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-t.C:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
