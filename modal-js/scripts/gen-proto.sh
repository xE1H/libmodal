#!/bin/bash
# Called from package.json scripts.

mkdir -p proto

./node_modules/.bin/grpc_tools_node_protoc \
  --plugin=protoc-gen-ts_proto=./node_modules/.bin/protoc-gen-ts_proto \
  --ts_proto_out=./proto \
  --ts_proto_opt=outputServices=nice-grpc,outputServices=generic-definitions,useExactTypes=false \
  --proto_path=../modal-client \
  ../modal-client/modal_proto/*.proto

# Add @ts-nocheck to all generated files.
find proto -name '*.ts' | while read -r file; do
  if ! grep -q '@ts-nocheck' "$file"; then
    (echo '// @ts-nocheck'; cat "$file") > "$file.tmp" && mv "$file.tmp" "$file"
  fi
done
