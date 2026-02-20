/**
 * Unit tests for GitAnalyzer
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GitAnalyzer } from '../src/analyzer.js';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

describe('GitAnalyzer', () => {
  let testRepoPath: string;
  let analyzer: GitAnalyzer;

  beforeEach(async () => {
    // Create a temporary directory for test repository
    testRepoPath = await mkdtemp(join(tmpdir(), 'vibe-analyzer-test-'));
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

  it('should analyze repository with no commits', async () => {
    const metrics = await analyzer.analyzeRepo(testRepoPath, 7);

    expect(metrics.repoPath).toBe(testRepoPath);
    expect(metrics.repoName).toBe(testRepoPath.split('/').pop());
    expect(metrics.lastCommitDate).toBeNull();
    expect(metrics.commitCountInPeriod).toBe(0);
    expect(metrics.isActive).toBe(false);
    expect(metrics.languages).toEqual([]);
  });

  it('should analyze repository with one commit', async () => {
    // Create a commit
    await writeFile(join(testRepoPath, 'test.txt'), 'test content');
    await execFileAsync('git', ['add', '.'], { cwd: testRepoPath });
    await execFileAsync('git', ['commit', '-m', 'Initial commit'], { cwd: testRepoPath });

    const metrics = await analyzer.analyzeRepo(testRepoPath, 7);

    expect(metrics.repoPath).toBe(testRepoPath);
    expect(metrics.lastCommitDate).toBeInstanceOf(Date);
    expect(metrics.commitCountInPeriod).toBe(1);
    expect(metrics.isActive).toBe(true);
  });

  it('should count multiple commits in period', async () => {
    // Create multiple commits
    for (let i = 0; i < 3; i++) {
      await writeFile(join(testRepoPath, `file${i}.txt`), `content ${i}`);
      await execFileAsync('git', ['add', '.'], { cwd: testRepoPath });
      await execFileAsync('git', ['commit', '-m', `Commit ${i}`], { cwd: testRepoPath });
    }

    const metrics = await analyzer.analyzeRepo(testRepoPath, 7);

    expect(metrics.commitCountInPeriod).toBe(3);
    expect(metrics.isActive).toBe(true);
  });

  it('should detect languages in repository', async () => {
    // Create files with different extensions
    await writeFile(join(testRepoPath, 'test.ts'), 'const x = 1;');
    await writeFile(join(testRepoPath, 'test.js'), 'var y = 2;');
    await execFileAsync('git', ['add', '.'], { cwd: testRepoPath });
    await execFileAsync('git', ['commit', '-m', 'Add code files'], { cwd: testRepoPath });

    const metrics = await analyzer.analyzeRepo(testRepoPath, 7);

    expect(metrics.languages.length).toBeGreaterThan(0);
    expect(metrics.languages.some(l => l.language === 'TypeScript' || l.language === 'JavaScript')).toBe(true);
  });

  it('should handle repository with subdirectories', async () => {
    // Create nested directory structure
    const srcDir = join(testRepoPath, 'src');
    await mkdir(srcDir);
    await writeFile(join(srcDir, 'index.ts'), 'export const main = () => {};');
    await writeFile(join(testRepoPath, 'README.md'), '# Test');
    
    await execFileAsync('git', ['add', '.'], { cwd: testRepoPath });
    await execFileAsync('git', ['commit', '-m', 'Add structure'], { cwd: testRepoPath });

    const metrics = await analyzer.analyzeRepo(testRepoPath, 7);

    expect(metrics.commitCountInPeriod).toBe(1);
    expect(metrics.isActive).toBe(true);
    expect(metrics.languages.some(l => l.language === 'TypeScript')).toBe(true);
  });

  it('should return non-negative commit counts', async () => {
    const metrics = await analyzer.analyzeRepo(testRepoPath, 7);
    expect(metrics.commitCountInPeriod).toBeGreaterThanOrEqual(0);
  });

  it('should derive repo name from path', async () => {
    const metrics = await analyzer.analyzeRepo(testRepoPath, 7);
    const expectedName = testRepoPath.split('/').pop() || testRepoPath.split('\\').pop();
    expect(metrics.repoName).toBe(expectedName);
  });
});
