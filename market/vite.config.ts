import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local"],
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: (userConfig) => {
          userConfig.main = "./worker/index.ts";
          userConfig.compatibility_flags = Array.from(
            new Set([
              ...(userConfig.compatibility_flags ?? []),
              "nodejs_compat",
            ]),
          );

          // Programmatic config arrays are concatenated with wrangler.jsonc.
          // Only supply Sites preview placeholders when a binding is absent,
          // otherwise the generated deploy config contains duplicate names.
          if (
            d1 &&
            !(userConfig.d1_databases ?? []).some(
              (database) => database.binding === d1,
            )
          ) {
            userConfig.d1_databases = [
              {
                binding: d1,
                database_name: "site-creator-d1",
                database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
              },
            ];
          }
          if (
            r2 &&
            !(userConfig.r2_buckets ?? []).some(
              (bucket) => bucket.binding === r2,
            )
          ) {
            userConfig.r2_buckets = [
              {
                binding: r2,
                bucket_name: "site-creator-r2",
              },
            ];
          }
        },
      }),
    ],
  };
});
