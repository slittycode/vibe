/**
 * Main orchestration logic for vibe-cli
 * Coordinates scanning, analysis, aggregation, and output
 */

import { loadConfig } from './config.js';
import { parseCLIArgs } from './cli.js';
import { RepositoryScanner } from './scanner.js';
import { GitAnalyzer } from './analyzer.js';
import { DataAggregator } from './aggregator.js';
import { BedrockClient } from './bedrock.js';

/**
 * Main function that orchestrates the vibe-cli workflow
 * @param args - Command-line arguments
 */
export async function main(args: string[]): Promise<void> {
  try {
    // Step 1: Parse CLI options
    const options = parseCLIArgs(args);

    // Step 2: Load configuration (skip AWS validation in raw mode)
    const config = loadConfig(!options.raw);
    const rootPath = options.root ?? config.rootPath;

    // Step 3: Scan for repositories
    const scanner = new RepositoryScanner();
    const repoPaths = await scanner.scanRepos(rootPath);

    if (repoPaths.length === 0) {
      console.log('No git repositories found.');
      process.exit(0);
    }

    // Step 4: Analyze each repository
    const analyzer = new GitAnalyzer();
    const metrics = await Promise.all(
      repoPaths.map(repoPath => analyzer.analyzeRepo(repoPath, options.days))
    );

    // Step 5: Aggregate data
    const aggregator = new DataAggregator();
    const summary = aggregator.aggregate(metrics, options.days);

    // Step 6: Output summary
    if (options.raw) {
      // Raw output mode - pipe-friendly format (key=value, one per line)
      console.log(`time_range_start=${summary.timeRange.start.toISOString()}`);
      console.log(`time_range_end=${summary.timeRange.end.toISOString()}`);
      console.log(`total_repos=${summary.totalRepos}`);
      console.log(`active_repos=${summary.activeRepos}`);
      console.log(`cold_repos=${summary.coldRepos}`);
      console.log(`total_commits=${summary.totalCommits}`);
      console.log(`commit_distribution=${summary.commitDistribution}`);
      
      if (summary.topLanguages.length > 0) {
        summary.topLanguages.forEach((lang, index) => {
          console.log(`top_language_${index + 1}=${lang.language}:${lang.percentage}%`);
        });
      }
      
      if (summary.mostActiveRepos.length > 0) {
        summary.mostActiveRepos.forEach((repo, index) => {
          console.log(`most_active_repo_${index + 1}=${repo}`);
        });
      }
    } else {
      // AI summary mode - call Bedrock
      const bedrock = new BedrockClient(config.awsRegion, config.modelId);
      const vibeText = await bedrock.generateVibeCheck(summary);
      console.log(vibeText);
    }

    process.exit(0);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('An unexpected error occurred');
    }
    process.exit(1);
  }
}
