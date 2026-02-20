/**
 * Ollama provider for vibe-cli
 * Generates AI summaries using local LLM models via Ollama
 */

import { WorkPatternSummary } from './aggregator.js';

/**
 * Ollama configuration interface
 */
export interface OllamaConfig {
  /** Base URL for Ollama API (default: http://localhost:11434) */
  baseUrl?: string;
  /** Model name to use (default: auto-detect) */
  model?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/**
 * Ollama model information
 */
export interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
}

/**
 * OllamaClient generates summaries using local LLM models
 */
export class OllamaProvider {
  private baseUrl: string;
  private model: string | null = null;
  private timeout: number;

  constructor(config: OllamaConfig = {}) {
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.timeout = config.timeout || 30000;
    this.model = config.model || null;
  }

  /**
   * Generates a casual summary using Ollama
   * @param summary - Work pattern summary to generate text from
   * @returns Generated casual summary text
   */
  async generateVibeCheck(summary: WorkPatternSummary): Promise<string> {
    // Auto-detect model if not specified
    if (!this.model) {
      await this.detectModel();
    }

    if (!this.model) {
      throw new Error('No Ollama models available. Please run: ollama pull <model-name>');
    }

    const prompt = this.buildPrompt(summary);
    
    try {
      const response = await this.makeRequest('/api/generate', {
        model: this.model,
        prompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 200
        }
      });

      return response.response.trim();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Ollama API error: ${error.message}`);
      }
      throw new Error('Unknown Ollama API error');
    }
  }

  /**
   * Detects available models and selects the best one
   */
  private async detectModel(): Promise<void> {
    try {
      const models = await this.listModels();
      
      // Preferred models in order of preference
      const preferredModels = [
        'llama3.2',
        'llama3.1',
        'llama3',
        'mistral',
        'mixtral',
        'qwen2.5',
        'phi3',
        'gemma2'
      ];

      // Find first available preferred model
      for (const preferred of preferredModels) {
        const available = models.find(model => 
          model.name.toLowerCase().includes(preferred.toLowerCase())
        );
        if (available) {
          this.model = available.name;
          return;
        }
      }

      // Fallback to first available model
      if (models.length > 0) {
        this.model = models[0].name;
      }
    } catch (error) {
      // Ollama might not be running
      throw new Error('Failed to connect to Ollama. Make sure Ollama is running with: ollama serve');
    }
  }

  /**
   * Lists available models from Ollama
   */
  private async listModels(): Promise<OllamaModel[]> {
    const response = await this.makeRequest('/api/tags');
    return response.models || [];
  }

  /**
   * Makes HTTP request to Ollama API
   */
  private async makeRequest(endpoint: string, data?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        method: data ? 'POST' : 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        body: data ? JSON.stringify(data) : undefined,
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout after ${this.timeout}ms`);
        }
        if (error.message.includes('ECONNREFUSED')) {
          throw new Error('Cannot connect to Ollama. Is Ollama running? Start with: ollama serve');
        }
      }
      throw error;
    }
  }

  /**
   * Builds the prompt for the LLM based on work pattern summary
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

  /**
   * Checks if Ollama is available and running
   */
  static async isAvailable(): Promise<boolean> {
    try {
      const provider = new OllamaProvider();
      await provider.listModels();
      return true;
    } catch {
      return false;
    }
  }
}
