import * as vscode from "vscode";
import { marked } from "marked";
import { ReviewOutputSchema, type ReviewOutput } from "../schema/reviewOutput";
import { applyFix } from "../apply/applyFix";
import { createNonce } from "./webviewShared";
import { getReviewPanelHtml } from "./reviewPanelHtml";

type PanelToExtensionMessage =
  | { type: "applyFix"; fixId: string }
  | { type: "openFile"; filePath: string; line?: number };

export class ReviewPanel {
  private static readonly viewType = "vscodeCodeReview.reviewResult";
  private static current: ReviewPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly disposables: vscode.Disposable[] = [];
  private lastOutput: ReviewOutput | undefined;

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
  ) {
    this.panel = panel;
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(async (message: PanelToExtensionMessage) => {
      switch (message.type) {
        case "applyFix":
          if (!this.lastOutput) return;
          await this.handleApplyFix(message.fixId);
          break;
        case "openFile": {
          const uri = vscode.Uri.file(message.filePath);
          const doc = await vscode.workspace.openTextDocument(uri);
          const editor = await vscode.window.showTextDocument(doc, { preview: false });
          if (typeof message.line === "number" && message.line > 0) {
            const pos = new vscode.Position(message.line - 1, 0);
            editor.selection = new vscode.Selection(pos, pos);
            editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
          }
          break;
        }
      }
    });
  }

  static createOrShow(extensionUri: vscode.Uri, output: ReviewOutput): ReviewPanel {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    const parsed = ReviewOutputSchema.parse(output);

    if (ReviewPanel.current) {
      ReviewPanel.current.panel.reveal(column);
      void ReviewPanel.current.update(parsed);
      return ReviewPanel.current;
    }

    const panel = vscode.window.createWebviewPanel(ReviewPanel.viewType, "Code Review", column, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [extensionUri],
    });

    ReviewPanel.current = new ReviewPanel(panel, extensionUri);
    void ReviewPanel.current.update(parsed);
    return ReviewPanel.current;
  }

  private async update(output: ReviewOutput): Promise<void> {
    this.lastOutput = output;
    const nonce = createNonce();
    const html = await marked(output.reviewMarkdown);
    this.panel.webview.html = getReviewPanelHtml({ nonce, reviewHtml: html, output });
  }

  private async handleApplyFix(fixId: string): Promise<void> {
    const fix = this.lastOutput?.fixes.find((f) => f.id === fixId);
    if (!fix) {
      await vscode.window.showErrorMessage(`Fix not found: ${fixId}`);
      this.panel.webview.postMessage({ type: "fixFailed", fixId });
      return;
    }

    const res = await applyFix(fix);
    if (!res.applied) {
      await vscode.window.showErrorMessage(res.reason ?? "Failed to apply fix.");
      this.panel.webview.postMessage({ type: "fixFailed", fixId });
      return;
    }
    
    // Notify webview that fix was applied successfully
    this.panel.webview.postMessage({ type: "fixApplied", fixId });
    await vscode.window.showInformationMessage(`Applied fix: ${fix.title}`);
  }

  private dispose(): void {
    ReviewPanel.current = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      this.disposables.pop()?.dispose();
    }
  }

  // nonce/escaping helpers live in `webviewShared.ts`
}
