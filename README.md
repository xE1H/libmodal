# libmodal

Current state: **DO NOT USE.**

Modal client library runtime and building blocks implemented in Rust.

The current plan is to export implementations of gRPC calls, as well as higher-level app / sandbox / volumes APIs, to Python, Go, and JavaScript.

- Python: [PyO3](https://pyo3.rs/)
- Go: cgo with cbindgen and a completion queue API
- Node/Deno/Bun: [napi-rs](https://napi.rs/)
