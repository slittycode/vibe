/**
 * Fallback provider chain for vibe-cli
 * Implements deterministic fallback between providers.
 */

import { WorkPatternSummary } from './aggregator.js';
import { validateSummaryGrounding } from './grounding.js';
import { SummaryProvider, ConcreteProviderType, FallbackOrder } from './providers.js';
import { OllamaProvider } from './ollama.js';

/**
 * Fallback chain configuration
 */
export interface FallbackConfig {
  /** Ordered list of providers to try */
  providers: ConcreteProviderType[];
  /** Whether to skip providers that aren't available */
  skipUnavailable?: boolean;
  /** Provider-specific configurations */
  configs?: Partial<Record<ConcreteProviderType, any>>;
  /** Enable verbose provider routing logs */
  debug?: boolean;
  /** Optional logger for provider routing logs */
  logger?: (line: string) => void;
  /** Internal test hook for provider creation */
  providerFactory?: (type: ConcreteProviderType, config?: any) => Promise<SummaryProvider>;
  /** Internal test hook for availability checks */
  availabilityProbe?: (type: ConcreteProviderType) => Promise<ProviderAvailabilityResult>;
}

export interface ProviderAvailabilityResult {
  available: boolean;
  reason?: string;
}

/**
 * Returns a deterministic provider chain based on fallback order.
 */
export function getFallbackChain(order: FallbackOrder): ConcreteProviderType[] {
  if (order === 'local-first') {
    return ['ollama', 'bedrock', 'template'];
  }

  return ['bedrock', 'ollama', 'template'];
}

/**
 * FallbackProvider implements deterministic provider routing with grounded-output checks.
 */
export class FallbackProvider implements SummaryProvider {
  private providerCache = new Map<ConcreteProviderType, SummaryProvider>();
  private providerOrder: ConcreteProviderType[];
  private skipUnavailable: boolean;
  private debug: boolean;
  private logger?: (line: string) => void;
  private providerFactory: (type: ConcreteProviderType, config?: any) => Promise<SummaryProvider>;
  private availabilityProbe: (type: ConcreteProviderType) => Promise<ProviderAvailabilityResult>;
  private configs?: Partial<Record<ConcreteProviderType, any>>;
  private decisionLog: string[] = [];

  constructor(config: FallbackConfig) {
    this.providerOrder = [...config.providers];
    this.skipUnavailable = config.skipUnavailable ?? true;
    this.debug = config.debug ?? false;
    this.logger = config.logger;
    this.configs = config.configs;
    this.providerFactory = config.providerFactory ?? this.defaultProviderFactory.bind(this);
    this.availabilityProbe = config.availabilityProbe ?? this.defaultAvailabilityProbe.bind(this);
  }

  /**
   * Returns provider routing decisions from the most recent generation call.
   */
  getDecisionLog(): string[] {
    return [...this.decisionLog];
  }

  /**
   * Creates concrete providers using the shared provider factory.
   */
  private async defaultProviderFactory(type: ConcreteProviderType, config?: any): Promise<SummaryProvider> {
    const { ProviderFactory } = await import('./providers.js');
    return ProviderFactory.create(type, config);
  }

  /**
   * Checks if a provider is currently available and returns explicit reasons.
   */
  private async defaultAvailabilityProbe(type: ConcreteProviderType): Promise<ProviderAvailabilityResult> {
    switch (type) {
      case 'ollama':
        if (await OllamaProvider.isAvailable()) {
          return { available: true };
        }
        return { available: false, reason: 'ollama is unavailable: service not running or no models installed' };

      case 'bedrock':
        // Check if AWS credentials are available
        if (
          (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ||
          process.env.AWS_PROFILE
        ) {
          return { available: true };
        }
        return { available: false, reason: 'bedrock is unavailable: missing AWS credentials or AWS_PROFILE' };

      case 'template':
        // Template provider is always available
        return { available: true };

      default:
        return { available: false, reason: `unknown provider: ${type}` };
    }
  }

  private recordDecision(provider: ConcreteProviderType, decision: string, reason: string): void {
    const line = `[provider-fallback] provider=${provider} decision=${decision} reason=${reason}`;
    this.decisionLog.push(line);
    if (this.debug && this.logger) {
      this.logger(line);
    }
  }

  private async getProvider(type: ConcreteProviderType): Promise<SummaryProvider> {
    if (this.providerCache.has(type)) {
      return this.providerCache.get(type)!;
    }

    const provider = await this.providerFactory(type, this.configs?.[type]);
    this.providerCache.set(type, provider);
    return provider;
  }

  private normalizeError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  /**
   * Generate summary using deterministic provider fallback with grounding checks.
   */
  async generateVibeCheck(summary: WorkPatternSummary): Promise<string> {
    this.decisionLog = [];
    const errors: string[] = [];

    for (const providerType of this.providerOrder) {
      let availability: ProviderAvailabilityResult;
      try {
        availability = await this.availabilityProbe(providerType);
      } catch (error) {
        const reason = `availability probe failed: ${this.normalizeError(error)}`;
        this.recordDecision(providerType, 'availability-check-failed', reason);
        errors.push(`${providerType}: ${reason}`);
        if (!this.skipUnavailable) {
          throw new Error(`Provider availability check failed for ${providerType}: ${reason}`);
        }
        continue;
      }

      if (!availability.available) {
        const reason = availability.reason || `${providerType} is unavailable`;
        this.recordDecision(providerType, 'skipped-unavailable', reason);
        errors.push(`${providerType}: ${reason}`);
        if (!this.skipUnavailable) {
          throw new Error(`Provider ${providerType} is unavailable: ${reason}`);
        }
        continue;
      }

      let provider: SummaryProvider;
      try {
        provider = await this.getProvider(providerType);
      } catch (error) {
        const reason = `provider initialization failed: ${this.normalizeError(error)}`;
        this.recordDecision(providerType, 'initialization-failed', reason);
        errors.push(`${providerType}: ${reason}`);
        continue;
      }

      this.recordDecision(providerType, 'attempt', 'trying provider');

      try {
        const generatedSummary = await provider.generateVibeCheck(summary);
        const groundingResult = validateSummaryGrounding(generatedSummary, summary);
        if (!groundingResult.valid) {
          throw new Error(`grounding check failed: ${groundingResult.reasons.join('; ')}`);
        }

        this.recordDecision(providerType, 'success', 'provider returned grounded summary');
        return generatedSummary.trim();
      } catch (error) {
        const reason = this.normalizeError(error);
        this.recordDecision(providerType, 'fallback', reason);
        errors.push(`${providerType}: ${reason}`);
      }
    }

    const reasonText = errors.length > 0 ? errors.join(' | ') : 'no providers configured';
    throw new Error(`All providers failed. ${reasonText}`);
  }

  /**
   * Get information about available providers
   */
  async getProviderInfo(): Promise<{ type: ConcreteProviderType; available: boolean; error?: string }[]> {
    const info: { type: ConcreteProviderType; available: boolean; error?: string }[] = [];

    const providerTypes: ConcreteProviderType[] = ['ollama', 'bedrock', 'template'];

    for (const type of providerTypes) {
      try {
        const availability = await this.availabilityProbe(type);
        info.push({ type, available: availability.available, error: availability.reason });
      } catch (error) {
        info.push({ type, available: false, error: (error as Error).message });
      }
    }

    return info;
  }
}
