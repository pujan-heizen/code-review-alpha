import type { AIProvider } from "../config/settings";

export async function fetchModels(params: {
  provider: AIProvider;
  apiKey: string;
  abortSignal?: AbortSignal;
}): Promise<string[]> {
  switch (params.provider) {
    case "openai":
      return fetchOpenAIModels(params.apiKey, params.abortSignal);
    case "anthropic":
      return fetchAnthropicModels(params.apiKey, params.abortSignal);
    case "google":
      return fetchGoogleModels(params.apiKey, params.abortSignal);
  }
}

async function fetchOpenAIModels(apiKey: string, signal?: AbortSignal): Promise<string[]> {
  const res = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal,
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { data?: Array<{ id: string }> };
  const ids = (data.data ?? []).map((m) => m.id);
  return ids.sort();
}

async function fetchAnthropicModels(apiKey: string, signal?: AbortSignal): Promise<string[]> {
  const res = await fetch("https://api.anthropic.com/v1/models", {
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    signal,
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { data?: Array<{ id: string }> };
  return (data.data ?? []).map((m) => m.id).sort();
}

async function fetchGoogleModels(apiKey: string, signal?: AbortSignal): Promise<string[]> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
    signal,
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    models?: Array<{ name: string; supportedGenerationMethods?: string[] }>;
  };
  return (data.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => m.name.replace("models/", ""))
    .sort();
}
