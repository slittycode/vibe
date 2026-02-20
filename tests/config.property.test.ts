/**
 * Property-based tests for configuration management
 * **Validates: Requirements 2.4**
 */

import { describe, it, expect } from 'vitest';
import { expandTilde } from '../src/config.js';
import { homedir } from 'os';
import fc from 'fast-check';

describe('Config Property Tests', () => {
  describe('Property 14: Tilde Expansion', () => {
    it('should expand tilde to home directory for any path starting with ~/', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => !s.includes('\0')), // Valid path segment without null bytes
          (pathSegment) => {
            const inputPath = `~/${pathSegment}`;
            const result = expandTilde(inputPath);
            
            // Property: Result should start with home directory
            expect(result).toMatch(new RegExp(`^${homedir().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
            
            // Property: Tilde should be replaced
            if (pathSegment.length > 0) {
              expect(result).toBe(`${homedir()}/${pathSegment}`);
            }
          }
        )
      );
    });

    it('should expand standalone tilde to home directory', () => {
      const result = expandTilde('~');
      expect(result).toBe(homedir());
    });

    it('should not modify paths that do not start with tilde', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => !s.startsWith('~') && !s.includes('\0')),
          (path) => {
            const result = expandTilde(path);
            
            // Property: Non-tilde paths should remain unchanged
            expect(result).toBe(path);
          }
        )
      );
    });

    it('should only expand tilde at the start of the path', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => s.length > 0 && !s.includes('\0') && !s.startsWith('~')),
          fc.string().filter(s => !s.includes('\0')),
          (prefix, suffix) => {
            const inputPath = `${prefix}/~/${suffix}`;
            const result = expandTilde(inputPath);
            
            // Property: Tilde in middle should not be expanded
            expect(result).toBe(inputPath);
          }
        )
      );
    });

    it('should handle paths with various special characters after tilde', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('/'),
            fc.constant('/path/to/dir'),
            fc.constant('/path with spaces'),
            fc.constant('/path-with-dashes'),
            fc.constant('/path_with_underscores'),
            fc.constant('/path.with.dots'),
            fc.constant('/.hidden'),
            fc.constant('/multiple/nested/directories')
          ),
          (pathSuffix) => {
            const inputPath = `~${pathSuffix}`;
            const result = expandTilde(inputPath);
            
            // Property: Should expand to home + suffix
            expect(result).toBe(`${homedir()}${pathSuffix}`);
          }
        )
      );
    });
  });
});
