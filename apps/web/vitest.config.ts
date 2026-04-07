import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // Component tests use happy-dom; API route tests override with "node" via docblock
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — environmentMatchGlobs is a valid Vitest option not yet reflected in the bundled types
    environmentMatchGlobs: [
      ["src/app/api/**", "node"],
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/app/api/**/*.ts", "src/components/ui/**/*.tsx"],
      exclude: ["src/test/**", "**/__tests__/**"],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
