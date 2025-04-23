//! Common library for Modal client operations, meant to be called via C FFI.
//!
//! Modal has an established client library for Python. The goal of `libmodal`
//! is not to replace this, but to provide a performant and correct systems
//! library for some core Modal operations that can be used by other languages,
//! implemented using a common Tokio-based async runtime.
//!
//! The design is similar to the AWS CRT (libcrt) or PyTorch's libtorch, which
//! are also FFI codebases that expose complex behavior to different languages'
//! libraries, consistently.
//!
//! Anything language-specific lives outside `libmodal`. But network behavior,
//! gRPC, retries, and low-level input queueing all belong here.

#![deny(unsafe_code)]
#![warn(missing_docs)]

pub mod ffi;
pub mod proto;
