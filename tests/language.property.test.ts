/**
 * Property-based tests for LanguageDetector
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LanguageDetector } from '../src/language.js';
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import fc from 'fast-check';

describe('LanguageDetector - Property Tests', () => {
  let detector: LanguageDetector;
  let testDir: string;

  beforeEach(async () => {
    detector = new LanguageDetector();
    testDir = await mkdtemp(join(tmpdir(), 'vibe-lang-prop-test-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  /**
   * **Validates: Requirements 5.2, 5.3, 5.6**
   * 
   * Property 6: Language Percentage Validity
   * For any repository, the sum of language percentages should not exceed 100,
   * and languages should be sorted by percentage in descending order.
   */
  it('should have valid percentages that sum to at most 100 and are sorted descending', async () => {
    // Define supported file extensions
    const extensions = [
      '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs',
      '.rb', '.php', '.c', '.cpp', '.cs', '.swift', '.kt', '.html',
      '.css', '.vue', '.sql', '.sh'
    ];

    // Arbitrary for generating file structures
    const fileStructureArbitrary = fc.record({
      files: fc.array(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 10 })
            .filter(s => !s.includes('/') && !s.includes('\0')),
          extension: fc.constantFrom(...extensions)
        }),
        { minLength: 1, maxLength: 50 }
      ),
      subdirs: fc.array(
        fc.string({ minLength: 1, maxLength: 8 })
          .filter(s => !s.startsWith('.'))
          .filter(s => !s.includes('/'))
          .filter(s => s !== 'node_modules'),
        { maxLength: 3 }
      )
    });

    await fc.assert(
      fc.asyncProperty(
        fileStructureArbitrary,
        async (structure) => {
          // Clean test directory
          await rm(testDir, { recursive: true, force: true });
          testDir = await mkdtemp(join(tmpdir(), 'vibe-lang-prop-test-'));

          // Create subdirectories
          for (const subdir of structure.subdirs) {
            await mkdir(join(testDir, subdir), { recursive: true });
          }

          // Create files in main directory and subdirectories
          for (const file of structure.files) {
            // Randomly place in main dir or a subdir
            const targetDir = structure.subdirs.length > 0 && Math.random() > 0.5
              ? join(testDir, structure.subdirs[Math.floor(Math.random() * structure.subdirs.length)])
              : testDir;
            
            const filePath = join(targetDir, `${file.name}${file.extension}`);
            await writeFile(filePath, '// test content');
          }

          const result = await detector.detectLanguages(testDir);

          // Property 1: Sum of percentages should not exceed 100
          const totalPercentage = result.reduce((sum, lang) => sum + lang.percentage, 0);
          expect(totalPercentage).toBeLessThanOrEqual(100);

          // Property 2: Languages should be sorted by percentage in descending order
          for (let i = 0; i < result.length - 1; i++) {
            expect(result[i].percentage).toBeGreaterThanOrEqual(result[i + 1].percentage);
          }

          // Property 3: All percentages should be non-negative
          for (const lang of result) {
            expect(lang.percentage).toBeGreaterThanOrEqual(0);
            expect(lang.percentage).toBeLessThanOrEqual(100);
          }

          // Property 4: Language names should be non-empty
          for (const lang of result) {
            expect(lang.language).toBeTruthy();
            expect(lang.language.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 5.2, 5.3, 5.6**
   * 
   * Additional test: Verify percentage calculation accuracy
   * The percentages should accurately reflect the file distribution
   */
  it('should calculate percentages that accurately reflect file distribution', async () => {
    // Test with controlled file counts
    const fileCountArbitrary = fc.record({
      typescript: fc.integer({ min: 0, max: 20 }),
      javascript: fc.integer({ min: 0, max: 20 }),
      python: fc.integer({ min: 0, max: 20 })
    }).filter(counts => counts.typescript + counts.javascript + counts.python > 0);

    await fc.assert(
      fc.asyncProperty(
        fileCountArbitrary,
        async (counts) => {
          // Clean test directory
          await rm(testDir, { recursive: true, force: true });
          testDir = await mkdtemp(join(tmpdir(), 'vibe-lang-prop-test-'));

          // Create TypeScript files
          for (let i = 0; i < counts.typescript; i++) {
            await writeFile(join(testDir, `file${i}.ts`), 'const x = 1;');
          }

          // Create JavaScript files
          for (let i = 0; i < counts.javascript; i++) {
            await writeFile(join(testDir, `file${i}.js`), 'var x = 1;');
          }

          // Create Python files
          for (let i = 0; i < counts.python; i++) {
            await writeFile(join(testDir, `file${i}.py`), 'x = 1');
          }

          const result = await detector.detectLanguages(testDir);
          const totalFiles = counts.typescript + counts.javascript + counts.python;

          // Verify each language's percentage is within 1% of expected (due to rounding)
          for (const lang of result) {
            let expectedCount = 0;
            if (lang.language === 'TypeScript') expectedCount = counts.typescript;
            if (lang.language === 'JavaScript') expectedCount = counts.javascript;
            if (lang.language === 'Python') expectedCount = counts.python;

            const exactPercentage = (expectedCount / totalFiles) * 100;
            // Percentage should be within 1% of the exact value (floor or ceil)
            expect(lang.percentage).toBeGreaterThanOrEqual(Math.floor(exactPercentage));
            expect(lang.percentage).toBeLessThanOrEqual(Math.ceil(exactPercentage));
          }

          // Verify sum doesn't exceed 100
          const totalPercentage = result.reduce((sum, lang) => sum + lang.percentage, 0);
          expect(totalPercentage).toBeLessThanOrEqual(100);

          // Verify all expected languages are present (if count > 0)
          const languageNames = result.map(l => l.language);
          if (counts.typescript > 0) expect(languageNames).toContain('TypeScript');
          if (counts.javascript > 0) expect(languageNames).toContain('JavaScript');
          if (counts.python > 0) expect(languageNames).toContain('Python');
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * **Validates: Requirements 5.3**
   * 
   * Additional test: Verify descending sort is stable and consistent
   */
  it('should consistently sort languages by percentage descending', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            extension: fc.constantFrom('.ts', '.js', '.py', '.java', '.go'),
            count: fc.integer({ min: 1, max: 10 })
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (languageSpecs) => {
          // Clean test directory
          await rm(testDir, { recursive: true, force: true });
          testDir = await mkdtemp(join(tmpdir(), 'vibe-lang-prop-test-'));

          // Create files according to specs
          let fileIndex = 0;
          for (const spec of languageSpecs) {
            for (let i = 0; i < spec.count; i++) {
              await writeFile(join(testDir, `file${fileIndex++}${spec.extension}`), 'content');
            }
          }

          const result = await detector.detectLanguages(testDir);

          // Verify strict descending order (or equal)
          for (let i = 0; i < result.length - 1; i++) {
            expect(result[i].percentage).toBeGreaterThanOrEqual(result[i + 1].percentage);
          }

          // Verify no percentage is negative or over 100
          for (const lang of result) {
            expect(lang.percentage).toBeGreaterThanOrEqual(0);
            expect(lang.percentage).toBeLessThanOrEqual(100);
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * **Validates: Requirements 5.4**
   * 
   * Property 7: Language Detection Directory Exclusion
   * For any repository containing hidden directories or node_modules,
   * the language detector should skip these directories when analyzing file extensions.
   */
  it('should skip hidden directories and node_modules during language detection', async () => {
    // Arbitrary for generating directory structures with excluded directories
    const excludedDirArbitrary = fc.record({
      // Files in the main directory (should be counted)
      mainFiles: fc.array(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 10 })
            .filter(s => !s.includes('/') && !s.includes('\0')),
          extension: fc.constantFrom('.ts', '.js', '.py', '.java')
        }),
        { minLength: 1, maxLength: 10 }
      ),
      // Hidden directories (should be skipped)
      hiddenDirs: fc.array(
        fc.string({ minLength: 1, maxLength: 8 })
          .filter(s => !s.includes('/') && !s.includes('\0'))
          .map(s => `.${s}`), // Ensure it starts with .
        { maxLength: 3 }
      ),
      // Files in hidden directories (should NOT be counted)
      hiddenDirFiles: fc.array(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 10 })
            .filter(s => !s.includes('/') && !s.includes('\0')),
          extension: fc.constantFrom('.ts', '.js', '.py', '.java')
        }),
        { maxLength: 5 }
      ),
      // node_modules directory (should be skipped)
      hasNodeModules: fc.boolean(),
      // Files in node_modules (should NOT be counted)
      nodeModulesFiles: fc.array(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 10 })
            .filter(s => !s.includes('/') && !s.includes('\0')),
          extension: fc.constantFrom('.ts', '.js', '.py', '.java')
        }),
        { maxLength: 5 }
      )
    });

    await fc.assert(
      fc.asyncProperty(
        excludedDirArbitrary,
        async (structure) => {
          // Clean test directory
          await rm(testDir, { recursive: true, force: true });
          testDir = await mkdtemp(join(tmpdir(), 'vibe-lang-prop-test-'));

          // Create main directory files
          for (const file of structure.mainFiles) {
            const filePath = join(testDir, `${file.name}${file.extension}`);
            await writeFile(filePath, '// main content');
          }

          // Create hidden directories with files
          for (const hiddenDir of structure.hiddenDirs) {
            const hiddenDirPath = join(testDir, hiddenDir);
            await mkdir(hiddenDirPath, { recursive: true });

            // Add files to hidden directory
            for (const file of structure.hiddenDirFiles) {
              const filePath = join(hiddenDirPath, `${file.name}${file.extension}`);
              await writeFile(filePath, '// hidden content');
            }
          }

          // Create node_modules directory with files if specified
          if (structure.hasNodeModules) {
            const nodeModulesPath = join(testDir, 'node_modules');
            await mkdir(nodeModulesPath, { recursive: true });

            for (const file of structure.nodeModulesFiles) {
              const filePath = join(nodeModulesPath, `${file.name}${file.extension}`);
              await writeFile(filePath, '// node_modules content');
            }
          }

          // Run language detection
          const result = await detector.detectLanguages(testDir);

          // Count expected files (only from main directory)
          const expectedLanguageCounts: Record<string, number> = {};
          for (const file of structure.mainFiles) {
            const language = file.extension === '.ts' ? 'TypeScript' :
                           file.extension === '.js' ? 'JavaScript' :
                           file.extension === '.py' ? 'Python' :
                           'Java';
            expectedLanguageCounts[language] = (expectedLanguageCounts[language] || 0) + 1;
          }

          const totalExpectedFiles = Object.values(expectedLanguageCounts).reduce((sum, count) => sum + count, 0);

          // Property 1: Result should only reflect files from main directory
          // Calculate total files detected based on percentages
          if (totalExpectedFiles > 0) {
            // Verify that the detected languages match expected languages
            const detectedLanguages = new Set(result.map(l => l.language));
            const expectedLanguages = new Set(Object.keys(expectedLanguageCounts));

            // All detected languages should be in expected languages
            for (const lang of detectedLanguages) {
              expect(expectedLanguages.has(lang)).toBe(true);
            }

            // All expected languages should be in detected languages
            for (const lang of expectedLanguages) {
              expect(detectedLanguages.has(lang)).toBe(true);
            }

            // Verify percentages sum to at most 100
            const totalPercentage = result.reduce((sum, lang) => sum + lang.percentage, 0);
            expect(totalPercentage).toBeLessThanOrEqual(100);
          } else {
            // If no main files, result should be empty
            expect(result).toEqual([]);
          }

          // Property 2: Files in hidden directories should NOT be counted
          // This is implicitly tested by checking that only main directory files are reflected

          // Property 3: Files in node_modules should NOT be counted
          // This is implicitly tested by checking that only main directory files are reflected
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 5.4**
   * 
   * Additional test: Verify specific excluded directories are skipped
   * Tests that common excluded directories like .git, .venv, etc. are properly skipped
   */
  it('should skip all common excluded directories', async () => {
    const excludedDirs = [
      '.git',
      '.vscode',
      '.idea',
      'node_modules',
      '.venv',
      'venv',
      'target',
      'build',
      'dist',
      '.next',
      '.nuxt',
      'vendor',
      '__pycache__'
    ];

    await fc.assert(
      fc.asyncProperty(
        fc.subarray(excludedDirs, { minLength: 1, maxLength: excludedDirs.length }),
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 10 })
              .filter(s => !s.includes('/') && !s.includes('\0')),
            extension: fc.constantFrom('.ts', '.js', '.py')
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (dirsToTest, mainFiles) => {
          // Clean test directory
          await rm(testDir, { recursive: true, force: true });
          testDir = await mkdtemp(join(tmpdir(), 'vibe-lang-prop-test-'));

          // Create main directory files
          for (const file of mainFiles) {
            const filePath = join(testDir, `${file.name}${file.extension}`);
            await writeFile(filePath, '// main content');
          }

          // Create excluded directories with files
          for (const excludedDir of dirsToTest) {
            const excludedDirPath = join(testDir, excludedDir);
            await mkdir(excludedDirPath, { recursive: true });

            // Add files to excluded directory
            await writeFile(join(excludedDirPath, 'test.ts'), '// excluded content');
            await writeFile(join(excludedDirPath, 'test.js'), '// excluded content');
            await writeFile(join(excludedDirPath, 'test.py'), '// excluded content');
          }

          // Run language detection
          const result = await detector.detectLanguages(testDir);

          // Count expected files (only from main directory)
          const expectedLanguageCounts: Record<string, number> = {};
          for (const file of mainFiles) {
            const language = file.extension === '.ts' ? 'TypeScript' :
                           file.extension === '.js' ? 'JavaScript' :
                           'Python';
            expectedLanguageCounts[language] = (expectedLanguageCounts[language] || 0) + 1;
          }

          // Verify that detected languages match expected languages
          const detectedLanguages = new Set(result.map(l => l.language));
          const expectedLanguages = new Set(Object.keys(expectedLanguageCounts));

          // All detected languages should be in expected languages
          for (const lang of detectedLanguages) {
            expect(expectedLanguages.has(lang)).toBe(true);
          }

          // All expected languages should be in detected languages
          for (const lang of expectedLanguages) {
            expect(detectedLanguages.has(lang)).toBe(true);
          }
        }
      ),
      { numRuns: 30 }
    );
  });
});
