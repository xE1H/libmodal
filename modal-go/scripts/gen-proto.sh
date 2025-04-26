#!/bin/bash

rm -rf proto && mkdir -p proto

protoc \
  --go_out=paths=source_relative:proto \
  --go_opt=default_api_level=API_OPAQUE \
  --go-grpc_out=paths=source_relative:proto \
  --proto_path=../modal-client \
  ../modal-client/modal_proto/*.proto
