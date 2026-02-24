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
export type ConcreteProviderType = Exclude<ProviderType, 'auto'>;
export type FallbackOrder = 'cloud-first' | 'local-first';

/**
 * Shared options for provider creation.
 */
export interface ProviderCreateOptions {
  region?: string;
  modelId?: string;
  baseUrl?: string;
  model?: string;
  timeout?: number;
  fallbackOrder?: FallbackOrder;
  debugProvider?: boolean;
  providerLogger?: (line: string) => void;
}

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
  static async create(type: ProviderType, config?: ProviderCreateOptions): Promise<SummaryProvider> {
    switch (type) {
      case 'bedrock':
        return new BedrockAdapter(config?.region, config?.modelId);

      case 'template':
        return new TemplateAdapter();

      case 'ollama':
        const { OllamaProvider } = await import('./ollama.js');
        return new OllamaProvider({
          baseUrl: config?.baseUrl,
          model: config?.model,
          timeout: config?.timeout
        });

      case 'auto':
        const { FallbackProvider, getFallbackChain } = await import('./fallback.js');
        const fallbackOrder: FallbackOrder = config?.fallbackOrder === 'local-first' ? 'local-first' : 'cloud-first';

        return new FallbackProvider({
          providers: getFallbackChain(fallbackOrder),
          configs: {
            bedrock: { region: config?.region, modelId: config?.modelId },
            ollama: {
              baseUrl: config?.baseUrl,
              model: config?.model,
              timeout: config?.timeout
            }
          },
          debug: config?.debugProvider ?? false,
          logger: config?.providerLogger
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
  private region?: string;
  private modelId?: string;

  constructor(region?: string, modelId?: string) {
    this.region = region;
    this.modelId = modelId;

    // Import dynamically to avoid circular dependencies
    import('./bedrock.js').then(({ BedrockClient }) => {
      this.bedrockClient = new BedrockClient(region, modelId);
    });
  }

  async generateVibeCheck(summary: WorkPatternSummary): Promise<string> {
    if (!this.bedrockClient) {
      const { BedrockClient } = await import('./bedrock.js');
      this.bedrockClient = new BedrockClient(this.region, this.modelId);
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
