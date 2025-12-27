import * as vscode from "vscode";

export type AIProvider = "openai" | "anthropic" | "google";

export interface ExtensionSettings {
  provider: AIProvider;
  model: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  googleApiKey?: string;
}

const SECTION = "vscodeCodeReview";

export function getSettings(): ExtensionSettings {
  const cfg = vscode.workspace.getConfiguration(SECTION);

  return {
    provider: cfg.get<AIProvider>("provider", "anthropic"),
    model: cfg.get<string>("model", "claude-sonnet-4-20250514"),
    openaiApiKey: cfg.get<string>("openaiApiKey"),
    anthropicApiKey: cfg.get<string>("anthropicApiKey"),
    googleApiKey: cfg.get<string>("googleApiKey"),
  };
}

export function getApiKeyForProvider(provider: AIProvider): string | undefined {
  const s = getSettings();
  const raw =
    provider === "openai"
      ? s.openaiApiKey
      : provider === "anthropic"
        ? s.anthropicApiKey
        : s.googleApiKey;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}
