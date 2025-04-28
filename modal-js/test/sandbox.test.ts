import { App } from "modal";
import { expect, test } from "vitest";

test("CreateOneSandbox", async () => {
  const app = await App.lookup("libmodal-test", { createIfMissing: true });
  expect(app.appId).toBeTruthy();

  const image = await app.imageFromRegistry("alpine:3.21");
  expect(image.imageId).toBeTruthy();

  const sb = await app.createSandbox(image);
  expect(sb.sandboxId).toBeTruthy();
  await sb.terminate();
  expect(await sb.wait()).toBe(0);
});

test("PassCatToStdin", async () => {
  const app = await App.lookup("libmodal-test", { createIfMissing: true });
  const image = await app.imageFromRegistry("alpine:3.21");

  // Spawn a sandbox running the "cat" command.
  const sb = await app.createSandbox(image, { command: ["cat"] });

  // Write to the sandbox's stdin and read from its stdout.
  await sb.stdin.writeText("this is input that should be mirrored by cat");
  await sb.stdin.close();
  expect(await sb.stdout.readText()).toBe(
    "this is input that should be mirrored by cat",
  );

  // Terminate the sandbox.
  await sb.terminate();
});
