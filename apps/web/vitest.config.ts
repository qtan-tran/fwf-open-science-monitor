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
    environmentMatchGlobs: [
      // API route files run in Node to match the actual Next.js runtime
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
