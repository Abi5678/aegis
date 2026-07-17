import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { transformSync } from "esbuild";

import type { AttackScenario, RefundAction } from "../../engine/src/contracts.js";
import { toTargetAgentContext, type TargetAgentContext } from "./target-context.js";

export type CandidateAgentContext = TargetAgentContext;

export interface CandidateSandboxRequest {
  program: string;
  input: string;
  timeoutMs: number;
}

export interface CandidateSandboxRunner {
  execute(request: CandidateSandboxRequest): Promise<string>;
}

export type IsolatedCandidateGuard = (
  scenario: CandidateAgentContext,
  attemptedActions: RefundAction[],
) => Promise<RefundAction[]>;

export interface CandidateGuardOptions {
  timeoutMs?: number;
  maximumSourceBytes?: number;
  runner?: CandidateSandboxRunner;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function toCandidateContext(scenario: AttackScenario): CandidateAgentContext {
  return cloneJson(toTargetAgentContext(scenario));
}

export function createDockerCliEnvironment(source: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const environment: Record<string, string> = {};
  for (const key of ["PATH", "HOME", "TMPDIR", "DOCKER_HOST", "DOCKER_CONTEXT", "DOCKER_CONFIG", "XDG_RUNTIME_DIR"] as const) {
    const value = source[key];
    if (value) environment[key] = value;
  }
  return environment;
}

export function buildDockerSandboxArguments(
  programPath: string,
  image = process.env.AEGIS_CANDIDATE_SANDBOX_IMAGE ?? "node:25-alpine",
  containerName?: string,
): string[] {
  return [
    "run",
    "--rm",
    "--interactive",
    ...(containerName ? ["--name", containerName] : []),
    "--network=none",
    "--read-only",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges=true",
    "--memory=64m",
    "--cpus=0.25",
    "--pids-limit=16",
    "--user=65534:65534",
    "--tmpfs=/tmp:rw,noexec,nosuid,size=8m",
    `--volume=${programPath}:/sandbox/guard.cjs:ro`,
    image,
    "node",
    "/sandbox/guard.cjs",
  ];
}

export class DockerCandidateSandboxRunner implements CandidateSandboxRunner {
  constructor(private readonly image = process.env.AEGIS_CANDIDATE_SANDBOX_IMAGE ?? "node:25-alpine") {}

  async execute(request: CandidateSandboxRequest): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), "aegis-guard-"));
    const programPath = join(root, "guard.cjs");
    const containerName = `aegis-guard-${process.pid}-${randomUUID()}`;
    await writeFile(programPath, request.program, { encoding: "utf8", mode: 0o444 });
    try {
      return await new Promise<string>((resolve, reject) => {
        const child = spawn("docker", buildDockerSandboxArguments(programPath, this.image, containerName), {
          cwd: root,
          env: createDockerCliEnvironment(),
          stdio: ["pipe", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          child.kill("SIGKILL");
        }, request.timeoutMs);
        child.stdout.on("data", (chunk: Buffer) => {
          stdout += chunk.toString("utf8");
          if (stdout.length > 1_000_000) child.kill("SIGKILL");
        });
        child.stderr.on("data", (chunk: Buffer) => {
          stderr += chunk.toString("utf8");
          if (stderr.length > 1_000_000) child.kill("SIGKILL");
        });
        child.once("error", (error) => {
          clearTimeout(timer);
          reject(new Error(`Candidate sandbox could not start: ${error.message}`));
        });
        child.once("close", (code) => {
          clearTimeout(timer);
          if (timedOut) {
            reject(new Error(`Candidate sandbox timed out after ${request.timeoutMs}ms.`));
          } else if (code !== 0) {
            reject(new Error(`Candidate sandbox failed (${code ?? "signal"}): ${stderr.trim().slice(0, 500)}`));
          } else {
            resolve(stdout.trim());
          }
        });
        child.stdin.end(request.input);
      });
    } finally {
      await forceRemoveContainer(containerName);
      await rm(root, { recursive: true, force: true });
    }
  }
}

async function forceRemoveContainer(containerName: string): Promise<void> {
  await new Promise<void>((resolve) => {
    const child = spawn("docker", ["rm", "--force", containerName], {
      env: createDockerCliEnvironment(),
      stdio: "ignore",
    });
    const timer = setTimeout(() => child.kill("SIGKILL"), 5_000);
    child.once("error", () => {
      clearTimeout(timer);
      resolve();
    });
    child.once("close", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function compileProgram(source: string): string {
  let output: string;
  try {
    output = transformSync(source, {
      loader: "ts",
      format: "cjs",
      target: "node25",
      sourcemap: false,
      sourcefile: "candidate-agent.ts",
    }).code;
  } catch (error) {
    throw new Error(`Candidate guard did not compile: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (/\brequire\s*\(|\bimport\s*\(/.test(output)) {
    throw new Error("Candidate guard cannot load runtime modules or files.");
  }
  return [
    '"use strict";',
    output,
    "const __aegisChunks = [];",
    "process.stdin.setEncoding('utf8');",
    "process.stdin.on('data', chunk => __aegisChunks.push(chunk));",
    "process.stdin.on('end', () => {",
    "  const input = JSON.parse(__aegisChunks.join(''));",
    "  if (typeof module.exports.enforceCandidateActions !== 'function') throw new Error('Candidate must export enforceCandidateActions.');",
    "  const result = module.exports.enforceCandidateActions(input.scenario, input.attemptedActions);",
    "  if (result && typeof result.then === 'function') throw new Error('Candidate policy guards must be synchronous.');",
    "  process.stdout.write(JSON.stringify(result));",
    "});",
  ].join("\n");
}

/**
 * Executes candidate-authored code only inside a target-free, networkless,
 * read-only Docker sandbox. The container receives no host environment,
 * repository mount, evaluator, holdouts, or credentials.
 */
export function compileCandidateGuard(
  source: string,
  options: CandidateGuardOptions = {},
): IsolatedCandidateGuard {
  const timeoutMs = options.timeoutMs ?? 5_000;
  const maximumSourceBytes = options.maximumSourceBytes ?? 256_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30_000) {
    throw new Error("Candidate sandbox timeout must be between 100 and 30000ms.");
  }
  if (Buffer.byteLength(source, "utf8") > maximumSourceBytes) {
    throw new Error("Candidate guard source exceeds the evaluation size limit.");
  }
  const program = compileProgram(source);
  const runner = options.runner ?? new DockerCandidateSandboxRunner();
  return async (scenario, attemptedActions) => {
    const output = await runner.execute({
      program,
      timeoutMs,
      input: JSON.stringify({
        scenario: cloneJson(scenario),
        attemptedActions: cloneJson(attemptedActions),
      }),
    });
    if (!output) throw new Error("Candidate sandbox returned no actions.");
    return JSON.parse(output) as RefundAction[];
  };
}
