import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import { GitWorktreeManager, readFrozenCandidateFile } from "./worktree-manager.js";

const exec = promisify(execFile);
const cleanup: string[] = [];

async function git(cwd: string, ...args: string[]): Promise<string> {
  const result = await exec("git", args, { cwd });
  return result.stdout.trim();
}

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("GitWorktreeManager", () => {
  it("isolates a candidate and freezes only allowed changes as a real commit", async () => {
    const root = await mkdtemp(join(tmpdir(), "aegis-worktree-"));
    cleanup.push(root);
    const repo = join(root, "target");
    await mkdir(join(repo, "agent"), { recursive: true });
    await writeFile(join(repo, "agent", "tools.ts"), "export const maxRefund = 999;\n");
    await writeFile(join(repo, "README.md"), "target\n");
    await git(repo, "init");
    await git(repo, "config", "user.email", "aegis@example.invalid");
    await git(repo, "config", "user.name", "Aegis Test");
    await git(repo, "add", ".");
    await git(repo, "commit", "-m", "vulnerable baseline");

    const manager = new GitWorktreeManager();
    const candidate = await manager.prepare({
      repository: repo,
      worktreeRoot: join(root, "candidates"),
      runId: "run-1",
      candidateId: "permissions",
    });
    await writeFile(join(candidate.path, "agent", "tools.ts"), "export const maxRefund = 100;\n");
    const frozen = await manager.freeze({
      candidate,
      allowedFiles: ["agent/tools.ts"],
      message: "aegis: enforce remaining refund amount",
    });

    expect(frozen.commitSha).toMatch(/^[0-9a-f]{40}$/);
    expect(frozen.changedFiles).toEqual(["agent/tools.ts"]);
    expect(await readFile(join(candidate.path, "agent", "tools.ts"), "utf8")).toContain("100");
    expect(await git(candidate.path, "show", "--format=", "--name-only", frozen.commitSha)).toBe("agent/tools.ts");

    await writeFile(join(candidate.path, "agent", "tools.ts"), "export const maxRefund = 999999;\n");
    expect(await readFrozenCandidateFile(frozen, "agent/tools.ts")).toContain("100");
    expect(await readFrozenCandidateFile(frozen, "agent/tools.ts")).not.toContain("999999");
  });

  it("refuses to commit any file outside the mutation boundary", async () => {
    const root = await mkdtemp(join(tmpdir(), "aegis-worktree-"));
    cleanup.push(root);
    const repo = join(root, "target");
    await mkdir(join(repo, "agent"), { recursive: true });
    await writeFile(join(repo, "agent", "prompt.ts"), "export const prompt = 'unsafe';\n");
    await git(repo, "init");
    await git(repo, "config", "user.email", "aegis@example.invalid");
    await git(repo, "config", "user.name", "Aegis Test");
    await git(repo, "add", ".");
    await git(repo, "commit", "-m", "baseline");
    const manager = new GitWorktreeManager();
    const candidate = await manager.prepare({ repository: repo, worktreeRoot: join(root, "candidates"), runId: "run-2", candidateId: "prompt" });
    await writeFile(join(candidate.path, "outside.txt"), "not allowed\n");

    await expect(manager.freeze({ candidate, allowedFiles: ["agent/prompt.ts"], message: "repair" }))
      .rejects.toThrow(/outside the mutation boundary/i);
  });

  it("rejects an allow-listed path when Codex replaces it with a symlink", async () => {
    const root = await mkdtemp(join(tmpdir(), "aegis-worktree-"));
    cleanup.push(root);
    const repo = join(root, "target");
    await mkdir(join(repo, "agent"), { recursive: true });
    await writeFile(join(repo, "agent", "prompt.ts"), "export const prompt = 'unsafe';\n");
    await git(repo, "init");
    await git(repo, "config", "user.email", "aegis@example.invalid");
    await git(repo, "config", "user.name", "Aegis Test");
    await git(repo, "add", ".");
    await git(repo, "commit", "-m", "baseline");
    const manager = new GitWorktreeManager();
    const candidate = await manager.prepare({ repository: repo, worktreeRoot: join(root, "candidates"), runId: "run-3", candidateId: "prompt" });
    const secret = join(root, "outside-secret.txt");
    await writeFile(secret, "must never become a prompt\n");
    await unlink(join(candidate.path, "agent", "prompt.ts"));
    await symlink(secret, join(candidate.path, "agent", "prompt.ts"));

    await expect(manager.freeze({ candidate, allowedFiles: ["agent/prompt.ts"], message: "repair" }))
      .rejects.toThrow(/regular file/i);
  });
});
