/**
 * Integration test for end-to-end vibe-cli workflow
 * **Validates: Requirements 1.5, 8.1**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const execFileAsync = promisify(execFile);

describe('Integration: End-to-End Workflow', () => {
  let testRoot: string;
  let originalApiKey: string | undefined;

  beforeEach(async () => {
    // Create temporary test directory
    testRoot = await mkdtemp(join(tmpdir(), 'vibe-test-'));
    
    // Set dummy API key for testing (mocking Claude API)
    originalApiKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-api-key-for-integration-tests';
  });

  afterEach(async () => {
    // Clean up temporary directory
    await rm(testRoot, { recursive: true, force: true });
    
    // Restore original API key
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
  });

  /**
   * Helper function to initialize a git repository with commits
   */
  async function createTestRepo(repoName: string, commitCount: number): Promise<string> {
    const repoPath = join(testRoot, repoName);
    await mkdir(repoPath, { recursive: true });

    // Initialize git repo
    await execFileAsync('git', ['init'], { cwd: repoPath });
    await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: repoPath });
    await execFileAsync('git', ['config', 'user.name', 'Test User'], { cwd: repoPath });

    // Create commits
    for (let i = 0; i < commitCount; i++) {
      const fileName = `file${i}.txt`;
      await writeFile(join(repoPath, fileName), `Content ${i}`);
      await execFileAsync('git', ['add', fileName], { cwd: repoPath });
      await execFileAsync('git', ['commit', '-m', `Commit ${i}`], { cwd: repoPath });
    }

    return repoPath;
  }

  /**
   * Helper function to create a test repo with specific language files
   */
  async function createTestRepoWithLanguages(
    repoName: string,
    languages: Record<string, number>
  ): Promise<string> {
    const repoPath = join(testRoot, repoName);
    await mkdir(repoPath, { recursive: true });

    // Initialize git repo
    await execFileAsync('git', ['init'], { cwd: repoPath });
    await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: repoPath });
    await execFileAsync('git', ['config', 'user.name', 'Test User'], { cwd: repoPath });

    // Create language files
    const extensionMap: Record<string, string> = {
      TypeScript: '.ts',
      JavaScript: '.js',
      Python: '.py',
      Java: '.java',
      Go: '.go',
    };

    let fileIndex = 0;
    for (const [language, count] of Object.entries(languages)) {
      const ext = extensionMap[language] || '.txt';
      for (let i = 0; i < count; i++) {
        const fileName = `file${fileIndex}${ext}`;
        await writeFile(join(repoPath, fileName), `// ${language} content`);
        fileIndex++;
      }
    }

    // Commit all files
    await execFileAsync('git', ['add', '.'], { cwd: repoPath });
    await execFileAsync('git', ['commit', '-m', 'Initial commit'], { cwd: repoPath });

    return repoPath;
  }

  it('should complete end-to-end workflow with active repositories', async () => {
    // Create test repositories
    await createTestRepo('active-repo-1', 5);
    await createTestRepo('active-repo-2', 3);
    await createTestRepo('cold-repo', 0);

    // Run vibe CLI with --raw flag to get structured output
    const { stdout, stderr } = await execFileAsync(
      'node',
      ['dist/index.js', '--root', testRoot, '--days', '7', '--raw']
    );

    // Verify output contains expected metrics in raw format
    expect(stdout).toContain('total_repos=3');
    expect(stdout).toContain('active_repos=2');
    expect(stdout).toContain('cold_repos=1');
    expect(stdout).toContain('total_commits=8');
    
    // Warnings for repos with no commits are expected in stderr
    expect(stderr).toContain('Warning: Git command failed');
  }, 30000); // 30 second timeout for git operations

  it('should handle directory with no repositories', async () => {
    // Create empty directory
    const emptyDir = join(testRoot, 'empty');
    await mkdir(emptyDir, { recursive: true });

    // Run vibe CLI
    const { stdout } = await execFileAsync(
      'node',
      ['dist/index.js', '--root', emptyDir, '--days', '7']
    );

    // Verify output indicates no repositories found
    expect(stdout).toContain('No git repositories found');
  }, 30000);

  it('should detect languages correctly', async () => {
    // Create repo with TypeScript and Python files
    await createTestRepoWithLanguages('multi-lang-repo', {
      TypeScript: 3,
      Python: 2,
    });

    // Run vibe CLI with --raw flag
    const { stdout } = await execFileAsync(
      'node',
      ['dist/index.js', '--root', testRoot, '--days', '7', '--raw']
    );

    // Verify language detection in raw output
    expect(stdout).toMatch(/top_language_\d+=TypeScript/);
    expect(stdout).toMatch(/top_language_\d+=Python/);
  }, 30000);

  it('should identify most active repositories', async () => {
    // Create repos with different commit counts
    await createTestRepo('very-active', 10);
    await createTestRepo('moderately-active', 5);
    await createTestRepo('slightly-active', 2);

    // Run vibe CLI with --raw flag
    const { stdout } = await execFileAsync(
      'node',
      ['dist/index.js', '--root', testRoot, '--days', '7', '--raw']
    );

    // Verify most active repos are listed in raw output
    expect(stdout).toContain('most_active_repo_1=very-active');
    expect(stdout).toContain('most_active_repo_2=moderately-active');
    expect(stdout).toContain('most_active_repo_3=slightly-active');
  }, 30000);

  it('should respect custom days parameter', async () => {
    // Create repo with recent commit
    await createTestRepo('recent-repo', 1);

    // Run vibe CLI with 1 day and --raw flag
    const { stdout: stdout1 } = await execFileAsync(
      'node',
      ['dist/index.js', '--root', testRoot, '--days', '1', '--raw']
    );

    // The commit should be counted (it was just created)
    expect(stdout1).toContain('active_repos=1');
    expect(stdout1).toContain('total_commits=1');
  }, 30000);

  it('should handle nested directory structures', async () => {
    // Create nested structure
    const nestedPath = join(testRoot, 'level1', 'level2');
    await mkdir(nestedPath, { recursive: true });
    
    // Create repo in nested location
    const repoPath = join(nestedPath, 'nested-repo');
    await mkdir(repoPath, { recursive: true });
    await execFileAsync('git', ['init'], { cwd: repoPath });
    await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: repoPath });
    await execFileAsync('git', ['config', 'user.name', 'Test User'], { cwd: repoPath });
    await writeFile(join(repoPath, 'file.txt'), 'content');
    await execFileAsync('git', ['add', '.'], { cwd: repoPath });
    await execFileAsync('git', ['commit', '-m', 'Initial commit'], { cwd: repoPath });

    // Run vibe CLI with --raw flag
    const { stdout } = await execFileAsync(
      'node',
      ['dist/index.js', '--root', testRoot, '--days', '7', '--raw']
    );

    // Verify nested repo was found
    expect(stdout).toContain('total_repos=1');
    expect(stdout).toContain('active_repos=1');
  }, 30000);

  it('should exit with code 0 on success', async () => {
    // Create test repo
    await createTestRepo('success-repo', 1);

    // Run vibe CLI with --raw flag and check exit code
    const result = await execFileAsync(
      'node',
      ['dist/index.js', '--root', testRoot, '--days', '7', '--raw']
    );

    // execFileAsync only resolves if exit code is 0
    expect(result.stdout).toContain('total_repos=1');
  }, 30000);

  it('should classify commit distribution patterns', async () => {
    // Create repos with clustered pattern (one very active, others quiet)
    await createTestRepo('super-active', 20);
    await createTestRepo('quiet-1', 1);
    await createTestRepo('quiet-2', 1);

    // Run vibe CLI with --raw flag
    const { stdout } = await execFileAsync(
      'node',
      ['dist/index.js', '--root', testRoot, '--days', '7', '--raw']
    );

    // Verify distribution is classified
    expect(stdout).toMatch(/commit_distribution=(focused|clustered|spread|sparse)/);
  }, 30000);
});
