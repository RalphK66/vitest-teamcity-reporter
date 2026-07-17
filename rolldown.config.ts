import { defineConfig } from "rolldown";

const external = (id: string) => /^[^./]|^node:/.test(id);

export default defineConfig({
  input: "src/index.ts",
  external,
  output: [
    { dir: "dist", format: "esm", entryFileNames: "[name].js", cleanDir: true },
    { dir: "dist", format: "cjs", entryFileNames: "[name].cjs" },
  ],
});
