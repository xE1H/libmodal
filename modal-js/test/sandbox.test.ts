import { App, Image } from "modal";
import { expect, test } from "vitest";

test("can create a sandbox", async () => {
  const app = await App.lookup("libmodal-test", { createIfMissing: true });
  expect(app.appId).toBeTruthy();

  const image = await Image.fromRegistry("TODO");
  expect(image.imageId).toBeTruthy();

  const sb = await app.createSandbox(image);
  expect(sb.sandboxId).toBeTruthy();
  await sb.terminate();
  expect(await sb.wait()).toBe(0);
});
