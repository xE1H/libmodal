import { App, Image } from "./modal.ts";

// const resp = await client.clientHello({});
// console.log(resp);

console.log("Connected!");

const app = await App.lookup("temp-libmodal", { createIfMissing: true });
const image = await Image.fromRegistry("node:22");

const sb = await app.createSandbox(image);
console.log("sandbox:", sb.sandboxId);

const p = await sb.exec(["echo", "hello", "world"], {
  stdout: "pipe",
  stderr: "ignore",
});

console.log(await p.stdout.readText());
// await p.wait();

await sb.terminate();
