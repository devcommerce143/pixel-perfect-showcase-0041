// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";
import { productionConfigIssues } from "./src/lib/config/production";

export default defineConfig({
  plugins: [
    {
      name: "dolf-production-public-config",
      configResolved(config) {
        if (config.command !== "build" || config.mode === "development") return;
        const issues = productionConfigIssues(loadEnv(config.mode, config.envDir, "VITE_"));
        if (issues.length)
          throw new Error(`Production browser configuration invalid:\n${issues.join("\n")}`);
      },
    },
  ],
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
