# libmodal: Lightweight [Modal](https://modal.com) client

Current state: **alpha. not yet published.**

Modal client libraries for JavaScript and Go.

This repository provides lightweight alternatives to the [Modal Python Library](https://github.com/modal-labs/modal-client). They let you start sandboxes (secure VMs), call Modal Functions, read or edit Volumes, and manage containers. However, they don't support deploying Modal Functions — those still need to be written in Python!

These client libraries support different languages, but they all have the same features and API, so you can use Modal from any project.

## Setup

Make sure you've authenticated with Modal. You can either sign in with the Modal CLI `pip install modal && modal setup`, or in machine environments, set the following environment variables on your app:

```bash
# Replace these with your actual token!
export MODAL_TOKEN_ID=ak-NOTAREALTOKENSTRINGXYZ
export MODAL_TOKEN_SECRET=as-FAKESECRETSTRINGABCDEF
```

Then you're ready to add the package to your project.

## JavaScript (`modal-js/`)

Install this in any server-side Node.js / Deno / Bun project.

```bash
npm install modal
```

Examples:

- [Create sandboxes](./modal-js/examples/sandbox.ts)

## Go (`modal-go/`)

First, use `go get` to install the latest version of the library.

```bash
go get -u github.com/modal-labs/libmodal/modal-go
```

Next, include Modal in your application:

```go
import "github.com/modal-labs/libmodal/modal-go"
```

Examples:

- [Create sandboxes](./modal-go/examples/sandbox/main.go)

## License

Code is released under the [MIT license](./LICENSE).
