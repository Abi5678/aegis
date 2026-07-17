import { execFile } from "node:child_process";
import { lstat, mkdir, realpath } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { promisify } from "node:util";

import { assertAllowedPaths } from "./codex-builder.js";

const exec = promisify(execFile);
const MAX_CANDIDATE_FILE_BYTES = 256 * 1024;

interface CommandResult {
  stdout: string;
  stderr: string;
}

export interface CommandRunner {
  run(command: string, args: string[], options: { cwd: string }): Promise<CommandResult>;
}

const defaultRunner: CommandRunner = {
  async run(command, args, options) {
    const result = await exec(command, args, { cwd: options.cwd, maxBuffer: 5 * 1024 * 1024 });
    return { stdout: result.stdout, stderr: result.stderr };
  },
};

export interface CandidateWorktree {
  id: string;
  path: string;
  repository: string;
  baseSha: string;
}

export interface PrepareWorktreeRequest {
  repository: string;
  worktreeRoot: string;
  runId: string;
  candidateId: string;
  baseRef?: string;
}

export interface FreezeWorktreeRequest {
  candidate: CandidateWorktree;
  allowedFiles: string[];
  message: string;
}

export interface FrozenCandidate extends CandidateWorktree {
  commitSha: string;
  changedFiles: string[];
}

function safeIdentifier(value: string, label: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,80}$/.test(value)) {
    throw new Error(`${label} must contain only letters, numbers, underscores, and hyphens.`);
  }
  return value;
}

function names(stdout: string): string[] {
  return stdout
    .split("\n")
    .map((item) => item.trim().replaceAll("\\", "/"))
    .filter(Boolean);
}

function isContained(root: string, target: string): boolean {
  const path = relative(root, target);
  return path === "" || (!path.startsWith("..") && !path.startsWith("/"));
}

async function assertRegularCandidateFile(candidate: CandidateWorktree, file: string): Promise<string> {
  assertAllowedPaths([file]);
  const normalized = file.replaceAll("\\", "/");
  if (!normalized) throw new Error("Candidate file path cannot be empty.");

  const lexicalRoot = resolve(candidate.path);
  const lexicalTarget = resolve(lexicalRoot, normalized);
  if (!isContained(lexicalRoot, lexicalTarget)) {
    throw new Error(`Candidate file escapes its worktree: ${file}`);
  }

  let metadata;
  try {
    metadata = await lstat(lexicalTarget);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Candidate mutation must remain a regular file: ${file}`);
    }
    throw error;
  }
  if (!metadata.isFile() || metadata.nlink !== 1) {
    throw new Error(`Candidate mutation must remain a regular file with one link: ${file}`);
  }
  if (metadata.size > MAX_CANDIDATE_FILE_BYTES) {
    throw new Error(`Candidate mutation exceeds the ${MAX_CANDIDATE_FILE_BYTES}-byte file limit: ${file}`);
  }

  const [physicalRoot, physicalTarget] = await Promise.all([
    realpath(lexicalRoot),
    realpath(lexicalTarget),
  ]);
  if (!isContained(physicalRoot, physicalTarget)) {
    throw new Error(`Candidate file resolves outside its worktree: ${file}`);
  }
  return lexicalTarget;
}

/**
 * Reads the exact blob recorded in a frozen candidate commit. Evaluation must
 * never consume the mutable worktree after its SHA is announced.
 */
export async function readFrozenCandidateFile(candidate: FrozenCandidate, file: string): Promise<string> {
  assertAllowedPaths([file]);
  if (!/^[0-9a-f]{40}$/i.test(candidate.commitSha)) {
    throw new Error("Frozen candidate commit must be a full Git SHA.");
  }
  const normalized = file.replaceAll("\\", "/");
  const tree = await exec("git", ["ls-tree", "-l", candidate.commitSha, "--", normalized], {
    cwd: candidate.path,
    maxBuffer: 64 * 1024,
  });
  const match = /^(100644|100755) blob [0-9a-f]{40}\s+(\d+)\t(.+)$/.exec(tree.stdout.trim());
  if (!match || match[3] !== normalized) {
    throw new Error(`Frozen candidate artifact is not a regular Git blob: ${file}`);
  }
  const size = Number(match[2]);
  if (!Number.isSafeInteger(size) || size > MAX_CANDIDATE_FILE_BYTES) {
    throw new Error(`Frozen candidate artifact exceeds the ${MAX_CANDIDATE_FILE_BYTES}-byte limit: ${file}`);
  }
  const blob = await exec("git", ["show", `${candidate.commitSha}:${normalized}`], {
    cwd: candidate.path,
    maxBuffer: MAX_CANDIDATE_FILE_BYTES + 1,
  });
  if (Buffer.byteLength(blob.stdout, "utf8") > MAX_CANDIDATE_FILE_BYTES) {
    throw new Error(`Frozen candidate artifact exceeds the ${MAX_CANDIDATE_FILE_BYTES}-byte limit: ${file}`);
  }
  return blob.stdout;
}

export class GitWorktreeManager {
  constructor(private readonly runner: CommandRunner = defaultRunner) {}

  async prepare(request: PrepareWorktreeRequest): Promise<CandidateWorktree> {
    const runId = safeIdentifier(request.runId, "runId");
    const candidateId = safeIdentifier(request.candidateId, "candidateId");
    const baseRef = request.baseRef ?? "HEAD";
    const path = join(request.worktreeRoot, runId, candidateId);
    await mkdir(dirname(path), { recursive: true });
    const baseSha = (await this.runner.run("git", ["rev-parse", baseRef], { cwd: request.repository })).stdout.trim();
    if (!/^[0-9a-f]{40}$/i.test(baseSha)) {
      throw new Error(`Unable to resolve candidate base ref: ${baseRef}`);
    }
    await this.runner.run("git", ["worktree", "add", "--detach", path, baseSha], { cwd: request.repository });
    return { id: candidateId, path, repository: request.repository, baseSha };
  }

  async freeze(request: FreezeWorktreeRequest): Promise<FrozenCandidate> {
    assertAllowedPaths(request.allowedFiles);
    if (request.allowedFiles.length === 0) {
      throw new Error("A candidate must have at least one allowed mutation path.");
    }
    const allowed = new Set(request.allowedFiles.map((file) => file.replaceAll("\\", "/")));
    const [unstaged, staged, untracked] = await Promise.all([
      this.runner.run("git", ["diff", "--name-only", "--relative"], { cwd: request.candidate.path }),
      this.runner.run("git", ["diff", "--cached", "--name-only", "--relative"], { cwd: request.candidate.path }),
      this.runner.run("git", ["ls-files", "--others", "--exclude-standard"], { cwd: request.candidate.path }),
    ]);
    const changedFiles = [...new Set([...names(unstaged.stdout), ...names(staged.stdout), ...names(untracked.stdout)])].sort();
    if (changedFiles.length === 0) {
      throw new Error("Codex produced no candidate changes to freeze.");
    }
    const outside = changedFiles.filter((file) => !allowed.has(file));
    if (outside.length > 0) {
      throw new Error(`Candidate changed files outside the mutation boundary: ${outside.join(", ")}`);
    }
    await Promise.all(changedFiles.map((file) => assertRegularCandidateFile(request.candidate, file)));
    await this.runner.run("git", ["add", "--", ...changedFiles], { cwd: request.candidate.path });
    const stagedFiles = names((await this.runner.run("git", ["diff", "--cached", "--name-only", "--relative"], { cwd: request.candidate.path })).stdout);
    if (stagedFiles.length === 0) {
      throw new Error("Candidate mutation has no committable diff.");
    }
    await this.runner.run(
      "git",
      ["-c", "user.name=Aegis", "-c", "user.email=aegis@example.invalid", "commit", "-m", request.message],
      { cwd: request.candidate.path },
    );
    const commitSha = (await this.runner.run("git", ["rev-parse", "HEAD"], { cwd: request.candidate.path })).stdout.trim();
    if (!/^[0-9a-f]{40}$/i.test(commitSha)) {
      throw new Error("Candidate commit could not be frozen.");
    }
    return { ...request.candidate, commitSha, changedFiles: stagedFiles.sort() };
  }

  async remove(candidate: CandidateWorktree): Promise<void> {
    await this.runner.run("git", ["worktree", "remove", "--force", candidate.path], { cwd: candidate.repository });
  }
}
