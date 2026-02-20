/**
 * Unit tests for CLI argument parsing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseCLIArgs } from '../src/cli.js';

describe('CLI Argument Parsing', () => {
  let exitSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should use default days value of 7', () => {
    const options = parseCLIArgs(['node', 'vibe']);

    expect(options.days).toBe(7);
    expect(options.root).toBeUndefined();
  });

  it('should parse custom --days flag', () => {
    const options = parseCLIArgs(['node', 'vibe', '--days', '14']);

    expect(options.days).toBe(14);
  });

  it('should parse short -d flag', () => {
    const options = parseCLIArgs(['node', 'vibe', '-d', '30']);

    expect(options.days).toBe(30);
  });

  it('should parse --root flag', () => {
    const options = parseCLIArgs(['node', 'vibe', '--root', '/custom/path']);

    expect(options.days).toBe(7);
    expect(options.root).toBe('/custom/path');
  });

  it('should parse short -r flag', () => {
    const options = parseCLIArgs(['node', 'vibe', '-r', '/another/path']);

    expect(options.root).toBe('/another/path');
  });

  it('should parse both --days and --root flags', () => {
    const options = parseCLIArgs(['node', 'vibe', '--days', '21', '--root', '/my/repos']);

    expect(options.days).toBe(21);
    expect(options.root).toBe('/my/repos');
  });

  it('should exit with error for invalid days value', () => {
    parseCLIArgs(['node', 'vibe', '--days', 'invalid']);

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error: --days must be a positive integer');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit with error for negative days value', () => {
    parseCLIArgs(['node', 'vibe', '--days', '-5']);

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error: --days must be a positive integer');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit with error for zero days value', () => {
    parseCLIArgs(['node', 'vibe', '--days', '0']);

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error: --days must be a positive integer');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
