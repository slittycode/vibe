/**
 * Unit tests for RepositoryScanner
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RepositoryScanner } from '../src/scanner.js';
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('RepositoryScanner', () => {
  let scanner: RepositoryScanner;
  let testDir: string;

  beforeEach(async () => {
    scanner = new RepositoryScanner();
    // Create a temporary directory for testing
    testDir = await mkdtemp(join(tmpdir(), 'vibe-test-'));
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  it('should find a single git repository', async () => {
    // Create a git repo
    const repoPath = join(testDir, 'repo1');
    await mkdir(repoPath);
    await mkdir(join(repoPath, '.git'));

    const repos = await scanner.scanRepos(testDir);

    expect(repos).toHaveLength(1);
    expect(repos[0]).toBe(repoPath);
  });

  it('should find multiple git repositories', async () => {
    // Create multiple repos
    const repo1 = join(testDir, 'repo1');
    const repo2 = join(testDir, 'repo2');
    await mkdir(repo1);
    await mkdir(join(repo1, '.git'));
    await mkdir(repo2);
    await mkdir(join(repo2, '.git'));

    const repos = await scanner.scanRepos(testDir);

    expect(repos).toHaveLength(2);
    expect(repos).toContain(repo1);
    expect(repos).toContain(repo2);
  });

  it('should find nested repositories in subdirectories', async () => {
    // Create nested structure
    const subdir = join(testDir, 'projects');
    const repo1 = join(subdir, 'repo1');
    await mkdir(subdir);
    await mkdir(repo1);
    await mkdir(join(repo1, '.git'));

    const repos = await scanner.scanRepos(testDir);

    expect(repos).toHaveLength(1);
    expect(repos[0]).toBe(repo1);
  });

  it('should not scan inside git repositories (skip nested repos)', async () => {
    // Create a repo with a nested repo inside
    const outerRepo = join(testDir, 'outer');
    const innerRepo = join(outerRepo, 'inner');
    await mkdir(outerRepo);
    await mkdir(join(outerRepo, '.git'));
    await mkdir(innerRepo);
    await mkdir(join(innerRepo, '.git'));

    const repos = await scanner.scanRepos(testDir);

    // Should only find outer repo, not inner
    expect(repos).toHaveLength(1);
    expect(repos[0]).toBe(outerRepo);
  });

  it('should skip hidden directories', async () => {
    // Create hidden directory with a repo
    const hiddenDir = join(testDir, '.hidden');
    const repo = join(hiddenDir, 'repo');
    await mkdir(hiddenDir);
    await mkdir(repo);
    await mkdir(join(repo, '.git'));

    const repos = await scanner.scanRepos(testDir);

    // Should not find repo in hidden directory
    expect(repos).toHaveLength(0);
  });

  it('should skip node_modules directory', async () => {
    // Create node_modules with a repo
    const nodeModules = join(testDir, 'node_modules');
    const repo = join(nodeModules, 'some-package');
    await mkdir(nodeModules);
    await mkdir(repo);
    await mkdir(join(repo, '.git'));

    const repos = await scanner.scanRepos(testDir);

    // Should not find repo in node_modules
    expect(repos).toHaveLength(0);
  });

  it('should return empty array when no repositories found', async () => {
    // Create some directories but no git repos
    await mkdir(join(testDir, 'dir1'));
    await mkdir(join(testDir, 'dir2'));

    const repos = await scanner.scanRepos(testDir);

    expect(repos).toHaveLength(0);
  });

  it('should return absolute paths', async () => {
    // Create a repo
    const repoPath = join(testDir, 'repo1');
    await mkdir(repoPath);
    await mkdir(join(repoPath, '.git'));

    const repos = await scanner.scanRepos(testDir);

    expect(repos[0]).toBe(repoPath);
    expect(repos[0]).toMatch(/^\//); // Unix absolute path
  });

  it('should handle empty directory', async () => {
    const repos = await scanner.scanRepos(testDir);
    expect(repos).toHaveLength(0);
  });

  it('should skip common non-code directories', async () => {
    // Create various non-code directories with repos
    const skipDirs = ['node_modules', '.venv', 'target', 'build', 'dist'];
    
    for (const dirName of skipDirs) {
      const dir = join(testDir, dirName);
      const repo = join(dir, 'repo');
      await mkdir(dir);
      await mkdir(repo);
      await mkdir(join(repo, '.git'));
    }

    const repos = await scanner.scanRepos(testDir);

    // Should not find any repos in skip directories
    expect(repos).toHaveLength(0);
  });
});
