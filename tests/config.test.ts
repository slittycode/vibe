/**
 * Unit tests for configuration management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, expandTilde, type Config } from '../src/config.js';
import { homedir } from 'os';

describe('Config Module', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('expandTilde', () => {
    it('should expand ~ to home directory', () => {
      const result = expandTilde('~/code');
      expect(result).toBe(`${homedir()}/code`);
    });

    it('should expand standalone ~ to home directory', () => {
      const result = expandTilde('~');
      expect(result).toBe(homedir());
    });

    it('should not modify paths without tilde', () => {
      const result = expandTilde('/absolute/path');
      expect(result).toBe('/absolute/path');
    });

    it('should not modify relative paths', () => {
      const result = expandTilde('relative/path');
      expect(result).toBe('relative/path');
    });

    it('should not expand tilde in middle of path', () => {
      const result = expandTilde('/path/~/middle');
      expect(result).toBe('/path/~/middle');
    });
  });

  describe('loadConfig', () => {
    it('should throw error when ANTHROPIC_API_KEY is not set', () => {
      delete process.env.ANTHROPIC_API_KEY;
      
      expect(() => loadConfig()).toThrow(
        'ANTHROPIC_API_KEY environment variable not set. Please set it to use vibe.'
      );
    });

    it('should load config with API key from environment', () => {
      process.env.ANTHROPIC_API_KEY = 'test-api-key';
      
      const config = loadConfig();
      
      expect(config.claudeApiKey).toBe('test-api-key');
    });

    it('should use default root path ~/code when VIBE_ROOT not set', () => {
      process.env.ANTHROPIC_API_KEY = 'test-api-key';
      delete process.env.VIBE_ROOT;
      
      const config = loadConfig();
      
      expect(config.rootPath).toBe(`${homedir()}/code`);
    });

    it('should use VIBE_ROOT when set', () => {
      process.env.ANTHROPIC_API_KEY = 'test-api-key';
      process.env.VIBE_ROOT = '~/projects';
      
      const config = loadConfig();
      
      expect(config.rootPath).toBe(`${homedir()}/projects`);
    });

    it('should expand tilde in VIBE_ROOT', () => {
      process.env.ANTHROPIC_API_KEY = 'test-api-key';
      process.env.VIBE_ROOT = '~/custom/path';
      
      const config = loadConfig();
      
      expect(config.rootPath).toBe(`${homedir()}/custom/path`);
    });

    it('should set default days to 7', () => {
      process.env.ANTHROPIC_API_KEY = 'test-api-key';
      
      const config = loadConfig();
      
      expect(config.defaultDays).toBe(7);
    });

    it('should set maxDepth to 10', () => {
      process.env.ANTHROPIC_API_KEY = 'test-api-key';
      
      const config = loadConfig();
      
      expect(config.maxDepth).toBe(10);
    });

    it('should return complete Config object', () => {
      process.env.ANTHROPIC_API_KEY = 'test-api-key';
      process.env.VIBE_ROOT = '/custom/root';
      
      const config = loadConfig();
      
      expect(config).toEqual({
        rootPath: '/custom/root',
        claudeApiKey: 'test-api-key',
        defaultDays: 7,
        maxDepth: 10,
      });
    });
  });
});
