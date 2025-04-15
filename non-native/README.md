# non-native

Setup after cloning the repo:

```bash
npm install

./node_modules/.bin/grpc_tools_node_protoc \
  --plugin=protoc-gen-ts_proto=./node_modules/.bin/protoc-gen-ts_proto \
  --ts_proto_out=./proto \
  --ts_proto_opt=outputServices=nice-grpc,outputServices=generic-definitions,useExactTypes=false \
  --proto_path=../modal-client \
  ../modal-client/modal_proto/*.proto
```

Then run a script with:

```bash
node --import tsx path/to/script.ts
```

This isn't meant to be a clean package or library setup, it's a minimal experiment for now.

Not going to mess with `tsup` or other bundlers.

## gRPC support

We're using `nice-grpc` because the `@grpc/grpc-js` library kind of sucks, it doesn't even use promises? What's going on with this part of the ecosystem.
