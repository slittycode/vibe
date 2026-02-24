/**
 * AWS Bedrock client for vibe-cli
 * Generates AI summaries using Claude via AWS Bedrock
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { WorkPatternSummary } from './aggregator.js';
import { buildGroundedPrompt, validateSummaryGrounding } from './grounding.js';

/**
 * BedrockClient generates casual summaries using Claude via AWS Bedrock
 */
export class BedrockClient {
  private client: BedrockRuntimeClient;
  private modelId: string;

  /**
   * Creates a new BedrockClient
   * @param region - AWS region (defaults to us-east-1)
   * @param modelId - Bedrock model ID (defaults to Claude 3.5 Haiku)
   */
  constructor(region: string = 'us-east-1', modelId: string = 'us.anthropic.claude-3-5-haiku-20241022-v1:0') {
    this.client = new BedrockRuntimeClient({ region });
    this.modelId = modelId;
  }

  /**
   * Generates a casual vibe check summary using Claude via Bedrock
   * @param summary - Work pattern summary to generate text from
   * @returns Generated casual summary text
   */
  async generateVibeCheck(summary: WorkPatternSummary): Promise<string> {
    const prompt = this.buildPrompt(summary);

    const payload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    };

    try {
      const command = new InvokeModelCommand({
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload)
      });

      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      // Validate response structure before processing (Requirement 11.6)
      if (!responseBody.content || !Array.isArray(responseBody.content) || responseBody.content.length === 0) {
        throw new Error('No content in Bedrock response');
      }

      const textContent = responseBody.content[0].text;
      if (typeof textContent !== 'string' || textContent.length === 0) {
        throw new Error('Invalid or empty text in Bedrock response');
      }

      const groundingResult = validateSummaryGrounding(textContent, summary, {
        requireGroundedFact: false
      });
      if (!groundingResult.valid) {
        throw new Error(`Ungrounded Bedrock summary: ${groundingResult.reasons.join('; ')}`);
      }

      return textContent.trim();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error calling Bedrock API: ${error.message}`);
      }
      throw new Error('Unknown error calling Bedrock API');
    }
  }

  /**
   * Builds the prompt for Claude based on work pattern summary
   * @param summary - Work pattern summary
   * @returns Formatted prompt string
   */
  private buildPrompt(summary: WorkPatternSummary): string {
    return buildGroundedPrompt(summary);
  }
}
