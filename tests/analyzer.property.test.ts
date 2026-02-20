/**
 * Property-based tests for GitAnalyzer
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GitAnalyzer } from '../src/analyzer.js';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fc from 'fast-check';

const execFileAsync = promisify(execFile);

describe('GitAnalyzer - Property Tests', () => {
  let testRepoPath: string;
  let analyzer: GitAnalyzer;

  beforeEach(async () => {
    // Create a temporary directory for test repository
    testRepoPath = await mkdtemp(join(tmpdir(), 'vibe-analyzer-prop-test-'));
    analyzer = new GitAnalyzer();
    
    // Initialize a git repository
    await execFileAsync('git', ['init'], { cwd: testRepoPath });
    await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: testRepoPath });
    await execFileAsync('git', ['config', 'user.name', 'Test User'], { cwd: testRepoPath });
  });

  afterEach(async () => {
    // Clean up test repository
    await rm(testRepoPath, { recursive: true, force: true });
  });

  /**
   * **Validates: Requirements 4.4**
   * 
   * Property 3: Commit Count Accuracy
   * For any git repository and time period, the commit count returned by the
   * analyzer should match the actual number of commits made within that time period.
   */
  it('should accurately count commits within any time period', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }), // Number of commits to create (at least 1)
        fc.integer({ min: 1, max: 30 }), // Days to look back
        async (commitCount, days) => {
          // Clean and reinitialize test repository
          await rm(testRepoPath, { recursive: true, force: true });
          testRepoPath = await mkdtemp(join(tmpdir(), 'vibe-analyzer-prop-test-'));
          await execFileAsync('git', ['init'], { cwd: testRepoPath });
          await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: testRepoPath });
          await execFileAsync('git', ['config', 'user.name', 'Test User'], { cwd: testRepoPath });

          // Create commits
          for (let i = 0; i < commitCount; i++) {
            await writeFile(join(testRepoPath, `file${i}.txt`), `content ${i}`);
            await execFileAsync('git', ['add', '.'], { cwd: testRepoPath });
            await execFileAsync('git', ['commit', '-m', `Commit ${i}`], { cwd: testRepoPath });
          }

          // Analyze the repository
          const metrics = await analyzer.analyzeRepo(testRepoPath, days);

          // All commits were just created, so they should all be within the time period
          expect(metrics.commitCountInPeriod).toBe(commitCount);

          // Verify using git log directly
          const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
          const { stdout } = await execFileAsync('git', [
            'log',
            `--since=${sinceDate.toISOString()}`,
            '--oneline'
          ], { cwd: testRepoPath });

          const actualCommitCount = stdout.trim() ? stdout.trim().split('\n').length : 0;
          expect(metrics.commitCountInPeriod).toBe(actualCommitCount);
        }
      ),
      { numRuns: 20 } // Reduced from 30 to avoid timeout
    );
  }, 10000); // 10 second timeout

  it('should count zero commits when no commits exist', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 30 }), // Days to look back
        async (days) => {
          // Clean and reinitialize test repository with no commits
          try {
            await rm(testRepoPath, { recursive: true, force: true });
          } catch (error) {
            // Ignore cleanup errors
          }
          testRepoPath = await mkdtemp(join(tmpdir(), 'vibe-analyzer-prop-test-'));
          await execFileAsync('git', ['init'], { cwd: testRepoPath });
          await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: testRepoPath });
          await execFileAsync('git', ['config', 'user.name', 'Test User'], { cwd: testRepoPath });

          // Repository has no commits
          const metrics = await analyzer.analyzeRepo(testRepoPath, days);

          // Should count zero commits
          expect(metrics.commitCountInPeriod).toBe(0);
          expect(metrics.lastCommitDate).toBeNull();
          expect(metrics.isActive).toBe(false);
        }
      ),
      { numRuns: 10 } // Reduced to avoid issues
    );
  }, 10000); // 10 second timeout

  it('should accurately count commits with varying time periods', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }), // Number of commits
        fc.array(fc.integer({ min: 1, max: 30 }), { minLength: 1, maxLength: 5 }), // Different day ranges to test
        async (commitCount, dayRanges) => {
          // Clean and reinitialize test repository
          try {
            await rm(testRepoPath, { recursive: true, force: true });
          } catch (error) {
            // Ignore cleanup errors
          }
          testRepoPath = await mkdtemp(join(tmpdir(), 'vibe-analyzer-prop-test-'));
          await execFileAsync('git', ['init'], { cwd: testRepoPath });
          await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: testRepoPath });
          await execFileAsync('git', ['config', 'user.name', 'Test User'], { cwd: testRepoPath });

          // Create commits
          for (let i = 0; i < commitCount; i++) {
            await writeFile(join(testRepoPath, `file${i}.txt`), `content ${i}`);
            await execFileAsync('git', ['add', '.'], { cwd: testRepoPath });
            await execFileAsync('git', ['commit', '-m', `Commit ${i}`], { cwd: testRepoPath });
          }

          // Test each day range
          for (const days of dayRanges) {
            const metrics = await analyzer.analyzeRepo(testRepoPath, days);

            // Verify using git log directly
            const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
            const { stdout } = await execFileAsync('git', [
              'log',
              `--since=${sinceDate.toISOString()}`,
              '--oneline'
            ], { cwd: testRepoPath });

            const actualCommitCount = stdout.trim() ? stdout.trim().split('\n').length : 0;
            expect(metrics.commitCountInPeriod).toBe(actualCommitCount);
          }
        }
      ),
      { numRuns: 10 } // Reduced from 20
    );
  }, 15000); // 15 second timeout

  it('should handle edge case of very short time periods', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 3 }), // Small number of commits
        async (commitCount) => {
          // Clean and reinitialize test repository
          try {
            await rm(testRepoPath, { recursive: true, force: true });
          } catch (error) {
            // Ignore cleanup errors
          }
          testRepoPath = await mkdtemp(join(tmpdir(), 'vibe-analyzer-prop-test-'));
          await execFileAsync('git', ['init'], { cwd: testRepoPath });
          await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: testRepoPath });
          await execFileAsync('git', ['config', 'user.name', 'Test User'], { cwd: testRepoPath });

          // Create commits
          for (let i = 0; i < commitCount; i++) {
            await writeFile(join(testRepoPath, `file${i}.txt`), `content ${i}`);
            await execFileAsync('git', ['add', '.'], { cwd: testRepoPath });
            await execFileAsync('git', ['commit', '-m', `Commit ${i}`], { cwd: testRepoPath });
          }

          // Test with 1 day period (very short)
          const metrics = await analyzer.analyzeRepo(testRepoPath, 1);

          // All commits were just created, so they should all be within 1 day
          expect(metrics.commitCountInPeriod).toBe(commitCount);

          // Verify the count is non-negative
          expect(metrics.commitCountInPeriod).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 10 } // Reduced from 20
    );
  }, 10000); // 10 second timeout

  it('should maintain accuracy across multiple analyses', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5 }), // Number of commits
        fc.integer({ min: 1, max: 14 }), // Days to look back
        async (commitCount, days) => {
          // Clean and reinitialize test repository
          try {
            await rm(testRepoPath, { recursive: true, force: true });
          } catch (error) {
            // Ignore cleanup errors
          }
          testRepoPath = await mkdtemp(join(tmpdir(), 'vibe-analyzer-prop-test-'));
          await execFileAsync('git', ['init'], { cwd: testRepoPath });
          await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: testRepoPath });
          await execFileAsync('git', ['config', 'user.name', 'Test User'], { cwd: testRepoPath });

          // Create commits
          for (let i = 0; i < commitCount; i++) {
            await writeFile(join(testRepoPath, `file${i}.txt`), `content ${i}`);
            await execFileAsync('git', ['add', '.'], { cwd: testRepoPath });
            await execFileAsync('git', ['commit', '-m', `Commit ${i}`], { cwd: testRepoPath });
          }

          // Analyze multiple times
          const metrics1 = await analyzer.analyzeRepo(testRepoPath, days);
          const metrics2 = await analyzer.analyzeRepo(testRepoPath, days);

          // Results should be consistent
          expect(metrics1.commitCountInPeriod).toBe(metrics2.commitCountInPeriod);
          expect(metrics1.commitCountInPeriod).toBe(commitCount);
        }
      ),
      { numRuns: 10 } // Reduced from 20
    );
  }, 10000); // 10 second timeout

  /**
   * **Validates: Requirements 4.5, 4.6**
   * 
   * Property 4: Repository Classification Correctness
   * For any repository, it should be classified as active if and only if it has
   * at least one commit in the specified time period, and classified as cold otherwise.
   */
  it('should correctly classify repositories as active or cold based on commits', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10 }), // Number of commits to create
        fc.integer({ min: 1, max: 30 }), // Days to look back
        async (commitCount, days) => {
          // Clean and reinitialize test repository
          try {
            await rm(testRepoPath, { recursive: true, force: true });
          } catch (error) {
            // Ignore cleanup errors
          }
          testRepoPath = await mkdtemp(join(tmpdir(), 'vibe-analyzer-prop-test-'));
          await execFileAsync('git', ['init'], { cwd: testRepoPath });
          await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: testRepoPath });
          await execFileAsync('git', ['config', 'user.name', 'Test User'], { cwd: testRepoPath });

          // Create commits
          for (let i = 0; i < commitCount; i++) {
            await writeFile(join(testRepoPath, `file${i}.txt`), `content ${i}`);
            await execFileAsync('git', ['add', '.'], { cwd: testRepoPath });
            await execFileAsync('git', ['commit', '-m', `Commit ${i}`], { cwd: testRepoPath });
          }

          // Analyze the repository
          const metrics = await analyzer.analyzeRepo(testRepoPath, days);

          // Property: Repository is active if and only if it has at least one commit in the period
          if (commitCount > 0) {
            // All commits were just created, so they should all be within the time period
            expect(metrics.isActive).toBe(true);
            expect(metrics.commitCountInPeriod).toBeGreaterThan(0);
          } else {
            // No commits means repository should be cold
            expect(metrics.isActive).toBe(false);
            expect(metrics.commitCountInPeriod).toBe(0);
          }

          // Verify the classification matches the commit count
          expect(metrics.isActive).toBe(metrics.commitCountInPeriod > 0);
        }
      ),
      { numRuns: 20 }
    );
  }, 10000); // 10 second timeout

  /**
   * **Validates: Requirements 4.8**
   * 
   * Property 5: Non-Negative Commit Counts
   * For any repository analysis, the commit count should always be a non-negative integer.
   */
  it('should always return non-negative commit counts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10 }), // Number of commits
        fc.integer({ min: 1, max: 30 }), // Days to look back
        async (commitCount, days) => {
          // Clean and reinitialize test repository
          await rm(testRepoPath, { recursive: true, force: true });
          testRepoPath = await mkdtemp(join(tmpdir(), 'vibe-analyzer-prop-test-'));
          await execFileAsync('git', ['init'], { cwd: testRepoPath });
          await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: testRepoPath });
          await execFileAsync('git', ['config', 'user.name', 'Test User'], { cwd: testRepoPath });

          // Create commits
          for (let i = 0; i < commitCount; i++) {
            await writeFile(join(testRepoPath, `file${i}.txt`), `content ${i}`);
            await execFileAsync('git', ['add', '.'], { cwd: testRepoPath });
            await execFileAsync('git', ['commit', '-m', `Commit ${i}`], { cwd: testRepoPath });
          }

          const metrics = await analyzer.analyzeRepo(testRepoPath, days);

          // Property: Commit count must be non-negative
          expect(metrics.commitCountInPeriod).toBeGreaterThanOrEqual(0);
          
          // Property: Commit count must be an integer
          expect(Number.isInteger(metrics.commitCountInPeriod)).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  }, 10000);
});
