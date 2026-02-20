/**
 * Language detection for vibe-cli
 * Analyzes file extensions to identify programming languages used in a repository
 */

import { readdir } from 'fs/promises';
import { join, extname } from 'path';

/**
 * Language statistics interface
 */
export interface LanguageStats {
  /** Programming language name */
  language: string;
  /** Percentage of files in this language (0-100) */
  percentage: number;
}

/**
 * Mapping of file extensions to programming language names
 */
const EXTENSION_MAP: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.py': 'Python',
  '.java': 'Java',
  '.go': 'Go',
  '.rs': 'Rust',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.c': 'C',
  '.cpp': 'C++',
  '.cc': 'C++',
  '.cxx': 'C++',
  '.cs': 'C#',
  '.swift': 'Swift',
  '.kt': 'Kotlin',
  '.kts': 'Kotlin',
  '.scala': 'Scala',
  '.sh': 'Shell',
  '.bash': 'Shell',
  '.zsh': 'Shell',
  '.html': 'HTML',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.sass': 'Sass',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
  '.sql': 'SQL',
  '.r': 'R',
  '.m': 'Objective-C',
  '.mm': 'Objective-C++',
  '.dart': 'Dart',
  '.lua': 'Lua',
  '.pl': 'Perl',
  '.ex': 'Elixir',
  '.exs': 'Elixir',
  '.erl': 'Erlang',
  '.hrl': 'Erlang',
  '.clj': 'Clojure',
  '.cljs': 'ClojureScript',
  '.hs': 'Haskell',
  '.ml': 'OCaml',
  '.fs': 'F#',
  '.fsx': 'F#',
};

/**
 * Directories to skip during language detection
 */
const SKIP_DIRECTORIES = new Set([
  'node_modules',
  '.venv',
  'venv',
  'target',
  'build',
  'dist',
  '.next',
  '.nuxt',
  'vendor',
  '__pycache__',
]);

/**
 * LanguageDetector analyzes file extensions to determine language distribution
 */
export class LanguageDetector {
  /**
   * Detects programming languages used in a repository
   * @param repoPath - Absolute path to the repository
   * @returns Array of language statistics sorted by percentage descending
   */
  async detectLanguages(repoPath: string): Promise<LanguageStats[]> {
    const languageCounts: Record<string, number> = {};

    // Recursively count files by extension
    await this.walkDir(repoPath, languageCounts);

    // Calculate total files
    const totalFiles = Object.values(languageCounts).reduce((sum, count) => sum + count, 0);

    // If no recognized files found, return empty array
    if (totalFiles === 0) {
      return [];
    }

    // Convert counts to percentages using largest remainder method
    // to ensure sum never exceeds 100
    const languagesWithExact = Object.entries(languageCounts).map(([language, count]) => {
      const exactPercentage = (count / totalFiles) * 100;
      return {
        language,
        exactPercentage,
        flooredPercentage: Math.floor(exactPercentage),
        remainder: exactPercentage - Math.floor(exactPercentage),
      };
    });

    // Sort by remainder descending to distribute the leftover percentage
    languagesWithExact.sort((a, b) => b.remainder - a.remainder);

    // Calculate how much percentage we need to distribute
    const sumFloored = languagesWithExact.reduce((sum, lang) => sum + lang.flooredPercentage, 0);
    let remainderToDistribute = 100 - sumFloored;

    // Distribute the remainder to languages with largest fractional parts
    const languages: LanguageStats[] = languagesWithExact.map((lang, index) => {
      let percentage = lang.flooredPercentage;
      if (index < remainderToDistribute) {
        percentage += 1;
      }
      return {
        language: lang.language,
        percentage,
      };
    });

    // Sort by percentage descending
    languages.sort((a, b) => b.percentage - a.percentage);

    return languages;
  }

  /**
   * Recursively walks a directory tree counting files by language
   * @param dir - Directory to walk
   * @param languageCounts - Map to accumulate language counts
   */
  private async walkDir(
    dir: string,
    languageCounts: Record<string, number>
  ): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip hidden directories (starting with .)
          if (entry.name.startsWith('.')) {
            continue;
          }

          // Skip common non-code directories
          if (SKIP_DIRECTORIES.has(entry.name)) {
            continue;
          }

          // Recursively walk subdirectory
          await this.walkDir(fullPath, languageCounts);
        } else if (entry.isFile()) {
          // Check file extension
          const ext = extname(entry.name);
          const language = EXTENSION_MAP[ext];

          if (language) {
            languageCounts[language] = (languageCounts[language] || 0) + 1;
          }
        }
      }
    } catch (error) {
      // Handle permission errors gracefully
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`Warning: Error reading directory ${dir}: ${errorMessage}`);
    }
  }
}
