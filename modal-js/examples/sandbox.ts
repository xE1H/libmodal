import { App, Image } from "modal";

// const resp = await client.clientHello({});
// console.log(resp);

console.log("Connected!");

const app = await App.lookup("temp-libmodal", { createIfMissing: true });
const image = await Image.fromRegistry("node:22");

const sb = await app.createSandbox(image, { command: ["cat"] });
console.log("sandbox:", sb.sandboxId);
await sb.stdin.writeText("this is input that should be mirrored by cat");
await sb.stdin.close();
console.log("output:", await sb.stdout.readText());

// const sb = await app.createSandbox(image);
// console.log("sandbox:", sb.sandboxId);

// const p = await sb.exec(["echo", "hello", "world"], {
//   stdout: "pipe",
//   stderr: "ignore",
// });

// console.log(await p.stdout.readText());
// // await p.wait();

// await sb.terminate();
