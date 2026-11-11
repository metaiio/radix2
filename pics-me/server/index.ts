import { buildApp } from "./app.ts";
import { loadConfig } from "./config.ts";

const cfg = loadConfig();
const { server, ai } = await buildApp(cfg);

await server.listen({ port: cfg.port, host: "0.0.0.0" });
console.log(`pics.me listening on http://localhost:${cfg.port}  (AI: ${ai.provider === "claude" ? `Claude · ${cfg.aiModel}` : "built-in templates — set ANTHROPIC_API_KEY for vision AI"})`);

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => void server.close().then(() => process.exit(0)));
}
