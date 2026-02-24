/**
 * Regression tests for deterministic provider fallback routing.
 */

import { describe, it, expect, vi } from 'vitest';
import type { WorkPatternSummary } from '../src/aggregator.js';
import type { ConcreteProviderType, SummaryProvider } from '../src/providers.js';
import { FallbackProvider, getFallbackChain } from '../src/fallback.js';

const summaryFixture: WorkPatternSummary = {
  totalRepos: 3,
  activeRepos: 2,
  coldRepos: 1,
  totalCommits: 9,
  commitDistribution: 'clustered',
  topLanguages: [{ language: 'TypeScript', percentage: 70 }],
  mostActiveRepos: ['api-service', 'web-app'],
  timeRange: {
    start: new Date('2026-02-01T00:00:00.000Z'),
    end: new Date('2026-02-08T00:00:00.000Z')
  }
};

function providerFor(
  providerType: ConcreteProviderType,
  callOrder: ConcreteProviderType[],
  behavior: 'success' | 'fail'
): SummaryProvider {
  return {
    async generateVibeCheck(): Promise<string> {
      callOrder.push(providerType);
      if (behavior === 'fail') {
        throw new Error(`${providerType} failed`);
      }
      return 'Grounded weekly summary: 9 commits across 3 repos, mostly in api-service.';
    }
  };
}

describe('FallbackProvider routing', () => {
  it('uses deterministic local-first fallback order: ollama -> bedrock -> template', async () => {
    const callOrder: ConcreteProviderType[] = [];

    const providerFactory = vi.fn(async (type: ConcreteProviderType) => {
      if (type === 'template') {
        return providerFor(type, callOrder, 'success');
      }
      return providerFor(type, callOrder, 'fail');
    });

    const fallbackProvider = new FallbackProvider({
      providers: getFallbackChain('local-first'),
      providerFactory,
      availabilityProbe: async () => ({ available: true })
    });

    const result = await fallbackProvider.generateVibeCheck(summaryFixture);

    expect(result).toContain('9 commits');
    expect(callOrder).toEqual(['ollama', 'bedrock', 'template']);
  });

  it('uses deterministic cloud-first fallback order: bedrock -> ollama -> template', async () => {
    const callOrder: ConcreteProviderType[] = [];

    const providerFactory = vi.fn(async (type: ConcreteProviderType) => {
      if (type === 'template') {
        return providerFor(type, callOrder, 'success');
      }
      return providerFor(type, callOrder, 'fail');
    });

    const fallbackProvider = new FallbackProvider({
      providers: getFallbackChain('cloud-first'),
      providerFactory,
      availabilityProbe: async () => ({ available: true })
    });

    await fallbackProvider.generateVibeCheck(summaryFixture);

    expect(callOrder).toEqual(['bedrock', 'ollama', 'template']);
  });

  it('logs explicit fallback reasons for unavailable and failed providers', async () => {
    const logs: string[] = [];

    const providerFactory = vi.fn(async (type: ConcreteProviderType) => {
      if (type === 'bedrock') {
        return {
          async generateVibeCheck(): Promise<string> {
            throw new Error('bedrock request timed out');
          }
        };
      }

      return {
        async generateVibeCheck(): Promise<string> {
          return 'Grounded weekly summary: 9 commits across 3 repos, mostly in api-service.';
        }
      };
    });

    const fallbackProvider = new FallbackProvider({
      providers: ['ollama', 'bedrock', 'template'],
      providerFactory,
      availabilityProbe: async (type: ConcreteProviderType) => {
        if (type === 'ollama') {
          return { available: false, reason: 'ollama is unavailable: service not running' };
        }
        return { available: true };
      },
      debug: true,
      logger: (line: string) => {
        logs.push(line);
      }
    });

    await fallbackProvider.generateVibeCheck(summaryFixture);

    expect(logs.some(line => line.includes('ollama is unavailable: service not running'))).toBe(true);
    expect(logs.some(line => line.includes('bedrock request timed out'))).toBe(true);
    expect(logs.some(line => line.includes('provider=template') && line.includes('success'))).toBe(true);
  });
});
