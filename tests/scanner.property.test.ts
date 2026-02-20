/**
 * Property-based tests for RepositoryScanner
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RepositoryScanner } from '../src/scanner.js';
import { mkdtemp, rm, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import fc from 'fast-check';

describe('RepositoryScanner - Property Tests', () => {
  let scanner: RepositoryScanner;
  let testDir: string;

  beforeEach(async () => {
    scanner = new RepositoryScanner();
    testDir = await mkdtemp(join(tmpdir(), 'vibe-prop-test-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  /**
   * **Validates: Requirements 3.1, 3.2, 3.7**
   * 
   * Property 1: Repository Scanning Completeness
   * For any directory tree, all directories containing .git should be discovered,
   * and no nested repositories should be included.
   */
  it('should discover all git repositories without nested repos', async () => {
    // Define a tree structure type
    type TreeNode = {
      name: string;
      isRepo: boolean;
      children: TreeNode[];
    };

    // Arbitrary for generating directory trees
    const treeNodeArbitrary = fc.letrec(tie => ({
      node: fc.record({
        name: fc.string({ minLength: 1, maxLength: 8 })
          .filter(s => !s.startsWith('.'))
          .filter(s => !s.includes('/'))
          .filter(s => s !== '.' && s !== '..'),
        isRepo: fc.boolean(),
        children: fc.oneof(
          fc.constant([]),
          fc.array(tie('node') as fc.Arbitrary<TreeNode>, { maxLength: 3 })
        )
      })
    })).node as fc.Arbitrary<TreeNode>;

    await fc.assert(
      fc.asyncProperty(
        fc.array(treeNodeArbitrary, { maxLength: 5 }),
        async (trees) => {
          // Clean test directory
          await rm(testDir, { recursive: true, force: true });
          testDir = await mkdtemp(join(tmpdir(), 'vibe-prop-test-'));

          const expectedRepos: string[] = [];
          const nestedRepos: string[] = [];

          // Helper to create directory structure
          const createTree = async (nodes: TreeNode[], parentPath: string, insideRepo: boolean) => {
            for (const node of nodes) {
              const nodePath = join(parentPath, node.name);
              await mkdir(nodePath, { recursive: true });

              if (node.isRepo) {
                await mkdir(join(nodePath, '.git'));
                
                if (insideRepo) {
                  // This is a nested repo, should NOT be found
                  nestedRepos.push(nodePath);
                } else {
                  // This is a top-level repo, should be found
                  expectedRepos.push(nodePath);
                }
                
                // Mark that we're now inside a repo
                await createTree(node.children, nodePath, true);
              } else {
                // Not a repo, continue with same insideRepo status
                await createTree(node.children, nodePath, insideRepo);
              }
            }
          };

          await createTree(trees, testDir, false);

          const repos = await scanner.scanRepos(testDir);

          // All expected repos should be found
          expect(repos.length).toBe(expectedRepos.length);
          for (const expected of expectedRepos) {
            expect(repos).toContain(expected);
          }

          // No nested repos should be found
          for (const nested of nestedRepos) {
            expect(repos).not.toContain(nested);
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * **Validates: Requirements 3.3, 3.4**
   * 
   * Property 2: Hidden Directory Exclusion
   * For any directory tree containing hidden directories or common non-code directories,
   * the scanner should skip these directories.
   */
  it('should skip hidden and non-code directories', async () => {
    // Test both hidden directories (starting with .) and common non-code directories
    const skipDirectories = [
      '.hidden', '.cache', '.git-internal', '.config', '.local',
      'node_modules', '.venv', 'venv', 'target', 'build', 'dist',
      '.next', '.nuxt', 'vendor', '__pycache__'
    ];

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...skipDirectories),
        fc.integer({ min: 1, max: 3 }), // Number of nested levels inside skip dir
        async (skipDir, nestingLevel) => {
          // Clean test directory
          await rm(testDir, { recursive: true, force: true });
          testDir = await mkdtemp(join(tmpdir(), 'vibe-prop-test-'));

          // Create a repo inside a skip directory at various nesting levels
          let currentPath = join(testDir, skipDir);
          await mkdir(currentPath, { recursive: true });

          // Create nested structure inside skip directory
          for (let i = 0; i < nestingLevel; i++) {
            currentPath = join(currentPath, `nested${i}`);
            await mkdir(currentPath, { recursive: true });
          }

          // Place a git repo at the deepest level
          await mkdir(join(currentPath, '.git'));

          const repos = await scanner.scanRepos(testDir);

          // Should not find any repos inside skip directories
          expect(repos.length).toBe(0);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * **Validates: Requirements 3.7**
   * 
   * Property 3: Absolute Path Return
   * All returned paths should be absolute paths.
   */
  it('should always return absolute paths', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 10 }).filter(s => !s.startsWith('.')), { minLength: 1, maxLength: 5 }),
        async (repoNames) => {
          // Clean test directory
          await rm(testDir, { recursive: true, force: true });
          testDir = await mkdtemp(join(tmpdir(), 'vibe-prop-test-'));

          // Create repos
          for (const name of repoNames) {
            const repoPath = join(testDir, name);
            await mkdir(repoPath, { recursive: true });
            await mkdir(join(repoPath, '.git'));
          }

          const repos = await scanner.scanRepos(testDir);

          // All paths should be absolute (start with /)
          for (const repo of repos) {
            expect(repo).toMatch(/^\//);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * **Validates: Requirements 3.1, 3.2**
   * 
   * Property 4: Scanning Idempotence
   * Running scanRepos twice on the same path should return the same results.
   */
  it('should return consistent results on repeated scans', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 10 }).filter(s => !s.startsWith('.')), { minLength: 0, maxLength: 5 }),
        async (repoNames) => {
          // Clean test directory
          await rm(testDir, { recursive: true, force: true });
          testDir = await mkdtemp(join(tmpdir(), 'vibe-prop-test-'));

          // Create repos
          for (const name of repoNames) {
            const repoPath = join(testDir, name);
            await mkdir(repoPath, { recursive: true });
            await mkdir(join(repoPath, '.git'));
          }

          const repos1 = await scanner.scanRepos(testDir);
          const repos2 = await scanner.scanRepos(testDir);

          // Results should be identical
          expect(repos1.length).toBe(repos2.length);
          expect(new Set(repos1)).toEqual(new Set(repos2));
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * **Validates: Requirements 3.2**
   * 
   * Property 5: No Nested Repository Discovery
   * When a git repository is found, no repositories inside it should be discovered.
   */
  it('should not discover nested repositories', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 3 }),
        async (nestingLevel) => {
          // Clean test directory
          await rm(testDir, { recursive: true, force: true });
          testDir = await mkdtemp(join(tmpdir(), 'vibe-prop-test-'));

          // Create nested repos
          let currentPath = testDir;
          for (let i = 0; i < nestingLevel; i++) {
            currentPath = join(currentPath, `level${i}`);
            await mkdir(currentPath, { recursive: true });
            await mkdir(join(currentPath, '.git'));
          }

          const repos = await scanner.scanRepos(testDir);

          // Should only find the first (outermost) repo
          expect(repos.length).toBe(1);
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * **Validates: Requirements 11.5**
   * 
   * Property 20: Symlink Safety
   * For any directory tree containing symlinks, the scanner should not follow
   * symlinks that lead outside the intended directory tree.
   */
  it('should not follow symlinks outside the directory tree', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 3 }), // Number of repos inside the tree
        fc.integer({ min: 1, max: 3 }), // Number of repos outside the tree
        async (insideRepoCount, outsideRepoCount) => {
          // Clean test directory
          await rm(testDir, { recursive: true, force: true });
          testDir = await mkdtemp(join(tmpdir(), 'vibe-prop-test-'));

          // Create a separate "outside" directory
          const outsideDir = await mkdtemp(join(tmpdir(), 'vibe-outside-'));

          try {
            // Create repos inside the test directory
            const insideRepos: string[] = [];
            for (let i = 0; i < insideRepoCount; i++) {
              const repoPath = join(testDir, `inside-repo-${i}`);
              await mkdir(repoPath, { recursive: true });
              await mkdir(join(repoPath, '.git'));
              insideRepos.push(repoPath);
            }

            // Create repos outside the test directory
            const outsideRepos: string[] = [];
            for (let i = 0; i < outsideRepoCount; i++) {
              const repoPath = join(outsideDir, `outside-repo-${i}`);
              await mkdir(repoPath, { recursive: true });
              await mkdir(join(repoPath, '.git'));
              outsideRepos.push(repoPath);
            }

            // Create symlinks inside testDir that point to outside repos
            const { symlink } = await import('fs/promises');
            for (let i = 0; i < outsideRepoCount; i++) {
              const linkPath = join(testDir, `link-to-outside-${i}`);
              try {
                await symlink(outsideRepos[i], linkPath, 'dir');
              } catch (error) {
                // Skip if symlink creation fails (e.g., on Windows without admin)
                console.warn(`Warning: Could not create symlink: ${(error as Error).message}`);
              }
            }

            const repos = await scanner.scanRepos(testDir);

            // Should only find repos that are actually inside testDir
            expect(repos.length).toBe(insideRepoCount);
            
            // All found repos should be inside testDir
            for (const repo of repos) {
              expect(repo.startsWith(testDir)).toBe(true);
            }

            // Should not find any outside repos
            for (const outsideRepo of outsideRepos) {
              expect(repos).not.toContain(outsideRepo);
            }
          } finally {
            // Clean up outside directory
            await rm(outsideDir, { recursive: true, force: true });
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
