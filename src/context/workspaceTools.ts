import * as path from "path";
import * as vscode from "vscode";
import { z } from "zod";
import { isProbablyBinaryPath, shouldIgnorePath } from "./ignore";

export const ReadFileInputSchema = z.object({
  path: z.string().min(1).describe("File path (absolute or workspace-relative)."),
});

export const ListFilesInputSchema = z.object({
  root: z
    .string()
    .optional()
    .describe("Root folder (absolute or workspace-relative). Defaults to workspace root."),
  maxEntries: z.number().int().positive().max(2000).default(300),
});

export const SearchInputSchema = z.object({
  query: z.string().min(2).describe("Text to search for."),
  maxMatches: z.number().int().positive().max(200).default(30),
});

export type WorkspaceTools = ReturnType<typeof createWorkspaceTools>;

export interface WorkspaceToolsOptions {
  maxBytesPerFile?: number;
  maxTotalBytes?: number;
  onEvent?: (event: { type: "readFile" | "listFiles" | "search" | "readRule"; detail: string }) => void;
}

class Budget {
  constructor(
    private totalRemainingBytes: number,
    private readonly maxBytesPerFile: number,
  ) {}

  take(bytes: number): void {
    if (bytes > this.maxBytesPerFile) {
      throw new Error(`File too large for context (>${this.maxBytesPerFile} bytes).`);
    }
    if (bytes > this.totalRemainingBytes) {
      throw new Error("Context budget exceeded for this review.");
    }
    this.totalRemainingBytes -= bytes;
  }
}

function getWorkspaceRoot(): vscode.Uri {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!root) throw new Error("No workspace folder is open.");
  return root;
}

function toAbsoluteFsPath(inputPath: string): string {
  if (path.isAbsolute(inputPath)) return inputPath;
  const root = getWorkspaceRoot();
  return path.join(root.fsPath, inputPath);
}

export function createWorkspaceTools(
  opts: WorkspaceToolsOptions = {},
  output?: vscode.OutputChannel,
) {
  const maxBytesPerFile = opts.maxBytesPerFile ?? 200_000;
  const maxTotalBytes = opts.maxTotalBytes ?? 1_000_000;
  const budget = new Budget(maxTotalBytes, maxBytesPerFile);

  const readFile = async (input: z.infer<typeof ReadFileInputSchema>) => {
    const abs = toAbsoluteFsPath(input.path);
    const rel = vscode.workspace.asRelativePath(abs, false);
    const normalized = rel.replaceAll("\\", "/");

    if (shouldIgnorePath(normalized) || isProbablyBinaryPath(normalized)) {
      throw new Error(`Access denied for path: ${normalized}`);
    }

    const uri = vscode.Uri.file(abs);
    const bytes = await vscode.workspace.fs.readFile(uri);
    budget.take(bytes.byteLength);

    // Assume UTF-8. If it looks binary-ish, block.
    const text = Buffer.from(bytes).toString("utf8");
    if (/[\x00-\x08\x0E-\x1F]/.test(text)) {
      throw new Error(`File appears to be binary or non-text: ${normalized}`);
    }

    output?.appendLine(`[tool:readFile] ${normalized} (${bytes.byteLength} bytes)`);
    opts.onEvent?.({ type: "readFile", detail: normalized });
    const contentWithLineNumbers = text
      .split("\n")
      .map((line, idx) => `${String(idx + 1).padStart(4, " ")} | ${line}`)
      .join("\n");

    return { path: normalized, content: text, contentWithLineNumbers };
  };

  const listFiles = async (input: z.infer<typeof ListFilesInputSchema>) => {
    const rootFs = toAbsoluteFsPath(input.root ?? "");
    const rootUri = vscode.Uri.file(rootFs);

    // VS Code glob ignore is limited; we combine a broad ignore glob with an additional regex filter.
    const ignoreGlob = "**/{node_modules,.git,dist,build,out,target,coverage}/**";
    const found = await vscode.workspace.findFiles(
      new vscode.RelativePattern(rootUri, "**/*"),
      ignoreGlob,
      input.maxEntries,
    );

    const files = found
      .map((u) => vscode.workspace.asRelativePath(u, false).replaceAll("\\", "/"))
      .filter((p) => !shouldIgnorePath(p));

    output?.appendLine(`[tool:listFiles] root=${input.root ?? "."} -> ${files.length} files`);
    opts.onEvent?.({ type: "listFiles", detail: input.root ?? "." });
    return { root: input.root ?? ".", files };
  };

  const search = async (input: z.infer<typeof SearchInputSchema>) => {
    const results: Array<{ path: string; line: number; preview: string }> = [];
    const query = input.query;

    const ignoreGlob = "**/{node_modules,.git,dist,build,out,target,coverage}/**";
    const candidates = await vscode.workspace.findFiles("**/*", ignoreGlob, 800);

    for (const uri of candidates) {
      if (results.length >= input.maxMatches) break;

      const rel = vscode.workspace.asRelativePath(uri, false).replaceAll("\\", "/");
      if (shouldIgnorePath(rel) || isProbablyBinaryPath(rel)) continue;

      // Read file (bounded by per-file + total budget).
      let content: string;
      try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        budget.take(bytes.byteLength);
        content = Buffer.from(bytes).toString("utf8");
        if (/[\x00-\x08\x0E-\x1F]/.test(content)) continue;
      } catch {
        continue;
      }

      // Simple substring match, case-insensitive.
      const needle = query.toLowerCase();
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (results.length >= input.maxMatches) break;
        if (lines[i].toLowerCase().includes(needle)) {
          results.push({ path: rel, line: i + 1, preview: lines[i].trimEnd() });
        }
      }
    }

    output?.appendLine(`[tool:search] "${query}" -> ${results.length} matches`);
    opts.onEvent?.({ type: "search", detail: query });
    return { query, matches: results };
  };

  return { readFile, listFiles, search };
}
