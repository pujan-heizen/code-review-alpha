import * as vscode from "vscode";

export interface RulesToolsOptions {
  onEvent?: (event: { type: "readRule"; detail: string }) => void;
}

export function createRulesTools(extensionUri: vscode.Uri, opts: RulesToolsOptions = {}) {
  const rulesRoot = vscode.Uri.joinPath(extensionUri, "rules");

  async function listRuleIds(): Promise<string[]> {
    const ids: string[] = [];

    async function walk(dir: vscode.Uri, prefix: string) {
      const entries = await vscode.workspace.fs.readDirectory(dir);
      for (const [name, type] of entries) {
        if (type === vscode.FileType.Directory) {
          await walk(vscode.Uri.joinPath(dir, name), prefix ? `${prefix}/${name}` : name);
        } else if (type === vscode.FileType.File && name.endsWith(".md")) {
          const base = name.replace(/\.md$/, "");
          ids.push(prefix ? `${prefix}/${base}` : base);
        }
      }
    }

    await walk(rulesRoot, "");
    return ids.sort();
  }

  async function readRule(id: string): Promise<{ id: string; content: string }> {
    const normalized = id.replaceAll("\\", "/").replace(/^\/+/, "");
    const uri = vscode.Uri.joinPath(rulesRoot, `${normalized}.md`);
    const bytes = await vscode.workspace.fs.readFile(uri);
    const content = Buffer.from(bytes).toString("utf8");
    opts.onEvent?.({ type: "readRule", detail: normalized });
    return { id: normalized, content };
  }

  return { listRuleIds, readRule };
}


