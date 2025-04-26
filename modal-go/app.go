package modal

import (
	"context"

	proto "github.com/modal-labs/libmodal/modal-go/proto/modal_proto"
)

// App references a deployed Modal App.
type App struct {
	AppID string
}

// LookupOptions are options for finding deployed Modal objects.
type LookupOptions struct {
	Environment     string
	CreateIfMissing bool
}

// AppLookup looks up an existing App, or creates an empty one.
func AppLookup(ctx context.Context, name string, options LookupOptions) (*App, error) {
	creationType := proto.ObjectCreationType_OBJECT_CREATION_TYPE_UNSPECIFIED
	if options.CreateIfMissing {
		creationType = proto.ObjectCreationType_OBJECT_CREATION_TYPE_CREATE_IF_MISSING
	}

	resp, err := client.AppGetOrCreate(ctx, proto.AppGetOrCreateRequest_builder{
		AppName:            name,
		EnvironmentName:    options.Environment,
		ObjectCreationType: creationType,
	}.Build())

	if err != nil {
		return nil, err
	}

	return &App{AppID: resp.GetAppId()}, nil
}
