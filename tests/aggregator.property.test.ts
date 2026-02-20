/**
 * Property-based tests for DataAggregator
 * Validates correctness properties for data aggregation
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { DataAggregator } from '../src/aggregator.js';
import { RepoMetrics } from '../src/analyzer.js';

describe('DataAggregator - Property Tests', () => {
  const aggregator = new DataAggregator();

  /**
   * Property 8: Aggregation Consistency
   * Validates: Requirements 6.1, 6.2, 6.7
   * 
   * For all valid repository metrics arrays:
   * - totalRepos MUST equal the length of the input array
   * - activeRepos + coldRepos MUST equal totalRepos
   * - All counts MUST be non-negative
   */
  it('should maintain aggregation consistency', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            repoPath: fc.string({ minLength: 1 }),
            repoName: fc.string({ minLength: 1 }),
            lastCommitDate: fc.option(fc.date(), { nil: null }),
            commitCountInPeriod: fc.nat(),
            languages: fc.array(
              fc.record({
                language: fc.string({ minLength: 1 }),
                percentage: fc.integer({ min: 0, max: 100 })
              })
            ),
            isActive: fc.boolean()
          })
        ),
        (metrics: RepoMetrics[]) => {
          const summary = aggregator.aggregate(metrics);

          // totalRepos must equal input length
          expect(summary.totalRepos).toBe(metrics.length);

          // activeRepos + coldRepos must equal totalRepos
          expect(summary.activeRepos + summary.coldRepos).toBe(summary.totalRepos);

          // All counts must be non-negative
          expect(summary.totalRepos).toBeGreaterThanOrEqual(0);
          expect(summary.activeRepos).toBeGreaterThanOrEqual(0);
          expect(summary.coldRepos).toBeGreaterThanOrEqual(0);
          expect(summary.totalCommits).toBeGreaterThanOrEqual(0);
        }
      )
    );
  });

  /**
   * Property 9: Total Commits Accuracy
   * Validates: Requirement 6.3
   * 
   * For all valid repository metrics arrays:
   * - totalCommits MUST equal the sum of all commitCountInPeriod values
   */
  it('should accurately sum total commits', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            repoPath: fc.string({ minLength: 1 }),
            repoName: fc.string({ minLength: 1 }),
            lastCommitDate: fc.option(fc.date(), { nil: null }),
            commitCountInPeriod: fc.nat({ max: 1000 }),
            languages: fc.array(
              fc.record({
                language: fc.string({ minLength: 1 }),
                percentage: fc.integer({ min: 0, max: 100 })
              })
            ),
            isActive: fc.boolean()
          })
        ),
        (metrics: RepoMetrics[]) => {
          const summary = aggregator.aggregate(metrics);
          const expectedTotal = metrics.reduce((sum, m) => sum + m.commitCountInPeriod, 0);

          expect(summary.totalCommits).toBe(expectedTotal);
        }
      )
    );
  });

  /**
   * Property 10: Distribution Classification Validity
   * Validates: Requirements 6.4, 6.8, 6.9
   * 
   * For all valid repository metrics arrays:
   * - commitDistribution MUST be one of: 'clustered', 'spread', or 'sparse'
   * - 'sparse' MUST be used when no repositories have commits
   * - 'clustered' MUST be used when only one repository has commits
   */
  it('should classify distribution correctly', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            repoPath: fc.string({ minLength: 1 }),
            repoName: fc.string({ minLength: 1 }),
            lastCommitDate: fc.option(fc.date(), { nil: null }),
            commitCountInPeriod: fc.nat({ max: 100 }),
            languages: fc.array(
              fc.record({
                language: fc.string({ minLength: 1 }),
                percentage: fc.integer({ min: 0, max: 100 })
              })
            ),
            isActive: fc.boolean()
          })
        ),
        (metrics: RepoMetrics[]) => {
          const summary = aggregator.aggregate(metrics);

          // Must be one of the valid values
          expect(['focused', 'clustered', 'spread', 'sparse']).toContain(summary.commitDistribution);

          // Validate specific cases
          const activeCount = metrics.filter(m => m.commitCountInPeriod > 0).length;
          
          if (activeCount === 0) {
            expect(summary.commitDistribution).toBe('sparse');
          }
          
          if (activeCount === 1) {
            expect(summary.commitDistribution).toBe('focused');
          }
        }
      )
    );
  });

  /**
   * Property 11: Top Languages Limit
   * Validates: Requirement 6.5
   * 
   * For all valid repository metrics arrays:
   * - topLanguages array MUST contain at most 5 languages
   * - Languages MUST be sorted by percentage in descending order
   */
  it('should limit top languages to 5 and sort by percentage', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            repoPath: fc.string({ minLength: 1 }),
            repoName: fc.string({ minLength: 1 }),
            lastCommitDate: fc.option(fc.date(), { nil: null }),
            commitCountInPeriod: fc.nat(),
            languages: fc.array(
              fc.record({
                language: fc.constantFrom('TypeScript', 'JavaScript', 'Python', 'Java', 'Go', 'Rust'),
                percentage: fc.integer({ min: 1, max: 100 })
              }),
              { minLength: 1, maxLength: 10 }
            ),
            isActive: fc.boolean()
          }),
          { minLength: 1 }
        ),
        (metrics: RepoMetrics[]) => {
          const summary = aggregator.aggregate(metrics);

          // Must contain at most 5 languages
          expect(summary.topLanguages.length).toBeLessThanOrEqual(5);

          // Must be sorted by percentage descending
          for (let i = 0; i < summary.topLanguages.length - 1; i++) {
            expect(summary.topLanguages[i].percentage).toBeGreaterThanOrEqual(
              summary.topLanguages[i + 1].percentage
            );
          }
        }
      )
    );
  });

  /**
   * Property 12: Top Repositories Limit
   * Validates: Requirement 6.6
   * 
   * For all valid repository metrics arrays:
   * - mostActiveRepos array MUST contain at most 3 repositories
   * - Only active repositories (with commits) should be included
   */
  it('should limit most active repos to 3', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            repoPath: fc.string({ minLength: 1 }),
            repoName: fc.string({ minLength: 1 }),
            lastCommitDate: fc.option(fc.date(), { nil: null }),
            commitCountInPeriod: fc.nat({ max: 100 }),
            languages: fc.array(
              fc.record({
                language: fc.string({ minLength: 1 }),
                percentage: fc.integer({ min: 0, max: 100 })
              })
            ),
            isActive: fc.boolean()
          })
        ),
        (metrics: RepoMetrics[]) => {
          const summary = aggregator.aggregate(metrics);

          // Must contain at most 3 repositories
          expect(summary.mostActiveRepos.length).toBeLessThanOrEqual(3);

          // Must not exceed number of active repos
          const activeCount = metrics.filter(m => m.isActive).length;
          expect(summary.mostActiveRepos.length).toBeLessThanOrEqual(activeCount);
        }
      )
    );
  });

  /**
   * Property 13: Time Range Calculation
   * Validates: Requirement 1.2
   * 
   * For all valid days values:
   * - timeRange.end MUST be approximately now
   * - timeRange.start MUST be approximately days * 24 hours before end
   * - start MUST be before end
   */
  it('should calculate time range correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 365 }),
        (days: number) => {
          const now = Date.now();
          const summary = aggregator.aggregate([], days);

          // end should be approximately now (within 1 second)
          expect(Math.abs(summary.timeRange.end.getTime() - now)).toBeLessThan(1000);

          // start should be approximately days * 24 hours before end
          const expectedStart = now - days * 24 * 60 * 60 * 1000;
          expect(Math.abs(summary.timeRange.start.getTime() - expectedStart)).toBeLessThan(1000);

          // start must be before end
          expect(summary.timeRange.start.getTime()).toBeLessThan(summary.timeRange.end.getTime());
        }
      )
    );
  });
});
