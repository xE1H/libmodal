# Changelog

Both client libraries are pre-1.0, and they have separate versioning.

## modal-js/v0.3.4, modal-go/v0.0.5

- Added feature for looking up and calling remote classes via the `Cls` object.
- (Go) Removed the initial `ctx context.Context` argument from `Function_.Remote()`.

## modal-js/v0.3.3, modal-go/v0.0.4

- Support calling remote functions with arguments greater than 2 MiB in byte payload size.

## modal-js/v0.3.2, modal-go/v0.0.3

- First public release
- Basic `Function`, `Sandbox`, `Image`, and `ContainerProcess` support
