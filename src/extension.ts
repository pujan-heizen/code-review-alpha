import * as vscode from "vscode";
import { getSettings } from "./config/settings";
import { GitManager } from "./git/gitManager";
import { SidebarProvider } from "./views/SidebarProvider";
import { ReviewPanel } from "./views/ReviewPanel";
import { runReview } from "./review/reviewRunner";
import { PromptManager } from "./prompts/promptManager";
import { fetchModels } from "./ai/modelCatalog";
import { getApiKeyForProvider } from "./config/settings";

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel("Code Review");
  context.subscriptions.push(output);

  const git = new GitManager();
  const promptManager = new PromptManager(context);

  const sidebarProvider = new SidebarProvider(context, context.extensionUri, output, promptManager);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, sidebarProvider),
  );

  // keep sidebar in sync when provider/model settings change
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (
        e.affectsConfiguration("vscodeCodeReview.provider") ||
        e.affectsConfiguration("vscodeCodeReview.model")
      ) {
        await sidebarProvider.refresh();
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("vscodeCodeReview.runReview", async () => {
      try {
        if (!git.isGitAvailable()) {
          await vscode.window.showErrorMessage(
            "Git extension is not available. Please ensure Git is installed and the built-in Git extension is enabled.",
          );
          return;
        }
        if (!git.hasRepository()) {
          await vscode.window.showErrorMessage("No Git repository found in the current workspace.");
          return;
        }

        const diff = await git.getUnstagedChanges();
        if (!diff.unstagedDiff.trim()) {
          const stagedCount = diff.stagedFiles.length;
          await vscode.window.showInformationMessage(
            stagedCount > 0
              ? `No unstaged changes found. Nothing to review. (${stagedCount} staged file(s) not reviewed.)`
              : "No unstaged changes found. Nothing to review.",
          );
          return;
        }

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Code Review",
            cancellable: false,
          },
          async (progress) => {
            progress.report({ message: "Reviewing changes..." });

            await promptManager.ensureDefaults();
            const activePromptId = promptManager.getActivePromptId();
            if (!activePromptId) {
              throw new Error("No prompt selected.");
            }
            const { content: systemPrompt } = await promptManager.getPromptContent(activePromptId);

            sidebarProvider.setReviewing(true);
            const abortController = sidebarProvider.createAbortController();
            const result = await runReview({
              extensionUri: context.extensionUri,
              diff,
              systemPrompt,
              output,
              abortSignal: abortController.signal,
              onActivity: (evt) => {
                if (evt.type === "readFile")
                  sidebarProvider.pushActivity(`readFile: ${evt.detail}`);
                else if (evt.type === "listFiles")
                  sidebarProvider.pushActivity(`listFiles: ${evt.detail}`);
                else if (evt.type === "readRule")
                  sidebarProvider.pushActivity(`readRule: ${evt.detail}`);
                else sidebarProvider.pushActivity(`search: ${evt.detail}`);
              },
              onUsage: (usage) => {
                if (usage && typeof usage === "object") {
                  const u = usage as {
                    inputTokens?: number;
                    outputTokens?: number;
                    totalTokens?: number;
                  };
                  sidebarProvider.setUsage(u);
                } else {
                  sidebarProvider.setUsage(undefined);
                }
              },
            });

            ReviewPanel.createOrShow(context.extensionUri, result);
            sidebarProvider.setReviewing(false);
          },
        );
      } catch (err) {
        sidebarProvider.setReviewing(false);
        // Handle user cancellation gracefully
        if (err instanceof Error && (err.name === "AbortError" || err.message.includes("aborted"))) {
          output.appendLine(`[info] Review cancelled by user`);
          await vscode.window.showInformationMessage("Code review cancelled.");
          return;
        }
        const msg = err instanceof Error ? err.message : String(err);
        output.appendLine(`[error] runReview: ${msg}`);
        await vscode.window.showErrorMessage(`Code review failed: ${msg}`);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("vscodeCodeReview.openSettings", async () => {
      await vscode.commands.executeCommand("workbench.action.openSettings", "vscodeCodeReview");
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("vscodeCodeReview.pickModel", async () => {
      const { provider } = getSettings();
      const apiKey = getApiKeyForProvider(provider);
      if (!apiKey) {
        await vscode.window.showErrorMessage(
          `API key is not set for ${provider}. Configure it in VS Code Settings: “Code Review”.`,
        );
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      let models: string[] = [];
      try {
        models = await fetchModels({ provider, apiKey, abortSignal: controller.signal });
      } catch (e) {
        models = [];
      } finally {
        clearTimeout(timeout);
      }

      if (models.length === 0) {
        await vscode.window.showErrorMessage("Could not fetch models for the selected provider.");
        return;
      }

      const picked = await vscode.window.showQuickPick(models, {
        placeHolder: `Select a ${provider} model`,
        matchOnDescription: true,
        ignoreFocusOut: true,
      });
      if (!picked) return;

      await vscode.workspace
        .getConfiguration("vscodeCodeReview")
        .update("model", picked, vscode.ConfigurationTarget.Global);

      await vscode.window.showInformationMessage(`Model set to ${picked}.`);
    }),
  );
}

export function deactivate() {}
