import { NetworkAccess_NetworkAccessType } from "../proto/modal_proto/api.ts";
import { client } from "./client.ts";
import { App, Image } from "./modal.ts";

const resp = await client.clientHello({});
console.log(resp);

console.log("Connected!");

const sandboxCreateResp = await client.sandboxCreate({
  appId: "ap-tBJPwfXSZCUeRdF1mzH5fL",
  definition: {
    entrypointArgs: ["echo", "hello"],
    imageId: "im-0MT7lcT3Kzh7DxZgVHgSRY",
    timeoutSecs: 600,
    networkAccess: {
      networkAccessType: NetworkAccess_NetworkAccessType.OPEN,
    },
    resources: {
      memoryMb: 1024,
      milliCpu: 1000,
    },
  },
});
console.log(sandboxCreateResp);

const app = await App.lookup("my-sandboxes");
const image = await Image.fromRegistry("node:22");

const sb = await app.createSandbox(image);

const p = await sb.exec(["echo", "hello", "world"], {
  stdout: "pipe",
  stderr: "ignore",
});

console.log(await p.stdout.readText());
await p.wait();
