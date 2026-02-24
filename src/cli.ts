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
  /** AI provider to use for summaries */
  provider?: 'bedrock' | 'template' | 'ollama' | 'auto';
  /** Fallback order for auto provider routing */
  fallbackOrder?: 'cloud-first' | 'local-first';
  /** Print provider decision logs for supportability */
  debugProvider?: boolean;
  /** Show provider availability information */
  status?: boolean;
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
    .option('-p, --provider <provider>', 'AI provider for summaries (bedrock|template|ollama|auto)', 'bedrock')
    .option('--fallback-order <order>', 'Auto fallback order (cloud-first|local-first)', 'cloud-first')
    .option('--debug-provider', 'Print provider routing and fallback decisions to stderr')
    .option('--status', 'Show provider availability status')
    .parse(args);

  const options = program.opts();

  // Validate days is a positive integer
  const days = parseInt(options.days, 10);
  if (isNaN(days) || days <= 0) {
    console.error('Error: --days must be a positive integer');
    process.exit(1);
  }

  // Validate provider
  const validProviders = ['bedrock', 'template', 'ollama', 'auto'];
  if (options.provider && !validProviders.includes(options.provider)) {
    console.error(`Error: --provider must be one of: ${validProviders.join(', ')}`);
    process.exit(1);
  }

  // Validate fallback order
  const validFallbackOrders = ['cloud-first', 'local-first'];
  if (options.fallbackOrder && !validFallbackOrders.includes(options.fallbackOrder)) {
    console.error(`Error: --fallback-order must be one of: ${validFallbackOrders.join(', ')}`);
    process.exit(1);
  }

  return {
    days,
    root: options.root,
    raw: options.raw || false,
    provider: options.provider || 'bedrock',
    fallbackOrder: options.fallbackOrder || 'cloud-first',
    debugProvider: options.debugProvider || false,
    status: options.status || false
  };
}
