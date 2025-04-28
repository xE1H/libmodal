# Publishing `libmodal`

```bash
VERSION=0.0.X

git tag modal-go/v$VERSION
git push --tags
GOPROXY=proxy.golang.org go list -m github.com/modal-labs/libmodal/modal-go@v$VERSION
```

```bash
VERSION=0.0.X

# Note: Edit package.json first
npm run build
npm publish

git tag modal-js/v$VERSION
git push --tags
```
