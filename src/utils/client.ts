/**
 * Anthropic API client singleton with lazy initialization
 * Supports flexible model selection via environment variable
 */

import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

/**
 * Get or create the Anthropic API client (singleton pattern)
 */
export function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY environment variable is not set. Please set it before running."
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

/**
 * Get the Claude model to use for analysis
 * Defaults to Haiku 4.5 for cost efficiency
 * Can be overridden with MODEL_ID environment variable
 */
export function getModel(): string {
  const model = process.env.MODEL_ID || "claude-haiku-4-5-20251001";

  // Validate model format
  if (!model.includes("claude-")) {
    throw new Error(
      `Invalid MODEL_ID: "${model}". Must be a valid Claude model name.`
    );
  }

  return model;
}

/**
 * Reset client for testing purposes
 */
export function resetClient(): void {
  client = null;
}
