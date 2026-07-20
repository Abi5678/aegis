import cors from "@fastify/cors";
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest
} from "fastify";
import { timingSafeEqual } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { z } from "zod";
import type { RunEvent } from "../../../../packages/engine/src/contracts.js";
import {
  CandidateNotFoundError,
  ImmunityVerificationConflictError,
  LiveModeUnavailableError,
  PromotionConflictError,
  RollbackConflictError,
  RunNotFoundError,
  type RunService
} from "./run-service.js";

const createRunSchema = z.object({
  mode: z.enum(["live", "replay"]),
  target: z.literal("refund-agent")
}).strict();

const promotionSchema = z.object({
  candidateId: z.string().trim().min(1),
  decision: z.enum(["approve", "reject"])
}).strict();

const immunityVerificationSchema = z.object({
  recordId: z.string().trim().min(1)
}).strict();

const paramsSchema = z.object({ id: z.string().trim().min(1) });
const candidateParamsSchema = z.object({
  id: z.string().trim().min(1),
  candidateId: z.string().trim().min(1)
});
const eventQuerySchema = z.object({
  follow: z.enum(["true", "false"]).optional(),
  after: z.coerce.number().int().min(0).optional()
}).passthrough();

export interface BuildServerOptions {
  service: RunService;
  logger?: boolean;
  staticDir?: string | null;
  /** Cross-origin API access is disabled unless one exact origin is configured. */
  allowedOrigin?: string;
  /** Required by live execution and live promotion; replay remains credential-free. */
  liveControlToken?: string;
}

export async function buildServer(options: BuildServerOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });
  const allowedOrigin = options.allowedOrigin?.trim() || undefined;
  await app.register(cors, {
    origin: allowedOrigin
      ? (origin, callback) => callback(null, origin === allowedOrigin ? allowedOrigin : false)
      : false,
    methods: ["GET", "POST", "OPTIONS"]
  });

  app.get("/api/health", async () => ({
    ok: true,
    service: "aegis",
    time: new Date().toISOString()
  }));

  app.post("/api/runs", async (request, reply) => {
    const input = createRunSchema.parse(request.body);
    if (input.mode === "live") {
      const failure = authorizeLiveControl(request, options.liveControlToken);
      if (failure) return reply.code(failure.statusCode).send(failure.body);
    }
    const snapshot = await options.service.createRun(input);
    return reply.code(202).send({ runId: snapshot.id });
  });

  app.get("/api/runs/:id", async (request) => {
    const { id } = paramsSchema.parse(request.params);
    const snapshot = await options.service.getRun(id);
    if (!snapshot) throw new RunNotFoundError(id);
    return snapshot;
  });

  app.get("/api/runs/:id/candidates/:candidateId", async (request) => {
    const { id, candidateId } = candidateParamsSchema.parse(request.params);
    const run = await options.service.getRun(id);
    if (!run) throw new RunNotFoundError(id);
    const candidate = await options.service.getCandidate(id, candidateId);
    if (!candidate) throw new CandidateNotFoundError(candidateId);
    return candidate;
  });

  app.post("/api/runs/:id/promotion", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const input = promotionSchema.parse(request.body);
    const snapshot = await options.service.getRun(id);
    if (!snapshot) throw new RunNotFoundError(id);
    if (snapshot.mode === "live") {
      const failure = authorizeLiveControl(request, options.liveControlToken);
      if (failure) return reply.code(failure.statusCode).send(failure.body);
    }
    const result = await options.service.promote(id, input);
    return reply.code(200).send(result);
  });

  app.post("/api/runs/:id/immunity/verify", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const { recordId } = immunityVerificationSchema.parse(request.body);
    const snapshot = await options.service.getRun(id);
    if (!snapshot) throw new RunNotFoundError(id);
    if (snapshot.mode === "live") {
      const failure = authorizeLiveControl(request, options.liveControlToken);
      if (failure) return reply.code(failure.statusCode).send(failure.body);
    }
    return reply.code(200).send(await options.service.verifyImmunity(id, recordId));
  });

  app.post("/api/runs/:id/rollback", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const snapshot = await options.service.getRun(id);
    if (!snapshot) throw new RunNotFoundError(id);
    const failure = authorizeLiveControl(request, options.liveControlToken);
    if (failure) return reply.code(failure.statusCode).send(failure.body);
    const result = await options.service.rollback(id);
    return reply.code(200).send(result);
  });

  app.get("/api/immunity", async () => ({
    records: await options.service.listImmunity()
  }));

  app.get("/api/runs/:id/events", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const query = eventQuerySchema.parse(request.query);
    const snapshot = await options.service.getRun(id);
    if (!snapshot) throw new RunNotFoundError(id);

    const afterEventId = query.after ?? parseLastEventId(request);
    const follow = query.follow !== "false";
    await streamEvents({
      request,
      reply,
      service: options.service,
      runId: id,
      afterEventId,
      follow,
      initiallyTerminal: isTerminal(snapshot.status)
    });
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        error: "invalid_request",
        message: "Request validation failed.",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }
    if (error instanceof RunNotFoundError || error instanceof CandidateNotFoundError) {
      return reply.code(404).send({ error: "not_found", message: error.message });
    }
    if (error instanceof PromotionConflictError) {
      return reply.code(409).send({ error: "promotion_conflict", message: error.message });
    }
    if (error instanceof RollbackConflictError) {
      return reply.code(409).send({ error: "rollback_conflict", message: error.message });
    }
    if (error instanceof ImmunityVerificationConflictError) {
      return reply.code(409).send({ error: "immunity_verification_conflict", message: error.message });
    }
    if (error instanceof LiveModeUnavailableError) {
      return reply.code(503).send({ error: "live_mode_unconfigured", message: error.message });
    }

    request.log.error(error);
    return reply.code(500).send({
      error: "internal_error",
      message: "Aegis could not complete the request."
    });
  });

  if (options.staticDir) registerStaticFrontend(app, options.staticDir);

  app.addHook("onClose", async () => {
    await options.service.close?.();
  });

  return app;
}

type LiveControlFailure = {
  statusCode: 401 | 503;
  body: { error: string; message: string };
};

function authorizeLiveControl(
  request: FastifyRequest,
  configuredToken: string | undefined
): LiveControlFailure | null {
  const expected = configuredToken?.trim();
  if (!expected) {
    return {
      statusCode: 503,
      body: {
        error: "live_control_unconfigured",
        message: "Live execution is disabled until AEGIS_LIVE_CONTROL_TOKEN is configured."
      }
    };
  }
  const header = request.headers["x-aegis-control-token"];
  const provided = typeof header === "string" ? header : "";
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  const matches = expectedBytes.length === providedBytes.length
    && timingSafeEqual(expectedBytes, providedBytes);
  if (!matches) {
    return {
      statusCode: 401,
      body: {
        error: "unauthorized",
        message: "A valid Aegis live-control token is required."
      }
    };
  }
  return null;
}

type StreamOptions = {
  request: FastifyRequest;
  reply: FastifyReply;
  service: RunService;
  runId: string;
  afterEventId: number;
  follow: boolean;
  initiallyTerminal: boolean;
};

async function streamEvents(options: StreamOptions): Promise<void> {
  const { request, reply, service, runId } = options;
  const response = reply.raw;
  let lastSent = options.afterEventId;
  let buffering = true;
  let ended = false;
  let heartbeat: NodeJS.Timeout | undefined;
  const buffer: RunEvent[] = [];

  const write = (event: RunEvent) => {
    if (ended || event.id <= lastSent) return;
    lastSent = event.id;
    response.write(serializeSse(event));
    if (isTerminal(event.snapshot.status)) close();
  };

  const listener = (event: RunEvent) => {
    if (buffering) buffer.push(event);
    else write(event);
  };

  const unsubscribe = options.follow ? service.subscribe(runId, listener) : null;
  const backlog = await service.getEvents(runId, options.afterEventId);

  reply.hijack();
  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
  response.flushHeaders?.();
  response.write("retry: 1500\n: connected\n\n");

  buffering = false;
  for (const event of [...backlog, ...buffer].sort((a, b) => a.id - b.id)) write(event);

  if (ended) return;
  if (!options.follow || options.initiallyTerminal) {
    close();
    return;
  }

  heartbeat = setInterval(() => {
    if (!ended) response.write(`: heartbeat ${Date.now()}\n\n`);
  }, 15_000);
  heartbeat.unref();

  request.raw.on("close", close);

  function close() {
    if (ended) return;
    ended = true;
    unsubscribe?.();
    if (heartbeat) clearInterval(heartbeat);
    response.end();
  }
}

function parseLastEventId(request: FastifyRequest): number {
  const value = request.headers["last-event-id"];
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : 0;
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function serializeSse(event: RunEvent): string {
  // Keep the SSE event name as "message" so the browser's EventSource
  // onmessage handler receives every typed RunEvent. The domain type remains
  // in event.type inside the JSON payload.
  return `id: ${event.id}\nevent: message\ndata: ${JSON.stringify(event)}\n\n`;
}

function isTerminal(status: string): boolean {
  return status === "promoted" || status === "rolled_back" || status === "rejected" || status === "failed";
}

function registerStaticFrontend(app: FastifyInstance, staticDir: string): void {
  const root = resolve(staticDir);
  const index = resolve(root, "index.html");
  if (!existsSync(index)) return;

  const serve = async (request: FastifyRequest, reply: FastifyReply) => {
    const wildcard = (request.params as { "*"?: string })["*"] ?? "";
    if (wildcard === "api" || wildcard.startsWith("api/")) {
      return reply.code(404).send({ error: "not_found", message: "API route was not found." });
    }
    const requested = resolve(root, wildcard || "index.html");
    const isInsideRoot = requested === root || requested.startsWith(`${root}${sep}`);
    const file = isInsideRoot && existsSync(requested) && statSync(requested).isFile()
      ? requested
      : index;
    reply.type(mimeType(file));
    return reply.send(createReadStream(file));
  };

  app.get("/", serve);
  app.get("/*", serve);
}

function mimeType(file: string): string {
  return ({
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".webp": "image/webp",
    ".woff2": "font/woff2"
  } as Record<string, string>)[extname(file)] ?? "application/octet-stream";
}
