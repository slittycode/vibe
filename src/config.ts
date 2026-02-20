/**
 * Configuration management for vibe-cli
 * Loads configuration from environment variables with sensible defaults
 */

import { homedir } from 'os';
import { resolve } from 'path';

/**
 * Configuration interface for vibe-cli
 */
export interface Config {
  /** Root directory to scan for git repositories */
  rootPath: string;
  /** Claude API key for generating summaries */
  claudeApiKey: string;
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
 * @returns Config object with all settings
 * @throws Error if ANTHROPIC_API_KEY is not set
 */
export function loadConfig(): Config {
  // Validate required API key
  const claudeApiKey = process.env.ANTHROPIC_API_KEY;
  if (!claudeApiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable not set. Please set it to use vibe.');
  }

  // Load root path with default
  const rootPath = expandTilde(process.env.VIBE_ROOT || '~/code');

  // Set sensible defaults
  const defaultDays = 7;
  const maxDepth = 10;

  return {
    rootPath,
    claudeApiKey,
    defaultDays,
    maxDepth,
  };
}
