import { NetworkAccess_NetworkAccessType } from "../proto/modal_proto/api.ts";
import { client } from "./client.ts";

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
