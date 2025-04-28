import { App, Image } from "modal";

const app = await App.lookup("libmodal-example", { createIfMissing: true });
const image = await Image.fromRegistry("node:22");

// Spawn a sandbox running the "cat" command.
const sb = await app.createSandbox(image, { command: ["cat"] });
console.log("sandbox:", sb.sandboxId);

// Write to the sandbox's stdin and read from its stdout.
await sb.stdin.writeText("this is input that should be mirrored by cat");
await sb.stdin.close();
console.log("output:", await sb.stdout.readText());

// Terminate the sandbox.
await sb.terminate();
