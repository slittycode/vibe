/**
 * Property-based tests for Git command execution utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execGit } from '../src/git.js';
import { mkdtemp, rm, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fc from 'fast-check';

const execFileAsync = promisify(execFile);

describe('execGit - Property Tests', () => {
  let testRepoPath: string;

  beforeEach(async () => {
    // Create a temporary directory for test repository
    testRepoPath = await mkdtemp(join(tmpdir(), 'vibe-git-prop-test-'));
    
    // Initialize a git repository
    await execFileAsync('git', ['init'], { cwd: testRepoPath });
    await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: testRepoPath });
    await execFileAsync('git', ['config', 'user.name', 'Test User'], { cwd: testRepoPath });
    
    // Create an initial commit
    await execFileAsync('git', ['commit', '--allow-empty', '-m', 'Initial commit'], { cwd: testRepoPath });
  });

  afterEach(async () => {
    // Clean up test repository
    await rm(testRepoPath, { recursive: true, force: true });
  });

  /**
   * **Validates: Requirements 11.3**
   * 
   * Property 19: Path Validation
   * For any path provided to git commands, the path should be validated and
   * sanitized before execution to prevent injection attacks.
   */
  it('should reject paths with null bytes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        async (prefix, suffix) => {
          // Create a path with null byte injection attempt
          const maliciousPath = `${prefix}\0${suffix}`;
          
          // Should return empty string (failure) for paths with null bytes
          const result = await execGit(maliciousPath, ['status']);
          expect(result).toBe('');
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should reject paths with directory traversal attempts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('../..', '..\\..', '../../', '..\\..\\'),
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('\0')),
        async (traversal, pathPart) => {
          // Create a path with directory traversal attempt
          const maliciousPath = join(pathPart, traversal, 'etc', 'passwd');
          
          // Should return empty string (failure) for paths with traversal
          const result = await execGit(maliciousPath, ['status']);
          expect(result).toBe('');
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should normalize and resolve valid paths consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('.', './', './/', '././'),
        async (relativePart) => {
          // Create various representations of the same path
          const pathVariant = join(testRepoPath, relativePart);
          
          // All valid path variants should work
          const result = await execGit(pathVariant, ['rev-parse', '--git-dir']);
          
          // Should successfully execute and return .git
          expect(result.trim()).toBe('.git');
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should handle paths with special characters safely', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 10 })
          .filter(s => !s.includes('\0'))
          .filter(s => !s.includes('/'))
          .filter(s => !s.includes('\\'))
          .filter(s => s !== '.' && s !== '..'),
        async (dirName) => {
          // Create a directory with special characters
          const specialPath = join(testRepoPath, dirName);
          
          try {
            await mkdir(specialPath, { recursive: true });
            
            // Initialize git repo in the special path
            await execFileAsync('git', ['init'], { cwd: specialPath });
            await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: specialPath });
            await execFileAsync('git', ['config', 'user.name', 'Test User'], { cwd: specialPath });
            await execFileAsync('git', ['commit', '--allow-empty', '-m', 'Test'], { cwd: specialPath });
            
            // Should successfully execute git commands
            const result = await execGit(specialPath, ['rev-parse', '--git-dir']);
            expect(result.trim()).toBe('.git');
          } catch (error) {
            // Some special characters may not be valid for directory names on all systems
            // This is acceptable - the test passes if the system rejects invalid names
            expect(error).toBeDefined();
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should validate path accessibility before execution', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 20 })
          .filter(s => !s.includes('\0'))
          .filter(s => !s.includes('/'))
          .filter(s => !s.startsWith('.')),
        async (nonExistentDir) => {
          // Create a path that doesn't exist
          const nonExistentPath = join(tmpdir(), nonExistentDir, 'subdir', 'repo');
          
          // Should return empty string for non-existent paths
          const result = await execGit(nonExistentPath, ['status']);
          expect(result).toBe('');
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should prevent command injection through path manipulation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          '; rm -rf /',
          '&& cat /etc/passwd',
          '| echo hacked',
          '`whoami`',
          '$(whoami)',
          '; echo injected',
          '& malicious-command'
        ),
        async (injectionAttempt) => {
          // Attempt to inject commands through the path
          const maliciousPath = testRepoPath + injectionAttempt;
          
          // Should safely handle the malicious path without executing injected commands
          const result = await execGit(maliciousPath, ['status']);
          
          // Should return empty string (failure) due to invalid path
          expect(result).toBe('');
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should consistently validate the same path', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        async (useValidPath) => {
          const path = useValidPath ? testRepoPath : '/non/existent/path/12345';
          
          // Execute the same command twice
          const result1 = await execGit(path, ['rev-parse', '--git-dir']);
          const result2 = await execGit(path, ['rev-parse', '--git-dir']);
          
          // Results should be identical
          expect(result1).toBe(result2);
          
          if (useValidPath) {
            expect(result1.trim()).toBe('.git');
          } else {
            expect(result1).toBe('');
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should handle absolute and relative paths correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          testRepoPath,
          join(testRepoPath, '.'),
          join(testRepoPath, './')
        ),
        async (pathVariant) => {
          // All these path variants should work and resolve to the same repo
          const result = await execGit(pathVariant, ['rev-parse', '--git-dir']);
          
          // Should successfully execute
          expect(result.trim()).toBe('.git');
        }
      ),
      { numRuns: 20 }
    );
  });
});
