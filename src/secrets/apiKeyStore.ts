import * as vscode from "vscode";
import { AIProvider } from "../config/settings";

function secretKey(provider: AIProvider): string {
  return `vscodeCodeReview.apiKey.${provider}`;
}

export class ApiKeyStore {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  async get(provider: AIProvider): Promise<string | undefined> {
    const value = await this.secrets.get(secretKey(provider));
    return value ?? undefined;
  }

  async has(provider: AIProvider): Promise<boolean> {
    return (await this.get(provider)) !== undefined;
  }

  async set(provider: AIProvider, apiKey: string): Promise<void> {
    const trimmed = apiKey.trim();
    if (!trimmed) throw new Error("API key cannot be empty.");
    await this.secrets.store(secretKey(provider), trimmed);
  }

  async clear(provider: AIProvider): Promise<void> {
    await this.secrets.delete(secretKey(provider));
  }
}
