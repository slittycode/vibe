/**
 * Regression tests for summary grounding guardrails.
 */

import { describe, it, expect } from 'vitest';
import type { WorkPatternSummary } from '../src/aggregator.js';
import { validateSummaryGrounding } from '../src/grounding.js';

const summaryFixture: WorkPatternSummary = {
  totalRepos: 4,
  activeRepos: 2,
  coldRepos: 2,
  totalCommits: 12,
  commitDistribution: 'focused',
  topLanguages: [
    { language: 'TypeScript', percentage: 80 },
    { language: 'Python', percentage: 20 }
  ],
  mostActiveRepos: ['vibe', 'infra-scripts'],
  timeRange: {
    start: new Date('2026-02-01T00:00:00.000Z'),
    end: new Date('2026-02-08T00:00:00.000Z')
  }
};

describe('Summary grounding guardrails', () => {
  it('accepts grounded narrative tied to known git facts', () => {
    const result = validateSummaryGrounding(
      'This week had 12 commits across 4 repos, with most of the momentum in vibe and mostly TypeScript changes.',
      summaryFixture
    );

    expect(result.valid).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('rejects summaries that hallucinate commit hashes', () => {
    const result = validateSummaryGrounding(
      'Strong progress with commit a1b2c3d merged late in the week.',
      summaryFixture
    );

    expect(result.valid).toBe(false);
    expect(result.reasons.some(reason => reason.includes('commit hash'))).toBe(true);
  });

  it('rejects summaries that hallucinate file paths', () => {
    const result = validateSummaryGrounding(
      'You made solid changes in src/main.ts and src/providers.ts this week.',
      summaryFixture
    );

    expect(result.valid).toBe(false);
    expect(result.reasons.some(reason => reason.includes('file path'))).toBe(true);
  });

  it('rejects ungrounded numeric claims not present in git facts', () => {
    const result = validateSummaryGrounding(
      'A huge burst of 30 commits landed in this period.',
      summaryFixture
    );

    expect(result.valid).toBe(false);
    expect(result.reasons.some(reason => reason.includes('30'))).toBe(true);
  });

  it('rejects narratives with no detectable grounding to observed facts', () => {
    const result = validateSummaryGrounding(
      'Steady progress and healthy momentum across the board.',
      summaryFixture
    );

    expect(result.valid).toBe(false);
    expect(result.reasons.some(reason => reason.includes('grounded fact'))).toBe(true);
  });
});
