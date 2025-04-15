# libmodal

Current state: **DO NOT USE.**

Modal client library runtime and building blocks implemented in Rust.

The current plan is to export implementations of gRPC calls, as well as higher-level app / sandbox / volumes APIs, to Python, Go, and JavaScript.

- Python: [PyO3](https://pyo3.rs/)
- Go: cgo with cbindgen and a completion queue API
- Node/Deno/Bun: [napi-rs](https://napi.rs/)

## `libmodal` crate

This is the Rust crate that's planned for implementing core Modal functionality. It should expose a reasonable public API, but we don't expect any direct consumers.

There is an `ffi` module exposed with `cbindgen` for Go code, as well as a `napi` module for use with `napi-rs` to generate JavaScript bindings.

## `non-native/` folder

This contains non-native implementations of client libraries without using `libmodal`, for comparison. It's expected that we won't maintain this folder for long. If deciding to continue in this direction, we should probably start from scratch in a new `modal-client-js` repo.
