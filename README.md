# libmodal: Lightweight [Modal](https://modal.com) client

Current state: **alpha. not yet published.**

Modal client libraries for JavaScript and Go.

This repository provides lightweight alternatives to the [Modal Python Library](https://github.com/modal-labs/modal-client). They let you start sandboxes (secure VMs), call Modal Functions, read or edit Volumes, and manage containers. However, they don't support deploying Modal Functions — those still need to be written in Python!

These client libraries support different languages, but they all have the same features and API, so you can use Modal from any project.

## JavaScript (`modal-js/`)

Install this in any server-side Node.js / Deno / Bun project.

```bash
npm install modal
```

## Go (`modal-go/`)

First, use `go get` to install the latest version of the library.

```bash
go get -u github.com/modal-labs/libmodal/modal-go
```

Next, include Modal in your application:

```go
import "github.com/modal-labs/libmodal/modal-go"
```

## License

Code is released under the [MIT license](./LICENSE).
