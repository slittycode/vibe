/**
 * Git command execution utilities for vibe-cli
 * Provides safe git command execution using execFile to prevent shell injection
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { resolve, normalize } from 'path';
import { access, constants } from 'fs/promises';

const execFileAsync = promisify(execFile);

/**
 * Validates and sanitizes a repository path before executing git commands
 * @param repoPath - Path to validate
 * @returns Normalized absolute path
 * @throws Error if path is invalid or inaccessible
 */
function validatePath(repoPath: string): string {
  // Normalize and resolve to absolute path
  const normalizedPath = normalize(resolve(repoPath));
  
  // Basic validation: ensure path doesn't contain suspicious patterns
  if (normalizedPath.includes('\0') || normalizedPath.includes('..\\..') || normalizedPath.includes('../..')) {
    throw new Error(`Invalid path: ${repoPath}`);
  }
  
  return normalizedPath;
}

/**
 * Safely executes a git command in a specified repository directory
 * Uses execFile instead of exec to prevent shell injection attacks
 * 
 * @param repoPath - Absolute path to the git repository
 * @param args - Array of git command arguments (e.g., ['log', '-1', '--format=%cI'])
 * @returns stdout as string on success, empty string on failure
 */
export async function execGit(repoPath: string, args: string[]): Promise<string> {
  try {
    // Validate and sanitize the path
    const validatedPath = validatePath(repoPath);
    
    // Verify the path exists and is accessible
    await access(validatedPath, constants.R_OK);
    
    // Execute git command using execFile for security
    const { stdout } = await execFileAsync('git', args, {
      cwd: validatedPath,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
    });
    
    return stdout;
  } catch (error) {
    // Log warning and return empty string on failure
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`Warning: Git command failed in ${repoPath}: ${errorMessage}`);
    return '';
  }
}
