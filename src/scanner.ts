/**
 * Repository scanner for vibe-cli
 * Recursively finds git repositories in a directory tree using BFS
 */

import { readdir, access, stat } from 'fs/promises';
import { join, resolve } from 'path';
import { constants } from 'fs';

/**
 * Directories to skip during scanning
 */
const SKIP_DIRECTORIES = new Set([
  'node_modules',
  '.venv',
  'venv',
  'target',
  'build',
  'dist',
  '.next',
  '.nuxt',
  'vendor',
  '__pycache__',
]);

/**
 * RepositoryScanner finds all git repositories under a root directory
 */
export class RepositoryScanner {
  /**
   * Scans a directory tree for git repositories using breadth-first search
   * @param rootPath - Root directory to start scanning from
   * @returns Array of absolute paths to discovered git repositories
   */
  async scanRepos(rootPath: string): Promise<string[]> {
    const repos: string[] = [];
    const queue: string[] = [resolve(rootPath)];

    while (queue.length > 0) {
      const currentPath = queue.shift()!;

      // Check if current directory is a git repository
      const gitPath = join(currentPath, '.git');
      if (await this.exists(gitPath)) {
        repos.push(currentPath);
        // Don't scan inside git repos (skip nested repos)
        continue;
      }

      // Add subdirectories to queue
      try {
        const entries = await readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          if (!entry.isDirectory()) {
            continue;
          }

          // Skip hidden directories (starting with .)
          if (entry.name.startsWith('.')) {
            continue;
          }

          // Skip common non-code directories
          if (SKIP_DIRECTORIES.has(entry.name)) {
            continue;
          }

          queue.push(join(currentPath, entry.name));
        }
      } catch (error) {
        // Handle permission errors gracefully
        if (this.isPermissionError(error)) {
          console.warn(`Warning: Permission denied for directory: ${currentPath}`);
        } else {
          console.warn(`Warning: Error reading directory ${currentPath}: ${(error as Error).message}`);
        }
        // Continue scanning other directories
      }
    }

    return repos;
  }

  /**
   * Checks if a path exists
   * @param path - Path to check
   * @returns True if path exists, false otherwise
   */
  private async exists(path: string): Promise<boolean> {
    try {
      await access(path, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Checks if an error is a permission error
   * @param error - Error to check
   * @returns True if error is permission-related
   */
  private isPermissionError(error: unknown): boolean {
    return (
      error instanceof Error &&
      'code' in error &&
      (error.code === 'EACCES' || error.code === 'EPERM')
    );
  }
}
