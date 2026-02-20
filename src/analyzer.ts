/**
 * Git analyzer for vibe-cli
 * Extracts commit metrics and language statistics from git repositories
 */

import { basename } from 'path';
import { execGit } from './git.js';
import { LanguageDetector, LanguageStats } from './language.js';

/**
 * Repository metrics interface
 */
export interface RepoMetrics {
  /** Absolute path to the repository */
  repoPath: string;
  /** Repository name (derived from last path segment) */
  repoName: string;
  /** Date of the most recent commit, null if no commits exist */
  lastCommitDate: Date | null;
  /** Number of commits made within the specified time period */
  commitCountInPeriod: number;
  /** Programming languages detected in the repository */
  languages: LanguageStats[];
  /** True if repository has at least one commit in the time period */
  isActive: boolean;
}

/**
 * GitAnalyzer extracts commit metrics from a git repository
 */
export class GitAnalyzer {
  private languageDetector: LanguageDetector;

  constructor() {
    this.languageDetector = new LanguageDetector();
  }

  /**
   * Analyzes a git repository to extract commit metrics and language statistics
   * @param repoPath - Absolute path to the git repository
   * @param days - Number of days to look back for commit analysis
   * @returns RepoMetrics object containing repository analysis
   */
  async analyzeRepo(repoPath: string, days: number): Promise<RepoMetrics> {
    const repoName = basename(repoPath);
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get last commit date
    const lastCommitOutput = await execGit(repoPath, ['log', '-1', '--format=%cI']);
    const lastCommitDate = lastCommitOutput.trim() 
      ? new Date(lastCommitOutput.trim()) 
      : null;

    // Get commit count in period
    const commitOutput = await execGit(repoPath, [
      'log',
      `--since=${sinceDate.toISOString()}`,
      '--oneline'
    ]);
    
    // Count commits by splitting on newlines and filtering empty lines
    const commitLines = commitOutput.trim().split('\n').filter(line => line.length > 0);
    const commitCountInPeriod = commitOutput.trim() ? commitLines.length : 0;

    // Detect languages
    const languages = await this.languageDetector.detectLanguages(repoPath);

    // Determine if active
    const isActive = commitCountInPeriod > 0;

    return {
      repoPath,
      repoName,
      lastCommitDate,
      commitCountInPeriod,
      languages,
      isActive
    };
  }
}
