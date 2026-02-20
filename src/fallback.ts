/**
 * Fallback provider chain for vibe-cli
 * Implements intelligent fallback between providers
 */

import { WorkPatternSummary } from './aggregator.js';
import { SummaryProvider, ProviderType } from './providers.js';
import { OllamaProvider } from './ollama.js';

/**
 * Fallback chain configuration
 */
export interface FallbackConfig {
  /** Ordered list of providers to try */
  providers: ProviderType[];
  /** Whether to skip providers that aren't available */
  skipUnavailable?: boolean;
  /** Provider-specific configurations */
  configs?: Partial<Record<ProviderType, any>>;
}

/**
 * FallbackProvider implements intelligent provider selection
 */
export class FallbackProvider implements SummaryProvider {
  private providers: SummaryProvider[] = [];
  private skipUnavailable: boolean;
  private initialized: Promise<void>;

  constructor(config: FallbackConfig) {
    this.skipUnavailable = config.skipUnavailable ?? true;
    this.initialized = this.initializeProviders(config);
  }

  /**
   * Initialize providers based on configuration
   */
  private async initializeProviders(config: FallbackConfig): Promise<void> {
    const { ProviderFactory } = await import('./providers.js');

    for (const providerType of config.providers) {
      try {
        // Check if provider is available before creating it
        if (await this.isProviderAvailable(providerType)) {
          const provider = await ProviderFactory.create(providerType, config.configs?.[providerType]);
          this.providers.push(provider);
        } else if (!this.skipUnavailable) {
          throw new Error(`Provider ${providerType} is not available`);
        }
      } catch (error) {
        if (!this.skipUnavailable) {
          throw new Error(`Failed to initialize provider ${providerType}: ${(error as Error).message}`);
        }
        // Skip this provider and continue
      }
    }

    if (this.providers.length === 0) {
      throw new Error('No providers available. Please check your configuration.');
    }
  }

  /**
   * Check if a provider is available
   */
  private async isProviderAvailable(type: ProviderType): Promise<boolean> {
    switch (type) {
      case 'ollama':
        return await OllamaProvider.isAvailable();

      case 'bedrock':
        // Check if AWS credentials are available
        return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ||
          !!process.env.AWS_PROFILE;

      case 'template':
        // Template provider is always available
        return true;

      default:
        return false;
    }
  }

  /**
   * Generate summary using available providers with fallback
   */
  async generateVibeCheck(summary: WorkPatternSummary): Promise<string> {
    await this.initialized;

    const errors: Error[] = [];

    for (const provider of this.providers) {
      try {
        return await provider.generateVibeCheck(summary);
      } catch (error) {
        errors.push(error as Error);
        // Try next provider
        continue;
      }
    }

    // All providers failed
    throw new Error(
      `All providers failed. Errors: ${errors.map(e => e.message).join('; ')}`
    );
  }

  /**
   * Get information about available providers
   */
  async getProviderInfo(): Promise<{ type: ProviderType; available: boolean; error?: string }[]> {
    await this.initialized;

    const info: { type: ProviderType; available: boolean; error?: string }[] = [];

    const providerTypes: ProviderType[] = ['ollama', 'bedrock', 'template'];

    for (const type of providerTypes) {
      try {
        const available = await this.isProviderAvailable(type);
        info.push({ type, available });
      } catch (error) {
        info.push({ type, available: false, error: (error as Error).message });
      }
    }

    return info;
  }
}
