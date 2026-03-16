import path from "node:path";

const repoRoot = path.resolve(__dirname, "..");
const webRoot = path.resolve(repoRoot, "web");

const config = {
  root: webRoot,
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(webRoot, "src"),
    },
  },
  test: {
    include: ["../Tests/**/*.test.{ts,tsx}"],
    exclude: ["../Tests/node_modules/**"],
    setupFiles: ["../Tests/setup.ts"],
    environment: "jsdom",
    globals: true,
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: path.resolve(repoRoot, "Tests/coverage"),
      include: [
        path.resolve(webRoot, "src/**/*.{ts,tsx}"),
      ],
      exclude: [
        path.resolve(webRoot, "src/app/layout.tsx"),
        path.resolve(webRoot, "src/app/manifest.ts"),
      ],
    },
  },
};

export default config;
