import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "cloudflare:workers": path.resolve("./test/helpers/cloudflare-workers.ts"),
    },
  },
  test: {
    include: ["test/node/**/*.test.ts"],
    environment: "node",
  },
});
