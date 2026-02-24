/**
 * Shared grounding guardrails for AI-generated summaries.
 */

import { WorkPatternSummary } from './aggregator.js';

const FILE_PATH_PATTERN =
  /\b(?:[\w-]+\/)*[\w-]+\.(?:ts|tsx|js|jsx|mjs|cjs|py|go|java|rb|rs|c|cc|cpp|h|hpp|cs|php|swift|kt|scala|sql|md|json|ya?ml|toml|sh)\b/i;
const COMMIT_HASH_PATTERN = /\b(?=[0-9a-f]*[a-f])(?=[0-9a-f]*\d)[0-9a-f]{7,40}\b/i;

export interface GroundingValidationResult {
  valid: boolean;
  reasons: string[];
}

export interface GroundingValidationOptions {
  requireGroundedFact?: boolean;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function includesTerm(text: string, term: string): boolean {
  if (!term.trim()) {
    return false;
  }

  const matcher = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i');
  return matcher.test(text);
}

function describeDistribution(commitDistribution: WorkPatternSummary['commitDistribution']): string {
  switch (commitDistribution) {
    case 'focused':
      return 'focused on a single repository';
    case 'clustered':
      return 'concentrated in a few repositories';
    case 'spread':
      return 'spread across repositories';
    case 'sparse':
      return 'sparse with minimal activity';
    default:
      return commitDistribution;
  }
}

/**
 * Builds a prompt that constrains output to known git facts.
 */
export function buildGroundedPrompt(summary: WorkPatternSummary): string {
  const topLanguages =
    summary.topLanguages.length > 0
      ? summary.topLanguages.map(language => `${language.language} (${language.percentage}%)`).join(', ')
      : 'none detected';

  const topRepos = summary.mostActiveRepos.length > 0 ? summary.mostActiveRepos.join(', ') : 'none';

  return `You're reviewing a developer's week of coding activity.

Facts from git scan (use only these facts):
- Total repositories: ${summary.totalRepos}
- Active repos (with commits): ${summary.activeRepos}
- Cold repos (no commits): ${summary.coldRepos}
- Total commits: ${summary.totalCommits}
- Commit pattern: ${describeDistribution(summary.commitDistribution)}
- Top languages: ${topLanguages}
- Most active repos: ${topRepos}

Grounding rules (strict):
- Do not invent commit hashes, commit messages, pull requests, branches, or ticket IDs.
- Do not invent file names or file paths.
- Do not introduce numbers that are not listed in the facts above.
- If a detail is not in the facts above, do not mention it.

Write a casual, friendly 3-4 sentence summary. Keep it conversational, but grounded in the listed facts.`;
}

/**
 * Validates that generated text is grounded in known summary facts.
 */
export function validateSummaryGrounding(
  text: string,
  summary: WorkPatternSummary,
  options: GroundingValidationOptions = {}
): GroundingValidationResult {
  const reasons: string[] = [];
  const normalizedText = text.trim();

  if (!normalizedText) {
    return { valid: false, reasons: ['summary is empty'] };
  }

  if (COMMIT_HASH_PATTERN.test(normalizedText)) {
    reasons.push('summary appears to include a commit hash, which is not allowed');
  }

  if (FILE_PATH_PATTERN.test(normalizedText)) {
    reasons.push('summary appears to include a file path or file name, which is not allowed');
  }

  const allowedNumbers = new Set<number>([
    summary.totalRepos,
    summary.activeRepos,
    summary.coldRepos,
    summary.totalCommits,
    ...summary.topLanguages.map(language => language.percentage)
  ]);

  const numericMatches = [...normalizedText.matchAll(/\b\d+\b/g)].map(match => Number.parseInt(match[0], 10));
  const invalidNumbers = numericMatches.filter(value => !allowedNumbers.has(value));
  if (invalidNumbers.length > 0) {
    const invalidNumberList = [...new Set(invalidNumbers)].join(', ');
    reasons.push(`summary includes ungrounded numeric claims: ${invalidNumberList}`);
  }

  const hasGroundedMetric =
    numericMatches.some(value => allowedNumbers.has(value)) ||
    summary.mostActiveRepos.some(repo => includesTerm(normalizedText, repo)) ||
    summary.topLanguages.some(language => includesTerm(normalizedText, language.language)) ||
    includesTerm(normalizedText, summary.commitDistribution);

  if (options.requireGroundedFact !== false && !hasGroundedMetric) {
    reasons.push('summary does not reference any grounded fact from detected git data');
  }

  return {
    valid: reasons.length === 0,
    reasons
  };
}
