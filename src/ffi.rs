//! C ABI bindings to Modal.
//!
//! This is the public "extern" API, discovered by cbindgen. We use this from Go
//! and any other languages that support C FFI.
//!
//! Async functions from this module should use the completion queue API.

#![allow(unsafe_code)]

use std::sync::LazyLock;

/// System allocator used so memory can be shared with malloc() / free().
#[global_allocator]
static GLOBAL: std::alloc::System = std::alloc::System;

/// Global Tokio runtime used by all operations.
#[expect(dead_code)]
static RUNTIME: LazyLock<tokio::runtime::Runtime> = LazyLock::new(|| {
    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        // If this fails, it's a critical error in libmodal.
        .expect("libmodal failed to initialize tokio runtime")
});

#[expect(dead_code)]
type DoFn = unsafe extern "C" fn(x: i32, y: i32) -> i32;

/// Add two numbers.
#[unsafe(no_mangle)]
pub extern "C" fn add_two_numbers(x: i32, y: i32) -> i32 {
    x + y
}
