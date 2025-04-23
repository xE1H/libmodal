# libmodal

Current state: **DO NOT USE.**

Modal client library runtime and building blocks implemented in Rust.

The current plan is to export implementations of gRPC calls, as well as higher-level app / sandbox / volumes APIs, to Python, Go, and JavaScript.

- Node/Deno/Bun: [napi-rs](https://napi.rs/)
- Go: cgo with cbindgen and a completion queue API
- Python: [PyO3](https://pyo3.rs/)

## `libmodal` crate

This is the Rust crate that's planned for implementing core Modal functionality. It should expose a reasonable public API, but we don't expect any direct consumers.

There is an `ffi` module exposed with `cbindgen` for Go code, and you can also consume it directly. The primitives used by `modal-js`, which generates bindings to JavaScript with `napi-rs`.

### `modal-js/` folder

Native JavaScript client library based on `libmodal`.

### `modal-go/` folder (planned)

Native Go client library based on `libmodal`.

### `modal-python/` folder (planned)

Native Python client library based on `libmodal`.

## `non-native/` folder

This contains a non-native implementation of a JS client library without using `libmodal`, for comparison. It's expected that we won't maintain this folder for long. If deciding to continue in this direction, we should probably start from scratch in a new `modal-client-js` repo.
