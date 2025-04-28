# modal-js development

Setup after cloning the repo with submodules:

```bash
npm install
```

Then run a script with:

```bash
node --import tsx path/to/script.ts
```

## gRPC support

We're using `nice-grpc` because the `@grpc/grpc-js` library doesn't support promises and is difficult to customize with types.

This gRPC library depends on the `protobuf-ts` package, which is not compatible with tree shaking because `ModalClientDefinition` transitively references every type. However, since `modal-js` is a server-side package, having a larger bundled library is not a huge issue.
