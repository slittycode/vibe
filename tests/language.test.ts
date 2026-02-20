/**
 * Unit tests for LanguageDetector
 */

import { describe, it, expect } from 'vitest';
import { LanguageDetector } from '../src/language.js';
import { mkdtemp, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { rmSync } from 'fs';

describe('LanguageDetector', () => {
  it('should return empty array for directory with no recognized files', async () => {
    const detector = new LanguageDetector();
    const tempDir = await mkdtemp(join(tmpdir(), 'vibe-test-'));

    try {
      // Create a file with unrecognized extension
      await writeFile(join(tempDir, 'readme.txt'), 'Hello');

      const result = await detector.detectLanguages(tempDir);
      expect(result).toEqual([]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should detect single language correctly', async () => {
    const detector = new LanguageDetector();
    const tempDir = await mkdtemp(join(tmpdir(), 'vibe-test-'));

    try {
      // Create TypeScript files
      await writeFile(join(tempDir, 'file1.ts'), 'const x = 1;');
      await writeFile(join(tempDir, 'file2.ts'), 'const y = 2;');

      const result = await detector.detectLanguages(tempDir);
      expect(result).toHaveLength(1);
      expect(result[0].language).toBe('TypeScript');
      expect(result[0].percentage).toBe(100);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should calculate percentages correctly for multiple languages', async () => {
    const detector = new LanguageDetector();
    const tempDir = await mkdtemp(join(tmpdir(), 'vibe-test-'));

    try {
      // Create 3 TypeScript files and 1 Python file
      await writeFile(join(tempDir, 'file1.ts'), 'const x = 1;');
      await writeFile(join(tempDir, 'file2.ts'), 'const y = 2;');
      await writeFile(join(tempDir, 'file3.ts'), 'const z = 3;');
      await writeFile(join(tempDir, 'file4.py'), 'x = 1');

      const result = await detector.detectLanguages(tempDir);
      expect(result).toHaveLength(2);
      
      // Should be sorted by percentage descending
      expect(result[0].language).toBe('TypeScript');
      expect(result[0].percentage).toBe(75);
      expect(result[1].language).toBe('Python');
      expect(result[1].percentage).toBe(25);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should skip hidden directories', async () => {
    const detector = new LanguageDetector();
    const tempDir = await mkdtemp(join(tmpdir(), 'vibe-test-'));

    try {
      // Create file in main directory
      await writeFile(join(tempDir, 'file1.ts'), 'const x = 1;');

      // Create hidden directory with files
      const hiddenDir = join(tempDir, '.hidden');
      await mkdir(hiddenDir);
      await writeFile(join(hiddenDir, 'file2.py'), 'x = 1');

      const result = await detector.detectLanguages(tempDir);
      expect(result).toHaveLength(1);
      expect(result[0].language).toBe('TypeScript');
      expect(result[0].percentage).toBe(100);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should skip node_modules directory', async () => {
    const detector = new LanguageDetector();
    const tempDir = await mkdtemp(join(tmpdir(), 'vibe-test-'));

    try {
      // Create file in main directory
      await writeFile(join(tempDir, 'file1.ts'), 'const x = 1;');

      // Create node_modules directory with files
      const nodeModulesDir = join(tempDir, 'node_modules');
      await mkdir(nodeModulesDir);
      await writeFile(join(nodeModulesDir, 'file2.js'), 'var x = 1;');

      const result = await detector.detectLanguages(tempDir);
      expect(result).toHaveLength(1);
      expect(result[0].language).toBe('TypeScript');
      expect(result[0].percentage).toBe(100);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should sort languages by percentage descending', async () => {
    const detector = new LanguageDetector();
    const tempDir = await mkdtemp(join(tmpdir(), 'vibe-test-'));

    try {
      // Create 1 Python, 2 JavaScript, 3 TypeScript files
      await writeFile(join(tempDir, 'file1.py'), 'x = 1');
      await writeFile(join(tempDir, 'file2.js'), 'var x = 1;');
      await writeFile(join(tempDir, 'file3.js'), 'var y = 2;');
      await writeFile(join(tempDir, 'file4.ts'), 'const x = 1;');
      await writeFile(join(tempDir, 'file5.ts'), 'const y = 2;');
      await writeFile(join(tempDir, 'file6.ts'), 'const z = 3;');

      const result = await detector.detectLanguages(tempDir);
      expect(result).toHaveLength(3);
      
      // Should be sorted: TypeScript (50%), JavaScript (33%), Python (17%)
      expect(result[0].language).toBe('TypeScript');
      expect(result[0].percentage).toBe(50);
      expect(result[1].language).toBe('JavaScript');
      expect(result[1].percentage).toBe(33);
      expect(result[2].language).toBe('Python');
      expect(result[2].percentage).toBe(17);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should handle nested directories correctly', async () => {
    const detector = new LanguageDetector();
    const tempDir = await mkdtemp(join(tmpdir(), 'vibe-test-'));

    try {
      // Create files in main directory
      await writeFile(join(tempDir, 'file1.ts'), 'const x = 1;');

      // Create subdirectory with files
      const subDir = join(tempDir, 'src');
      await mkdir(subDir);
      await writeFile(join(subDir, 'file2.ts'), 'const y = 2;');
      await writeFile(join(subDir, 'file3.py'), 'x = 1');

      const result = await detector.detectLanguages(tempDir);
      expect(result).toHaveLength(2);
      
      // Should count files from all directories
      expect(result[0].language).toBe('TypeScript');
      expect(result[0].percentage).toBe(67);
      expect(result[1].language).toBe('Python');
      expect(result[1].percentage).toBe(33);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
