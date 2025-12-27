import * as path from "path";
import * as vscode from "vscode";

export interface PromptInfo {
  id: string;
  name: string;
  uri: vscode.Uri;
}

export class PromptManager {
  private static readonly ACTIVE_PROMPT_KEY = "vscodeCodeReview.activePromptId";

  constructor(private readonly context: vscode.ExtensionContext) {}

  private promptsDir(): vscode.Uri {
    return vscode.Uri.joinPath(this.context.globalStorageUri, "prompts");
  }

  async ensureDefaults(): Promise<void> {
    await vscode.workspace.fs.createDirectory(this.promptsDir());

    const existing = await this.listPrompts();
    if (existing.length > 0) return;

    // Seed default prompts from packaged prompt templates.
    const templatesDir = vscode.Uri.joinPath(this.context.extensionUri, "prompts", "templates");
    const templates = await vscode.workspace.fs.readDirectory(templatesDir);

    for (const [name, fileType] of templates) {
      if (fileType !== vscode.FileType.File) continue;
      if (!name.endsWith(".md")) continue;
      const from = vscode.Uri.joinPath(templatesDir, name);
      const to = vscode.Uri.joinPath(this.promptsDir(), name);
      const buf = await vscode.workspace.fs.readFile(from);
      await vscode.workspace.fs.writeFile(to, buf);
    }

    const seeded = await this.listPrompts();
    if (seeded.length > 0) {
      await this.setActivePromptId(seeded[0].id);
    }
  }

  async listPrompts(): Promise<PromptInfo[]> {
    try {
      const entries = await vscode.workspace.fs.readDirectory(this.promptsDir());
      const mdFiles = entries
        .filter(([n, t]) => t === vscode.FileType.File && n.endsWith(".md"))
        .map(([n]) => n)
        .sort((a, b) => a.localeCompare(b));

      const prompts: PromptInfo[] = [];
      for (const filename of mdFiles) {
        const uri = vscode.Uri.joinPath(this.promptsDir(), filename);
        const bytes = await vscode.workspace.fs.readFile(uri);
        const content = Buffer.from(bytes).toString("utf8");
        prompts.push({
          id: filename,
          name: this.inferPromptName(filename, content),
          uri,
        });
      }
      return prompts;
    } catch {
      return [];
    }
  }

  private inferPromptName(filename: string, content: string): string {
    const firstHeading = content.split("\n").find((l) => l.startsWith("# "));
    if (firstHeading) return firstHeading.replace(/^#\s+/, "").trim();
    return path.basename(filename, ".md");
  }

  getActivePromptId(): string | undefined {
    return this.context.workspaceState.get<string>(PromptManager.ACTIVE_PROMPT_KEY);
  }

  async setActivePromptId(id: string): Promise<void> {
    await this.context.workspaceState.update(PromptManager.ACTIVE_PROMPT_KEY, id);
  }

  async getPromptContent(id: string): Promise<{ uri: vscode.Uri; content: string }> {
    const uri = vscode.Uri.joinPath(this.promptsDir(), id);
    const bytes = await vscode.workspace.fs.readFile(uri);
    return { uri, content: Buffer.from(bytes).toString("utf8") };
  }

  async createPrompt(filename: string, initialContent: string): Promise<PromptInfo> {
    const safe = filename.endsWith(".md") ? filename : `${filename}.md`;
    const uri = vscode.Uri.joinPath(this.promptsDir(), safe);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(initialContent, "utf8"));
    const prompts = await this.listPrompts();
    const created = prompts.find((p) => p.id === safe);
    if (!created) {
      return { id: safe, name: path.basename(safe, ".md"), uri };
    }
    return created;
  }

  async deletePrompt(id: string): Promise<void> {
    const uri = vscode.Uri.joinPath(this.promptsDir(), id);
    await vscode.workspace.fs.delete(uri, { useTrash: true });

    const active = this.getActivePromptId();
    if (active === id) {
      const remaining = await this.listPrompts();
      await this.setActivePromptId(remaining[0]?.id);
    }
  }
}
