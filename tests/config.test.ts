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
    it('should throw error when AWS credentials are not configured', () => {
      delete process.env.AWS_ACCESS_KEY_ID;
      delete process.env.AWS_SECRET_ACCESS_KEY;
      delete process.env.AWS_PROFILE;
      
      expect(() => loadConfig()).toThrow(
        'AWS credentials not configured'
      );
    });

    it('should load config with AWS credentials from environment', () => {
      process.env.AWS_ACCESS_KEY_ID = 'test-key-id';
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
      process.env.VIBE_ROOT = homedir(); // Use home directory which always exists
      
      const config = loadConfig();
      
      expect(config.awsRegion).toBe('us-east-1');
      expect(config.modelId).toBe('us.anthropic.claude-3-5-haiku-20241022-v1:0');
    });

    it('should use default root path ~/code when VIBE_ROOT not set', () => {
      process.env.AWS_ACCESS_KEY_ID = 'test-key-id';
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
      delete process.env.VIBE_ROOT;
      
      const config = loadConfig();
      
      expect(config.rootPath).toBe(`${homedir()}/code`);
    });

    it('should use VIBE_ROOT when set', () => {
      process.env.AWS_ACCESS_KEY_ID = 'test-key-id';
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
      process.env.VIBE_ROOT = '~/projects';
      
      const config = loadConfig();
      
      expect(config.rootPath).toBe(`${homedir()}/projects`);
    });

    it('should expand tilde in VIBE_ROOT', () => {
      process.env.AWS_ACCESS_KEY_ID = 'test-key-id';
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
      process.env.VIBE_ROOT = '~'; // Use home directory which always exists
      
      const config = loadConfig();
      
      expect(config.rootPath).toBe(homedir());
    });

    it('should set default days to 7', () => {
      process.env.AWS_ACCESS_KEY_ID = 'test-key-id';
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
      
      const config = loadConfig();
      
      expect(config.defaultDays).toBe(7);
    });

    it('should set maxDepth to 10', () => {
      process.env.AWS_ACCESS_KEY_ID = 'test-key-id';
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
      
      const config = loadConfig();
      
      expect(config.maxDepth).toBe(10);
    });

    it('should return complete Config object', () => {
      process.env.AWS_ACCESS_KEY_ID = 'test-key-id';
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
      process.env.VIBE_ROOT = '~'; // Use home directory which always exists
      process.env.AWS_REGION = 'us-west-2';
      process.env.BEDROCK_MODEL_ID = 'custom-model-id';
      
      const config = loadConfig();
      
      expect(config).toEqual({
        rootPath: homedir(),
        awsRegion: 'us-west-2',
        modelId: 'custom-model-id',
        defaultDays: 7,
        maxDepth: 10,
      });
    });
  });
});
