/**
 * Configuration management for vibe-cli
 * Loads configuration from environment variables with sensible defaults
 */

import { homedir } from 'os';
import { resolve } from 'path';
import { existsSync, statSync } from 'fs';

/**
 * Configuration interface for vibe-cli
 */
export interface Config {
  /** Root directory to scan for git repositories */
  rootPath: string;
  /** AWS region for Bedrock */
  awsRegion: string;
  /** Bedrock model ID */
  modelId: string;
  /** Default number of days to analyze */
  defaultDays: number;
  /** Maximum depth for directory scanning */
  maxDepth: number;
}

/**
 * Expands tilde (~) in a path to the user's home directory
 * @param path - Path that may contain tilde
 * @returns Expanded path with home directory
 */
export function expandTilde(path: string): string {
  if (path.startsWith('~/') || path === '~') {
    return path.replace(/^~/, homedir());
  }
  return path;
}

/**
 * Loads configuration from environment variables with defaults
 * @param requireAwsConfig - Whether to require AWS configuration (default: true)
 * @returns Config object with all settings
 * @throws Error if AWS credentials are not configured and requireAwsConfig is true
 */
export function loadConfig(requireAwsConfig: boolean = true): Config {
  // Check for AWS credentials if required
  if (requireAwsConfig) {
    const hasAwsCredentials = 
      (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ||
      process.env.AWS_PROFILE;
    
    if (!hasAwsCredentials) {
      throw new Error(
        'AWS credentials not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY, ' +
        'or configure AWS_PROFILE, or use --raw flag to skip AI summary.'
      );
    }
  }

  // Load AWS region with default
  const awsRegion = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';

  // Load Bedrock model ID with default (using cross-region inference profile)
  const modelId = process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-3-5-haiku-20241022-v1:0';

  // Load root path with default
  const rootPath = expandTilde(process.env.VIBE_ROOT || '~/code');

  // Validate root path exists
  if (!existsSync(rootPath)) {
    throw new Error(`Root path '${rootPath}' does not exist or is not a directory.`);
  }

  if (!statSync(rootPath).isDirectory()) {
    throw new Error(`Root path '${rootPath}' is not a directory.`);
  }

  // Set sensible defaults
  const defaultDays = 7;
  const maxDepth = 10;

  return {
    rootPath,
    awsRegion,
    modelId,
    defaultDays,
    maxDepth,
  };
}
