# libmodal: Lightweight [Modal](https://modal.com) client

Current state: **alpha. not yet published.**

Modal client libraries for JavaScript and Go.

This repository provides lightweight alternatives to the [Modal Python Library](https://github.com/modal-labs/modal-client). They let you start sandboxes, read or edit volumes, and manage containers. However, they don't support running Modal Apps / Functions — those still need to be written in Python!

## JavaScript

Install this in any server-side Node.js / Deno / Bun project.

```bash
npm install modal
```

## Go

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
