# non-native

Setup after cloning the repo with submodules:

```bash
npm install
```

Then run a script with:

```bash
node --import tsx path/to/script.ts
```

## gRPC support

We're using `nice-grpc` because the `@grpc/grpc-js` library kind of sucks, it doesn't even use promises? What's going on with this part of the ecosystem.

## Unimplemented features

- Line buffering (`by_line=True` in the Python client)
- Distinguishing different failed status codes in streaming RPCs
- gRPC retries of any kind
- Error handling in stdin `WritableStream` instance via its `controller`
