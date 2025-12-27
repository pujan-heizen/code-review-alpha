import type { LanguageModelV2 } from "@ai-sdk/provider";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { getApiKeyForProvider, getSettings, type AIProvider } from "../config/settings";

export interface ResolvedModel {
  provider: AIProvider;
  modelId: string;
  model: LanguageModelV2;
}

function providerLabel(provider: AIProvider): string {
  switch (provider) {
    case "openai":
      return "OpenAI";
    case "anthropic":
      return "Anthropic";
    case "google":
      return "Google";
  }
}

export async function resolveModel(): Promise<ResolvedModel> {
  const settings = getSettings();
  const apiKey = getApiKeyForProvider(settings.provider);

  if (!apiKey) {
    throw new Error(
      `${providerLabel(settings.provider)} API key is not set. Configure it in VS Code Settings: “Code Review”.`,
    );
  }

  const model = resolveLanguageModel(settings.provider, apiKey, settings.model);

  return {
    provider: settings.provider,
    modelId: settings.model,
    model,
  };
}

function resolveLanguageModel(
  provider: AIProvider,
  apiKey: string,
  modelId: string,
): LanguageModelV2 {
  switch (provider) {
    case "openai": {
      const openai = createOpenAI({ apiKey });
      type OpenAIResponsesModelId = Parameters<typeof openai.responses>[0];
      return openai.responses(
        modelId as unknown as OpenAIResponsesModelId,
      ) as unknown as LanguageModelV2;
    }
    case "anthropic":
      type AnthropicModelId = Parameters<ReturnType<typeof createAnthropic>>[0];
      return createAnthropic({ apiKey })(
        modelId as unknown as AnthropicModelId,
      ) as unknown as LanguageModelV2;
    case "google":
      type GoogleModelId = Parameters<ReturnType<typeof createGoogleGenerativeAI>>[0];
      return createGoogleGenerativeAI({ apiKey })(
        modelId as unknown as GoogleModelId,
      ) as unknown as LanguageModelV2;
  }
}
