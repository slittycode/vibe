/**
 * Property-based tests for CLI execution
 * Validates correctness properties for successful execution output
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { main } from '../src/main.js';
import { RepositoryScanner } from '../src/scanner.js';
import { GitAnalyzer } from '../src/analyzer.js';
import { BedrockClient } from '../src/bedrock.js';
import type { RepoMetrics } from '../src/analyzer.js';

describe('CLI Execution - Property Tests', () => {
  let exitSpy: any;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let scanReposSpy: any;
  let analyzeRepoSpy: any;
  let generateVibeCheckSpy: any;

  beforeEach(() => {
    // Mock process.exit
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    
    // Mock console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock environment variables
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_ACCESS_KEY_ID = 'test-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
  });

  afterEach(() => {
    exitSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    
    if (scanReposSpy) scanReposSpy.mockRestore();
    if (analyzeRepoSpy) analyzeRepoSpy.mockRestore();
    if (generateVibeCheckSpy) generateVibeCheckSpy.mockRestore();
    
    // Clean up environment
    delete process.env.AWS_REGION;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
  });

  /**
   * Property 17: Successful Execution Output
   * Validates: Requirements 1.5, 1.6, 8.1
   * 
   * For any successful execution:
   * - The generated summary MUST be output to stdout (console.log)
   * - The process MUST exit with code 0
   * - No errors MUST be output to stderr (console.error)
   */
  it('should output summary to stdout and exit with code 0 on success', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random repository metrics
        fc.array(
          fc.record({
            repoPath: fc.string({ minLength: 1 }),
            repoName: fc.string({ minLength: 1 }),
            lastCommitDate: fc.option(fc.date(), { nil: null }),
            commitCountInPeriod: fc.nat({ max: 100 }),
            languages: fc.array(
              fc.record({
                language: fc.constantFrom('TypeScript', 'JavaScript', 'Python', 'Java'),
                percentage: fc.integer({ min: 1, max: 100 })
              }),
              { maxLength: 3 }
            ),
            isActive: fc.boolean()
          }),
          { minLength: 1, maxLength: 5 }
        ),
        // Generate random AI summary text
        fc.string({ minLength: 10, maxLength: 500 }),
        // Generate random days value
        fc.integer({ min: 1, max: 30 }),
        async (metrics: RepoMetrics[], summaryText: string, days: number) => {
          // Reset spies for each property test iteration
          exitSpy.mockClear();
          consoleLogSpy.mockClear();
          consoleErrorSpy.mockClear();

          // Mock scanner to return repository paths
          const repoPaths = metrics.map(m => m.repoPath);
          scanReposSpy = vi.spyOn(RepositoryScanner.prototype, 'scanRepos')
            .mockResolvedValue(repoPaths);

          // Mock analyzer to return metrics
          analyzeRepoSpy = vi.spyOn(GitAnalyzer.prototype, 'analyzeRepo')
            .mockImplementation(async (repoPath: string) => {
              const metric = metrics.find(m => m.repoPath === repoPath);
              return metric || metrics[0];
            });

          // Mock Bedrock client to return summary
          generateVibeCheckSpy = vi.spyOn(BedrockClient.prototype, 'generateVibeCheck')
            .mockResolvedValue(summaryText);

          // Execute main function
          await main(['node', 'vibe', '--days', days.toString(), '--root', '/test/path']);

          // PROPERTY: Summary must be output to stdout
          expect(consoleLogSpy).toHaveBeenCalledWith(summaryText);

          // PROPERTY: Process must exit with code 0
          expect(exitSpy).toHaveBeenCalledWith(0);

          // PROPERTY: No errors should be output to stderr
          expect(consoleErrorSpy).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 50 } // Run 50 random test cases
    );
  });

  /**
   * Property 17b: Successful Execution Output (Raw Mode)
   * Validates: Requirements 1.6, 8.2
   * 
   * For any successful execution in raw mode:
   * - The metrics MUST be output to stdout in key=value format
   * - The process MUST exit with code 0
   * - No errors MUST be output to stderr
   */
  it('should output raw metrics to stdout and exit with code 0 in raw mode', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random repository metrics
        fc.array(
          fc.record({
            repoPath: fc.string({ minLength: 1 }),
            repoName: fc.string({ minLength: 1 }),
            lastCommitDate: fc.option(fc.date(), { nil: null }),
            commitCountInPeriod: fc.nat({ max: 100 }),
            languages: fc.array(
              fc.record({
                language: fc.constantFrom('TypeScript', 'JavaScript', 'Python'),
                percentage: fc.integer({ min: 1, max: 100 })
              }),
              { maxLength: 3 }
            ),
            isActive: fc.boolean()
          }),
          { minLength: 1, maxLength: 5 }
        ),
        // Generate random days value
        fc.integer({ min: 1, max: 30 }),
        async (metrics: RepoMetrics[], days: number) => {
          // Reset spies for each property test iteration
          exitSpy.mockClear();
          consoleLogSpy.mockClear();
          consoleErrorSpy.mockClear();

          // Mock scanner to return repository paths
          const repoPaths = metrics.map(m => m.repoPath);
          scanReposSpy = vi.spyOn(RepositoryScanner.prototype, 'scanRepos')
            .mockResolvedValue(repoPaths);

          // Mock analyzer to return metrics
          analyzeRepoSpy = vi.spyOn(GitAnalyzer.prototype, 'analyzeRepo')
            .mockImplementation(async (repoPath: string) => {
              const metric = metrics.find(m => m.repoPath === repoPath);
              return metric || metrics[0];
            });

          // Execute main function in raw mode
          await main(['node', 'vibe', '--days', days.toString(), '--root', '/test/path', '--raw']);

          // PROPERTY: Raw metrics must be output to stdout
          expect(consoleLogSpy).toHaveBeenCalled();
          
          // Verify key=value format
          const outputCalls = consoleLogSpy.mock.calls.map((call: any) => call[0]);
          const hasKeyValueFormat = outputCalls.some((output: string) => 
            /^[a-z_]+=[^=]+$/.test(output)
          );
          expect(hasKeyValueFormat).toBe(true);

          // PROPERTY: Process must exit with code 0
          expect(exitSpy).toHaveBeenCalledWith(0);

          // PROPERTY: No errors should be output to stderr
          expect(consoleErrorSpy).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 50 } // Run 50 random test cases
    );
  });

  /**
   * Property 17c: Successful Execution with No Repositories
   * Validates: Requirements 1.6, 9.4
   * 
   * When no repositories are found:
   * - A message MUST be output to stdout
   * - The process MUST exit with code 0 (not an error)
   * - No errors MUST be output to stderr
   */
  it('should output message and exit with code 0 when no repositories found', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 30 }),
        async (days: number) => {
          // Reset spies
          exitSpy.mockClear();
          consoleLogSpy.mockClear();
          consoleErrorSpy.mockClear();

          // Mock scanner to return empty array
          scanReposSpy = vi.spyOn(RepositoryScanner.prototype, 'scanRepos')
            .mockResolvedValue([]);

          // Execute main function
          await main(['node', 'vibe', '--days', days.toString(), '--root', '/test/path']);

          // PROPERTY: Message must be output to stdout
          expect(consoleLogSpy).toHaveBeenCalledWith('No git repositories found.');

          // PROPERTY: Process must exit with code 0
          expect(exitSpy).toHaveBeenCalledWith(0);

          // PROPERTY: No errors should be output to stderr
          expect(consoleErrorSpy).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 18: Error Output Routing
   * Validates: Requirements 8.3, 8.4
   * 
   * For any error condition:
   * - Error messages MUST be output to stderr (console.error), not stdout
   * - The process MUST exit with code 1
   * - No output MUST be sent to stdout (console.log)
   */
  it('should output errors to stderr and exit with code 1 on error', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random error scenarios
        fc.constantFrom(
          'Root path does not exist',
          'Bedrock API error',
          'Scanner error'
        ),
        fc.integer({ min: 1, max: 30 }),
        async (errorType: string, days: number) => {
          // Reset spies
          exitSpy.mockClear();
          consoleLogSpy.mockClear();
          consoleErrorSpy.mockClear();

          // Create error condition based on error type
          if (errorType === 'Root path does not exist') {
            // Mock scanner to throw error
            scanReposSpy = vi.spyOn(RepositoryScanner.prototype, 'scanRepos')
              .mockRejectedValue(new Error('Root path does not exist'));
          } else if (errorType === 'Bedrock API error') {
            // Mock scanner and analyzer to succeed
            scanReposSpy = vi.spyOn(RepositoryScanner.prototype, 'scanRepos')
              .mockResolvedValue(['/test/repo']);
            
            analyzeRepoSpy = vi.spyOn(GitAnalyzer.prototype, 'analyzeRepo')
              .mockResolvedValue({
                repoPath: '/test/repo',
                repoName: 'test-repo',
                lastCommitDate: new Date(),
                commitCountInPeriod: 5,
                languages: [{ language: 'TypeScript', percentage: 100 }],
                isActive: true
              });
            
            // Mock Bedrock to throw error
            generateVibeCheckSpy = vi.spyOn(BedrockClient.prototype, 'generateVibeCheck')
              .mockRejectedValue(new Error('Bedrock API error'));
          } else {
            // Scanner error
            scanReposSpy = vi.spyOn(RepositoryScanner.prototype, 'scanRepos')
              .mockRejectedValue(new Error('Scanner error'));
          }

          // Execute main function
          await main(['node', 'vibe', '--days', days.toString(), '--root', '/test/path']);

          // PROPERTY: Error message must be output to stderr
          expect(consoleErrorSpy).toHaveBeenCalled();
          
          // Verify error message contains "Error:"
          const errorCalls = consoleErrorSpy.mock.calls.map((call: any) => call[0]);
          const hasErrorPrefix = errorCalls.some((msg: string) => 
            typeof msg === 'string' && msg.startsWith('Error:')
          );
          expect(hasErrorPrefix).toBe(true);

          // PROPERTY: Process must exit with code 1
          expect(exitSpy).toHaveBeenCalledWith(1);

          // PROPERTY: No output should be sent to stdout
          expect(consoleLogSpy).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 30 } // Run 30 random test cases across different error types
    );
  });

  /**
   * Property 18b: Error Output Routing (Invalid Arguments)
   * Validates: Requirements 1.5, 8.4
   * 
   * When invalid command-line arguments are provided:
   * - Error messages MUST be output to stderr
   * - The process MUST exit with code 1
   */
  it('should output argument errors to stderr and exit with code 1', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate invalid days values (non-positive integers)
        fc.integer({ max: 0 }),
        async (invalidDays: number) => {
          // Reset spies
          exitSpy.mockClear();
          consoleLogSpy.mockClear();
          consoleErrorSpy.mockClear();

          // Execute main function with invalid days
          await main(['node', 'vibe', '--days', invalidDays.toString()]);

          // PROPERTY: Error message must be output to stderr
          expect(consoleErrorSpy).toHaveBeenCalled();
          
          // Verify error message mentions days
          const errorCalls = consoleErrorSpy.mock.calls.map((call: any) => call[0]);
          const hasDaysError = errorCalls.some((msg: string) => 
            typeof msg === 'string' && msg.includes('days')
          );
          expect(hasDaysError).toBe(true);

          // PROPERTY: Process must exit with code 1
          expect(exitSpy).toHaveBeenCalledWith(1);
        }
      ),
      { numRuns: 20 }
    );
  });
});
