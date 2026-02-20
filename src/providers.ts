/**
 * AI provider abstraction layer for vibe-cli
 * Defines common interface for different summary generation methods
 */

import { WorkPatternSummary } from './aggregator.js';

/**
 * Common interface for summary providers
 */
export interface SummaryProvider {
  /**
   * Generates a casual summary based on work pattern data
   * @param summary - Work pattern summary to generate text from
   * @returns Generated casual summary text
   */
  generateVibeCheck(summary: WorkPatternSummary): Promise<string>;
}

/**
 * Provider types for configuration
 */
export type ProviderType = 'bedrock' | 'template' | 'ollama' | 'auto';

/**
 * Factory for creating summary providers
 */
export class ProviderFactory {
  /**
   * Creates a summary provider based on type and configuration
   * @param type - Provider type
   * @param config - Provider-specific configuration
   * @returns Configured summary provider
   */
  static async create(type: ProviderType, config?: any): Promise<SummaryProvider> {
    switch (type) {
      case 'bedrock':
        const { BedrockClient } = await import('./bedrock.js');
        return new BedrockAdapter(config?.region, config?.modelId);

      case 'template':
        const { TemplateProvider } = await import('./template.js');
        return new TemplateAdapter();

      case 'ollama':
        const { OllamaProvider } = await import('./ollama.js');
        return new OllamaProvider(config);

      case 'auto':
        const { FallbackProvider } = await import('./fallback.js');
        return new FallbackProvider({
          providers: ['ollama', 'bedrock', 'template'],
          configs: {
            bedrock: { region: config?.region, modelId: config?.modelId },
            ollama: config
          }
        });

      default:
        throw new Error(`Unknown provider type: ${type}`);
    }
  }
}

/**
 * Adapter for BedrockClient to match SummaryProvider interface
 */
class BedrockAdapter implements SummaryProvider {
  private bedrockClient: any;

  constructor(region?: string, modelId?: string) {
    // Import dynamically to avoid circular dependencies
    import('./bedrock.js').then(({ BedrockClient }) => {
      this.bedrockClient = new BedrockClient(region, modelId);
    });
  }

  async generateVibeCheck(summary: WorkPatternSummary): Promise<string> {
    if (!this.bedrockClient) {
      const { BedrockClient } = await import('./bedrock.js');
      this.bedrockClient = new BedrockClient();
    }
    return this.bedrockClient.generateVibeCheck(summary);
  }
}

/**
 * Adapter for TemplateProvider to match SummaryProvider interface
 */
class TemplateAdapter implements SummaryProvider {
  private templateProvider: any;

  constructor() {
    // Import dynamically to avoid circular dependencies
    import('./template.js').then(({ TemplateProvider }) => {
      this.templateProvider = new TemplateProvider();
    });
  }

  async generateVibeCheck(summary: WorkPatternSummary): Promise<string> {
    if (!this.templateProvider) {
      const { TemplateProvider } = await import('./template.js');
      this.templateProvider = new TemplateProvider();
    }
    // Template provider is synchronous, wrap in Promise for interface consistency
    return Promise.resolve(this.templateProvider.generateVibeCheck(summary));
  }
}
