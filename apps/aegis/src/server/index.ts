import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JsonlRunStore } from "../../../../packages/engine/src/index.js";
import { createLiveExperimentFactory } from "../../../../packages/live/src/index.js";
import { buildServer } from "./app.js";
import { EngineRunService, type LiveExperimentFactory } from "./engine-run-service.js";

export { buildServer } from "./app.js";
export { EngineRunService } from "./engine-run-service.js";
export type {
  EngineExperiment,
  LiveExperimentFactory,
  RunPersistence
} from "./engine-run-service.js";
export type { RunService } from "./run-service.js";

export interface StartServerOptions {
  port?: number;
  host?: string;
  replayDurationMs?: number;
  liveExperimentFactory?: LiveExperimentFactory;
  dataDir?: string;
  allowedOrigin?: string;
  liveControlToken?: string;
}

export async function startServer(options: StartServerOptions = {}) {
  const here = dirname(fileURLToPath(import.meta.url));
  const staticDir = resolve(here, "../../../../dist/aegis");
  const dataDir = resolve(
    options.dataDir ?? process.env.AEGIS_DATA_DIR ?? resolve(process.cwd(), ".data")
  );
  const liveExperimentFactory = options.liveExperimentFactory
    ?? liveFactoryFromEnvironment(dataDir);
  const service = new EngineRunService({
    replayDurationMs: options.replayDurationMs ?? numberFromEnvironment("AEGIS_REPLAY_DURATION_MS"),
    liveExperimentFactory,
    persistence: new JsonlRunStore(dataDir)
  });
  const app = await buildServer({
    service,
    logger: true,
    staticDir: existsSync(resolve(staticDir, "index.html")) ? staticDir : null,
    allowedOrigin: options.allowedOrigin ?? process.env.AEGIS_ALLOWED_ORIGIN,
    liveControlToken: options.liveControlToken ?? process.env.AEGIS_LIVE_CONTROL_TOKEN
  });

  const port = options.port ?? numberFromEnvironment("PORT") ?? 3000;
  const host = resolveServerHost(options.host);
  await app.listen({ port, host });
  return app;
}

export function resolveServerHost(
  explicitHost: string | undefined,
  environment: { HOST?: string } = process.env
): string {
  return explicitHost ?? environment.HOST ?? "127.0.0.1";
}

/** Live execution is deliberately fail-closed and can never masquerade as replay. */
export function liveFactoryFromEnvironment(
  dataDir: string,
  environment: NodeJS.ProcessEnv = process.env
): LiveExperimentFactory | undefined {
  if (!environment.OPENAI_API_KEY?.trim() || environment.AEGIS_ENABLE_CODEX !== "true") {
    return undefined;
  }
  return createLiveExperimentFactory({ dataDir });
}

function numberFromEnvironment(name: string): number | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

const isEntrypoint = process.argv[1]
  ? resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isEntrypoint) {
  const app = await startServer();
  const shutdown = async () => {
    await app.close();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
