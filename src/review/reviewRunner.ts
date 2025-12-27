import * as vscode from "vscode";
import { generateText, Output, stepCountIs, type Tool } from "ai";
import { z } from "zod";
import { resolveModel } from "../ai/modelFactory";
import {
  createWorkspaceTools,
  ListFilesInputSchema,
  ReadFileInputSchema,
  SearchInputSchema,
} from "../context/workspaceTools";
import { createRulesTools } from "../context/rulesTools";
import type { GitDiffResult } from "../git/gitManager";
import { ReviewOutputSchema, type ReviewOutput } from "../schema/reviewOutput";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getArray(obj: Record<string, unknown>, key: string): unknown[] {
  const v = obj[key];
  return Array.isArray(v) ? v : [];
}

function getString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === "string" ? v : undefined;
}

function getNumber(obj: Record<string, unknown>, key: string): number | undefined {
  const v = obj[key];
  return typeof v === "number" ? v : undefined;
}

function normalizeReviewOutput(input: unknown): unknown {
  if (!isRecord(input)) return input;
  const root = input;

  const findingsIn = getArray(root, "findings");
  const fixesIn = getArray(root, "fixes");

  const findings = findingsIn
    .map((f) => {
      if (!isRecord(f)) return null;
      const severity = getString(f, "severity");
      const title = getString(f, "title");
      if (!severity || !title) return null;
      return {
        severity,
        title,
        filePath: getString(f, "filePath") ?? null,
        startLine: getNumber(f, "startLine") ?? null,
        endLine: getNumber(f, "endLine") ?? null,
        rationale: getString(f, "rationale") ?? null,
      };
    })
    .filter(Boolean);

  const fixes = fixesIn
    .map((f) => {
      if (!isRecord(f)) return null;
      const id = getString(f, "id");
      const title = getString(f, "title");
      const filePath = getString(f, "filePath");
      const startLine = getNumber(f, "startLine");
      const endLine = getNumber(f, "endLine");
      const replacement = getString(f, "replacement");
      if (!id || !title || !filePath || startLine === undefined || endLine === undefined || !replacement)
        return null;
      return {
        id,
        title,
        filePath,
        startLine,
        endLine,
        replacement,
        expectedOriginalSnippet: getString(f, "expectedOriginalSnippet") ?? null,
      };
    })
    .filter(Boolean);

  return {
    reviewMarkdown: getString(root, "reviewMarkdown") ?? "",
    findings,
    fixes,
  };
}

export interface RunReviewArgs {
  extensionUri: vscode.Uri;
  diff: GitDiffResult;
  systemPrompt: string;
  output?: vscode.OutputChannel;
  onActivity?: (event: {
    type: "readFile" | "listFiles" | "search" | "readRule";
    detail: string;
  }) => void;
  onUsage?: (usage: unknown) => void;
}

export async function runReview(args: RunReviewArgs): Promise<ReviewOutput> {
  const resolved = await resolveModel();

  const wsTools = createWorkspaceTools(
    { maxBytesPerFile: 200_000, maxTotalBytes: 1_000_000, onEvent: args.onActivity },
    args.output,
  );
  const rulesTools = createRulesTools(args.extensionUri, {
    onEvent: (e) => args.onActivity?.(e),
  });

  const ListRulesInputSchema = z.object({});
  const ReadRuleInputSchema = z.object({ id: z.string().min(1) });

  const tools: Record<string, Tool<unknown, unknown>> = {
    readFile: {
      description:
        "Read a workspace file (text only). Returns both raw content and a line-numbered view.",
      inputSchema: ReadFileInputSchema,
      execute: async (input, _options) => wsTools.readFile(ReadFileInputSchema.parse(input)),
    },
    listFiles: {
      description: "List workspace files under a root directory (respects ignore rules).",
      inputSchema: ListFilesInputSchema,
      execute: async (input, _options) => wsTools.listFiles(ListFilesInputSchema.parse(input)),
    },
    search: {
      description: "Search for text in the workspace (respects ignore rules).",
      inputSchema: SearchInputSchema,
      execute: async (input, _options) => wsTools.search(SearchInputSchema.parse(input)),
    },
    listRules: {
      description: "List built-in framework rules (ids) packaged with the extension.",
      inputSchema: ListRulesInputSchema,
      execute: async () => ({ ruleIds: await rulesTools.listRuleIds() }),
    },
    readRule: {
      description:
        "Read a built-in rule markdown file by id (e.g. 'nextjs/ui/shadcn' or 'nestjs').",
      inputSchema: ReadRuleInputSchema,
      execute: async (input) => rulesTools.readRule(ReadRuleInputSchema.parse(input).id),
    },
  };

  const rel = (u: vscode.Uri) => vscode.workspace.asRelativePath(u, false).replaceAll("\\", "/");
  const staged = args.diff.stagedFiles.map(rel);
  const unstaged = args.diff.unstagedFiles.map(rel);

  const prompt = [
    `Staged files (${staged.length}):`,
    ...staged.map((p) => `- ${p}`),
    "",
    `Unstaged files (${unstaged.length}):`,
    ...unstaged.map((p) => `- ${p}`),
    "",
    "Unified diff:",
    args.diff.diff,
  ].join("\n");

  const system = args.systemPrompt;

  // Prefer structured output: forces required fields to be present (nullable fields must be `null`).
  try {
    const result = await generateText({
      model: resolved.model,
      system,
      prompt,
      tools,
      stopWhen: stepCountIs(20),
      experimental_output: Output.object({ schema: ReviewOutputSchema }),
    });

    args.onUsage?.(result.usage);
    return result.experimental_output as ReviewOutput;
  } catch {
    // Fallback: parse JSON and normalize missing nullable fields to null.
    const result = await generateText({
      model: resolved.model,
      system,
      prompt,
      tools,
      stopWhen: stepCountIs(20),
    });

    args.onUsage?.(result.usage);

    let json: unknown;
    try {
      json = JSON.parse(result.text);
    } catch {
      throw new Error("Model did not return valid JSON.");
    }

    return ReviewOutputSchema.parse(normalizeReviewOutput(json));
  }
}
