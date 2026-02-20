/**
 * AWS Bedrock client for vibe-cli
 * Generates AI summaries using Claude via AWS Bedrock
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { WorkPatternSummary } from './aggregator.js';

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

      return textContent;
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
    // Describe the distribution pattern in natural language
    let distributionDesc = '';
    switch (summary.commitDistribution) {
      case 'focused':
        distributionDesc = 'focused on a single repository';
        break;
      case 'clustered':
        distributionDesc = 'concentrated in a few repositories';
        break;
      case 'spread':
        distributionDesc = 'spread evenly across repositories';
        break;
      case 'sparse':
        distributionDesc = 'sparse with minimal activity';
        break;
    }

    return `You're reviewing a developer's week of coding activity. Here's what happened:

- Total repositories: ${summary.totalRepos}
- Active repos (with commits): ${summary.activeRepos}
- Cold repos (no commits): ${summary.coldRepos}
- Total commits: ${summary.totalCommits}
- Commit pattern: ${distributionDesc}
- Top languages: ${summary.topLanguages.map(l => l.language).join(', ')}
- Most active repos: ${summary.mostActiveRepos.join(', ')}

Write a casual, friendly 3-4 sentence summary of how this week of work is looking. Make it feel like a journal entry, not a report. Be conversational and observant about the patterns you see.`;
  }
}
