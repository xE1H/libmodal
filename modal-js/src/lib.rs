//! JavaScript SDK for [Modal](https://modal.com/), usable from Node.js, Deno, or Bun.

#![deny(unsafe_code)]
#![warn(missing_docs)]

use napi_derive::napi;

/// A simple function that adds two numbers.
#[napi]
pub fn sum(a: u32, b: u32) -> u32 {
    a + b
}
