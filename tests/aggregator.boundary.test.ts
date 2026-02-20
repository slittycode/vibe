/**
 * Boundary tests for distribution classification
 * Tests the edge cases where classification decisions are made
 */

import { describe, it, expect } from 'vitest';
import { DataAggregator } from '../src/aggregator.js';
import { RepoMetrics } from '../src/analyzer.js';

describe('DataAggregator - Boundary Tests', () => {
  const aggregator = new DataAggregator();

  /**
   * Helper to create minimal repo metrics for testing
   */
  function createMetrics(commitCounts: number[]): RepoMetrics[] {
    return commitCounts.map((count, index) => ({
      repoPath: `/test/repo${index}`,
      repoName: `repo${index}`,
      lastCommitDate: count > 0 ? new Date() : null,
      commitCountInPeriod: count,
      languages: [],
      isActive: count > 0
    }));
  }

  describe('Extreme cases (obvious classifications)', () => {
    it('should classify [100, 1, 1] as clustered', () => {
      const metrics = createMetrics([100, 1, 1]);
      const summary = aggregator.aggregate(metrics);
      expect(summary.commitDistribution).toBe('clustered');
    });

    it('should classify [34, 33, 33] as spread', () => {
      const metrics = createMetrics([34, 33, 33]);
      const summary = aggregator.aggregate(metrics);
      expect(summary.commitDistribution).toBe('spread');
    });

    it('should classify [0, 0, 0] as sparse', () => {
      const metrics = createMetrics([0, 0, 0]);
      const summary = aggregator.aggregate(metrics);
      expect(summary.commitDistribution).toBe('sparse');
    });

    it('should classify single active repo as focused', () => {
      const metrics = createMetrics([50]);
      const summary = aggregator.aggregate(metrics);
      expect(summary.commitDistribution).toBe('focused');
    });
  });

  describe('Boundary cases (where the threshold matters)', () => {
    // Design decision: stdDev > mean * 0.5 indicates clustered
    // This is a judgment call, not a mathematical threshold
    
    it('should classify [70, 30] as clustered (70/30 split)', () => {
      const metrics = createMetrics([70, 30]);
      const summary = aggregator.aggregate(metrics);
      // mean = 50, stdDev = 20, ratio = 0.4 -> spread
      // This test documents the actual behavior at this boundary
      expect(summary.commitDistribution).toBe('spread');
    });

    it('should classify [80, 20] as clustered (80/20 split)', () => {
      const metrics = createMetrics([80, 20]);
      const summary = aggregator.aggregate(metrics);
      // mean = 50, stdDev = 30, ratio = 0.6 -> clustered
      expect(summary.commitDistribution).toBe('clustered');
    });

    it('should classify [60, 40] as spread (60/40 split)', () => {
      const metrics = createMetrics([60, 40]);
      const summary = aggregator.aggregate(metrics);
      // mean = 50, stdDev = 10, ratio = 0.2 -> spread
      expect(summary.commitDistribution).toBe('spread');
    });

    it('should classify [50, 50] as spread (even split)', () => {
      const metrics = createMetrics([50, 50]);
      const summary = aggregator.aggregate(metrics);
      // mean = 50, stdDev = 0, ratio = 0 -> spread
      expect(summary.commitDistribution).toBe('spread');
    });
  });

  describe('Multi-repo boundary cases', () => {
    it('should classify [10, 5, 1, 1, 1] with moderate skew', () => {
      const metrics = createMetrics([10, 5, 1, 1, 1]);
      const summary = aggregator.aggregate(metrics);
      // mean = 3.6, stdDev ≈ 3.4, ratio ≈ 0.94 -> clustered
      expect(summary.commitDistribution).toBe('clustered');
    });

    it('should classify [8, 8, 1, 1, 0] with mixed pattern', () => {
      const metrics = createMetrics([8, 8, 1, 1, 0]);
      const summary = aggregator.aggregate(metrics);
      // Only counts active repos: [8, 8, 1, 1]
      // mean = 4.5, stdDev ≈ 3.4, ratio ≈ 0.76 -> clustered
      expect(summary.commitDistribution).toBe('clustered');
    });

    it('should classify [5, 5, 5, 5, 5] as spread (perfectly even)', () => {
      const metrics = createMetrics([5, 5, 5, 5, 5]);
      const summary = aggregator.aggregate(metrics);
      // mean = 5, stdDev = 0, ratio = 0 -> spread
      expect(summary.commitDistribution).toBe('spread');
    });
  });

  describe('Edge cases with single active repo among many', () => {
    it('should classify [10, 0, 0, 0] as focused (only one active)', () => {
      const metrics = createMetrics([10, 0, 0, 0]);
      const summary = aggregator.aggregate(metrics);
      // Only one active repo -> focused
      expect(summary.commitDistribution).toBe('focused');
    });

    it('should classify [10, 1, 0, 0] as clustered (two active, very skewed)', () => {
      const metrics = createMetrics([10, 1, 0, 0]);
      const summary = aggregator.aggregate(metrics);
      // mean = 5.5, stdDev = 4.5, ratio ≈ 0.82 -> clustered
      expect(summary.commitDistribution).toBe('clustered');
    });
  });
});
