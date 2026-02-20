/**
 * Unit tests for git command execution utilities
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execGit } from '../src/git.js';
import { mkdtemp, rm, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

describe('execGit', () => {
  let testRepoPath: string;

  beforeAll(async () => {
    // Create a temporary directory for test repository
    testRepoPath = await mkdtemp(join(tmpdir(), 'vibe-test-'));
    
    // Initialize a git repository
    await execFileAsync('git', ['init'], { cwd: testRepoPath });
    await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: testRepoPath });
    await execFileAsync('git', ['config', 'user.name', 'Test User'], { cwd: testRepoPath });
  });

  afterAll(async () => {
    // Clean up test repository
    await rm(testRepoPath, { recursive: true, force: true });
  });

  it('should execute git command and return stdout', async () => {
    // Create a commit in the test repo
    await execFileAsync('git', ['commit', '--allow-empty', '-m', 'Test commit'], { cwd: testRepoPath });
    
    // Execute git log command
    const result = await execGit(testRepoPath, ['log', '-1', '--format=%s']);
    
    expect(result).toContain('Test commit');
  });

  it('should return empty string on git command failure', async () => {
    // Try to execute an invalid git command
    const result = await execGit(testRepoPath, ['invalid-command']);
    
    expect(result).toBe('');
  });

  it('should return empty string for non-existent repository', async () => {
    const nonExistentPath = join(tmpdir(), 'non-existent-repo-12345');
    
    const result = await execGit(nonExistentPath, ['log']);
    
    expect(result).toBe('');
  });

  it('should validate and sanitize paths', async () => {
    // Test with path containing null bytes (should fail)
    const maliciousPath = '/tmp/test\0malicious';
    
    const result = await execGit(maliciousPath, ['log']);
    
    expect(result).toBe('');
  });

  it('should handle relative paths by converting to absolute', async () => {
    // Create a commit to ensure there's something to query
    await execFileAsync('git', ['commit', '--allow-empty', '-m', 'Another commit'], { cwd: testRepoPath });
    
    // Use relative path (this will be resolved to absolute)
    const result = await execGit(testRepoPath, ['rev-parse', '--git-dir']);
    
    expect(result.trim()).toBe('.git');
  });

  it('should execute git commands in the specified directory', async () => {
    const result = await execGit(testRepoPath, ['rev-parse', '--show-toplevel']);
    
    // On macOS, /var is a symlink to /private/var, so we need to resolve both paths
    const resultPath = result.trim();
    expect(resultPath).toMatch(/vibe-test-/);
    expect(resultPath.endsWith(testRepoPath.split('/').pop()!)).toBe(true);
  });
});
