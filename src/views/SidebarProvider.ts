import * as vscode from "vscode";
import { getSidebarHtml } from "./sidebarHtml";
import { PromptManager, type PromptInfo } from "../prompts/promptManager";

type SidebarToExtensionMessage =
  | { type: "init" }
  | { type: "runReview" }
  | { type: "cancelReview" }
  | { type: "openSettings" }
  | { type: "selectPrompt"; promptId: string }
  | { type: "editPrompt"; promptId: string }
  | { type: "newPrompt" }
  | { type: "deletePrompt"; promptId: string };

export class SidebarProvider implements vscode.WebviewViewProvider {
  static readonly viewType = "vscodeCodeReview.sidebar";

  private view?: vscode.WebviewView;
  private isReviewing = false;
  private activity: string[] = [];
  private usageText = "N/A";
  private prompts: PromptInfo[] = [];
  private abortController?: AbortController;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly extensionUri: vscode.Uri,
    private readonly output: vscode.OutputChannel,
    private readonly promptManager: PromptManager,
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = getSidebarHtml().html;

    webviewView.webview.onDidReceiveMessage(async (message: SidebarToExtensionMessage) => {
      switch (message.type) {
        case "init":
          await this.refresh();
          break;
        case "runReview":
          await vscode.commands.executeCommand("vscodeCodeReview.runReview");
          break;
        case "cancelReview":
          this.cancelReview();
          break;
        case "openSettings":
          await vscode.commands.executeCommand("vscodeCodeReview.openSettings");
          break;
        case "selectPrompt":
          await this.promptManager.setActivePromptId(message.promptId);
          await this.refresh();
          break;
        case "editPrompt":
          await this.openPromptForEdit(message.promptId);
          break;
        case "newPrompt":
          await this.createPromptFlow();
          break;
        case "deletePrompt":
          await this.deletePromptFlow(message.promptId);
          break;
      }
    });
  }

  async refresh(): Promise<void> {
    await this.promptManager.ensureDefaults();
    this.prompts = await this.promptManager.listPrompts();
    if (!this.promptManager.getActivePromptId() && this.prompts.length > 0) {
      await this.promptManager.setActivePromptId(this.prompts[0].id);
    }
    await this.postState();
  }

  setReviewing(value: boolean): void {
    this.isReviewing = value;
    if (value) {
      this.activity = [];
      this.usageText = "N/A";
    } else {
      this.abortController = undefined;
    }
    void this.postState();
  }

  createAbortController(): AbortController {
    this.abortController = new AbortController();
    return this.abortController;
  }

  cancelReview(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.pushActivity("Review cancelled by user");
    }
  }

  pushActivity(line: string): void {
    this.activity.unshift(line);
    this.activity = this.activity.slice(0, 50);
    void this.postState();
  }

  setUsage(
    usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number } | undefined,
  ) {
    if (!usage) {
      this.usageText = "N/A";
    } else {
      const i = usage.inputTokens ?? 0;
      const o = usage.outputTokens ?? 0;
      const t = usage.totalTokens ?? i + o;
      this.usageText = `input=${i} output=${o} total=${t}`;
    }
    void this.postState();
  }

  private async postState(): Promise<void> {
    if (!this.view) return;

    this.view.webview.postMessage({
      type: "state",
      isReviewing: this.isReviewing,
      prompts: this.prompts.map((p) => ({ id: p.id, name: p.name })),
      activePromptId: this.promptManager.getActivePromptId(),
      usageText: this.usageText,
      activity: this.activity,
    });
  }

  private async openPromptForEdit(promptId: string): Promise<void> {
    if (!promptId) return;
    const { uri } = await this.promptManager.getPromptContent(promptId);
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { preview: false });
  }

  private async createPromptFlow(): Promise<void> {
    const name = await vscode.window.showInputBox({
      prompt: "Prompt file name (without extension)",
      ignoreFocusOut: true,
      validateInput: (v) => (!v.trim() ? "Required" : null),
    });
    if (!name) return;

    const initial = `# ${name}\n\nWrite your system prompt here.\n`;
    const created = await this.promptManager.createPrompt(name, initial);
    await this.promptManager.setActivePromptId(created.id);
    await this.openPromptForEdit(created.id);
    await this.refresh();
  }

  private async deletePromptFlow(promptId: string): Promise<void> {
    if (!promptId) return;
    const choice = await vscode.window.showWarningMessage(
      `Delete prompt "${promptId}"?`,
      { modal: true },
      "Delete",
    );
    if (choice !== "Delete") return;
    await this.promptManager.deletePrompt(promptId);
    await this.refresh();
  }
}
