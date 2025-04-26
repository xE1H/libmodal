import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"], // TODO: "cjs" doesn't work with top-level await
  dts: true,
  clean: true,
});
