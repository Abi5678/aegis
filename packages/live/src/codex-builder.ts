import { Codex } from "@openai/codex-sdk";
import { z } from "zod";

import type { MutationSpec } from "../../engine/src/contracts.js";

interface CodexThreadBoundary {
  runStreamed(input: string, options?: { outputSchema?: unknown; signal?: AbortSignal }): Promise<{ events: AsyncIterable<unknown> }>;
}

export interface CodexBoundary {
  startThread(options: {
    model?: string;
    modelReasoningEffort?: "high";
    sandboxMode?: "workspace-write";
    workingDirectory: string;
    skipGitRepoCheck?: boolean;
    approvalPolicy?: "never";
    networkAccessEnabled?: boolean;
  }): CodexThreadBoundary;
}

export interface BuildCandidateRequest {
  workingDirectory: string;
  mutation: MutationSpec;
  failureTraces: string[];
  timeoutMs?: number;
  maxTokens?: number;
  onEvent?: (event: unknown) => void | Promise<void>;
}

export interface CodexBuildResult {
  summary: string;
  changedFiles: string[];
  testsRun: string[];
  usage: { inputTokens: number; cachedInputTokens: number; outputTokens: number; reasoningOutputTokens: number };
}

const BuildOutputSchema = z.object({
  summary: z.string().min(1),
  changedFiles: z.array(z.string()),
  testsRun: z.array(z.string()),
});

const outputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "changedFiles", "testsRun"],
  properties: {
    summary: { type: "string" },
    changedFiles: { type: "array", items: { type: "string" } },
    testsRun: { type: "array", items: { type: "string" } },
  },
};

const PROTECTED_PATH_PATTERN = /(^|\/)(holdout|evaluator|evaluation|protected)(\/|\.|$)/i;
const CODEX_ENV_ALLOWLIST = [
  "PATH",
  "HOME",
  "SHELL",
  "USER",
  "LOGNAME",
  "TMPDIR",
  "TMP",
  "TEMP",
  "LANG",
  "LC_ALL",
  "TERM",
  "COLORTERM",
  "NO_COLOR",
  "CODEX_HOME",
  "XDG_CONFIG_HOME",
  "XDG_CACHE_HOME",
  "XDG_DATA_HOME",
  "SystemRoot",
  "ComSpec",
  "PATHEXT",
] as const;

/**
 * The Codex CLI inherits only the small set of process metadata it needs to
 * find the executable and its own local login. OpenAI keys and unrelated
 * cloud/package credentials never cross into the mutation sandbox.
 */
export function createCodexEnvironment(source: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const environment: Record<string, string> = {};
  for (const key of CODEX_ENV_ALLOWLIST) {
    const value = source[key];
    if (value) environment[key] = value;
  }
  return environment;
}

function assertAllowedPaths(paths: string[]): void {
  for (const file of paths) {
    const normalized = file.replaceAll("\\", "/");
    if (
      !/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(normalized) ||
      normalized.includes("//") ||
      normalized.startsWith("/") ||
      normalized.split("/").includes("..") ||
      normalized === "." ||
      PROTECTED_PATH_PATTERN.test(normalized)
    ) {
      throw new Error(`Invalid allowed mutation path: ${file}`);
    }
  }
}

function eventType(event: unknown): string | undefined {
  return typeof event === "object" && event !== null && "type" in event && typeof event.type === "string" ? event.type : undefined;
}

export class CodexCandidateBuilder {
  private readonly codex: CodexBoundary;

  constructor(codex?: CodexBoundary) {
    this.codex = codex ?? (new Codex({ env: createCodexEnvironment() }) as unknown as CodexBoundary);
  }

  async build(request: BuildCandidateRequest): Promise<CodexBuildResult> {
    assertAllowedPaths(request.mutation.allowedFiles);
    const timeoutMs = request.timeoutMs ?? 180_000;
    const maxTokens = request.maxTokens ?? 100_000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error("Codex candidate build timed out.")), timeoutMs);
    const thread = this.codex.startThread({
      model: "gpt-5.6",
      modelReasoningEffort: "high",
      sandboxMode: "workspace-write",
      workingDirectory: request.workingDirectory,
      skipGitRepoCheck: false,
      approvalPolicy: "never",
      networkAccessEnabled: false,
    });

    const prompt = [
      "Implement one bounded Aegis repair in this isolated candidate worktree.",
      "You may inspect and edit only the exact allowed files listed below.",
      "Do not inspect parent directories, evaluator code, protected attacks, holdouts, secrets, or other candidates.",
      "Run focused tests that are already available inside the target worktree.",
      "Do not commit, push, use the network, or modify dependencies.",
      "Return only the requested structured summary; do not reveal chain-of-thought.",
      `Mutation kind: ${request.mutation.kind}`,
      `Diagnosis: ${request.mutation.diagnosis}`,
      `Hypothesis: ${request.mutation.hypothesis}`,
      `Intended behavior: ${request.mutation.intendedBehavior}`,
      `Allowed files:\n${request.mutation.allowedFiles.map((file) => `- ${file}`).join("\n")}`,
      `Observable failure traces:\n${request.failureTraces.map((trace) => `- ${trace}`).join("\n") || "- none"}`,
    ].join("\n\n");

    let responseText = "";
    const usage = { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, reasoningOutputTokens: 0 };
    try {
      const streamed = await thread.runStreamed(prompt, { outputSchema, signal: controller.signal });
      for await (const rawEvent of streamed.events) {
        await request.onEvent?.(rawEvent);
        const event = rawEvent as Record<string, unknown>;
        if (eventType(event) === "turn.failed" || eventType(event) === "error") {
          const error = event.error as { message?: string } | undefined;
          throw new Error(error?.message ?? String(event.message ?? "Codex candidate build failed."));
        }
        if (eventType(event) === "item.completed") {
          const item = event.item as { type?: string; text?: string } | undefined;
          if (item?.type === "agent_message" && typeof item.text === "string") {
            responseText = item.text;
          }
        }
        if (eventType(event) === "turn.completed") {
          const rawUsage = event.usage as Record<string, number> | undefined;
          usage.inputTokens = rawUsage?.input_tokens ?? 0;
          usage.cachedInputTokens = rawUsage?.cached_input_tokens ?? 0;
          usage.outputTokens = rawUsage?.output_tokens ?? 0;
          usage.reasoningOutputTokens = rawUsage?.reasoning_output_tokens ?? 0;
        }
      }
    } finally {
      clearTimeout(timeout);
    }

    if (usage.inputTokens + usage.outputTokens > maxTokens) {
      throw new Error(`Codex candidate exceeded its ${maxTokens}-token budget.`);
    }
    const parsed = BuildOutputSchema.parse(JSON.parse(responseText));
    assertAllowedPaths(parsed.changedFiles);
    const allowed = new Set(request.mutation.allowedFiles.map((file) => file.replaceAll("\\", "/")));
    const unexpected = parsed.changedFiles.filter((file) => !allowed.has(file.replaceAll("\\", "/")));
    if (unexpected.length > 0) {
      throw new Error(`Codex reported changes outside the mutation boundary: ${unexpected.join(", ")}`);
    }
    return { ...parsed, usage };
  }
}

export { assertAllowedPaths };
