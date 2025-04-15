import { ModalClientDefinition } from "../proto/modal_proto/api.ts";
import {
  CallOptions,
  ClientMiddlewareCall,
  createChannel,
  createClientFactory,
  Metadata,
} from "nice-grpc";

const tokenId = process.env["MODAL_TOKEN_ID"];
const tokenSecret = process.env["MODAL_TOKEN_SECRET"];

if (!tokenId || !tokenSecret) {
  throw new Error(
    "Please set the MODAL_TOKEN_ID and MODAL_TOKEN_SECRET environment variables."
  );
}

const channel = createChannel("https://api.modal.com:443");
const client = createClientFactory()
  .use(async function* middleware<Request, Response>(
    call: ClientMiddlewareCall<Request, Response>,
    options: CallOptions
  ) {
    options.metadata ??= new Metadata();
    options.metadata.set("x-modal-client-type", "1");
    options.metadata.set("x-modal-client-version", "424242");
    options.metadata.set("x-modal-token-id", tokenId);
    options.metadata.set("x-modal-token-secret", tokenSecret);
    return yield* call.next(call.request, options);
  })
  .create(ModalClientDefinition, channel);

const resp = await client.clientHello({});
console.log(resp);

console.log("Connected!");
