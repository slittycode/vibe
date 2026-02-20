/**
 * Data aggregator for vibe-cli
 * Aggregates repository metrics into work pattern insights
 */

import { RepoMetrics } from './analyzer.js';
import { LanguageStats } from './language.js';

/**
 * Work pattern summary interface
 */
export interface WorkPatternSummary {
  /** Total number of repositories analyzed */
  totalRepos: number;
  /** Number of repositories with at least one commit in the period */
  activeRepos: number;
  /** Number of repositories with no commits in the period */
  coldRepos: number;
  /** Total commits across all repositories */
  totalCommits: number;
  /** Commit distribution pattern */
  commitDistribution: 'focused' | 'clustered' | 'spread' | 'sparse';
  /** Top 5 languages across all repositories */
  topLanguages: LanguageStats[];
  /** Top 3 most active repositories by commit count */
  mostActiveRepos: string[];
  /** Time range for the analysis */
  timeRange: { start: Date; end: Date };
}

/**
 * DataAggregator combines repository metrics into work pattern insights
 */
export class DataAggregator {
  /**
   * Aggregates repository metrics into a work pattern summary
   * @param metrics - Array of repository metrics
   * @param days - Number of days analyzed (for time range calculation)
   * @returns WorkPatternSummary object containing aggregated insights
   */
  aggregate(metrics: RepoMetrics[], days: number = 7): WorkPatternSummary {
    const totalRepos = metrics.length;
    const activeRepos = metrics.filter(m => m.isActive).length;
    const coldRepos = totalRepos - activeRepos;
    const totalCommits = metrics.reduce((sum, m) => sum + m.commitCountInPeriod, 0);

    // Determine commit distribution
    const commitCounts = metrics.map(m => m.commitCountInPeriod);
    const commitDistribution = this.determineDistribution(commitCounts);

    // Aggregate languages across all repos
    const languageMap: Record<string, number> = {};
    let totalLanguageFiles = 0;

    for (const metric of metrics) {
      for (const lang of metric.languages) {
        // Approximate file count from percentage
        const fileCount = Math.round(lang.percentage);
        languageMap[lang.language] = (languageMap[lang.language] || 0) + fileCount;
        totalLanguageFiles += fileCount;
      }
    }

    // Calculate top languages
    const topLanguages: LanguageStats[] = Object.entries(languageMap)
      .map(([language, count]) => ({
        language,
        percentage: totalLanguageFiles > 0 
          ? Math.round((count / totalLanguageFiles) * 100) 
          : 0
      }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 5);

    // Find most active repos
    const mostActiveRepos = metrics
      .filter(m => m.isActive)
      .sort((a, b) => b.commitCountInPeriod - a.commitCountInPeriod)
      .slice(0, 3)
      .map(m => m.repoName);

    // Calculate time range
    const now = new Date();
    const timeRange = {
      start: new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
      end: now
    };

    return {
      totalRepos,
      activeRepos,
      coldRepos,
      totalCommits,
      commitDistribution,
      topLanguages,
      mostActiveRepos,
      timeRange
    };
  }

  /**
   * Determines commit distribution pattern based on commit counts
   * @param commitCounts - Array of commit counts per repository
   * @returns Distribution pattern: 'focused', 'clustered', 'spread', or 'sparse'
   */
  private determineDistribution(commitCounts: number[]): 'focused' | 'clustered' | 'spread' | 'sparse' {
    const activeRepos = commitCounts.filter(c => c > 0);

    // No activity
    if (activeRepos.length === 0) return 'sparse';
    
    // Single repo with activity - this is "focused" work, not a "cluster"
    if (activeRepos.length === 1) return 'focused';

    // Calculate variance for multiple active repos
    const mean = activeRepos.reduce((a, b) => a + b, 0) / activeRepos.length;
    const variance = activeRepos.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / activeRepos.length;
    const stdDev = Math.sqrt(variance);

    // Design decision: stdDev > mean * 0.5 indicates clustered distribution
    // This is a judgment call, not a mathematical threshold
    // High variance = clustered (commits concentrated in few repos)
    // Low variance = spread (commits distributed evenly)
    if (stdDev > mean * 0.5) return 'clustered';
    return 'spread';
  }
}
