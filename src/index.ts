#!/usr/bin/env node

/**
 * Entry point for vibe-cli
 * Invokes the main function with command-line arguments
 */

import { main } from './main.js';

// Invoke main function with process arguments
main(process.argv).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
