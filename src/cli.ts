/**
 * CLI argument parsing for vibe-cli
 * Handles command-line interface and argument validation
 */

import { Command } from 'commander';

/**
 * CLI options interface
 */
export interface CLIOptions {
  /** Number of days to analyze */
  days: number;
  /** Root directory to scan (optional) */
  root?: string;
  /** Show raw metrics without AI summary */
  raw?: boolean;
}

/**
 * Parses command-line arguments and returns validated options
 * @param args - Command-line arguments (typically process.argv)
 * @returns Parsed and validated CLI options
 */
export function parseCLIArgs(args: string[]): CLIOptions {
  const program = new Command();

  program
    .name('vibe')
    .description('AI-powered git repository activity summary tool')
    .version('1.0.0')
    .option('-d, --days <number>', 'Number of days to analyze', '7')
    .option('-r, --root <path>', 'Root directory to scan for repositories')
    .option('--raw', 'Show raw metrics without AI summary')
    .parse(args);

  const options = program.opts();

  // Validate days is a positive integer
  const days = parseInt(options.days, 10);
  if (isNaN(days) || days <= 0) {
    console.error('Error: --days must be a positive integer');
    process.exit(1);
  }

  return {
    days,
    root: options.root,
    raw: options.raw || false
  };
}
