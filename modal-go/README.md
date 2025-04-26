# modal-go development

Clone this repository. You should be all set to run an example.

```bash
go run ./examples/sandbox
```

Whenever you need a new version of the protobufs, you can regenerate them:

```bash
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
scripts/gen-proto.sh
```

We check the generated into Git so that the package can be installed with `go get`.
