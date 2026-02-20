/**
 * Template-based summary generator for vibe-cli
 * Generates API-free summaries using pattern-based templates
 */

import { WorkPatternSummary } from './aggregator.js';

/**
 * Template-based summary generator
 */
export class TemplateProvider {
  /**
   * Generates a casual summary using template-based patterns
   * @param summary - Work pattern summary to generate text from
   * @returns Generated casual summary text
   */
  generateVibeCheck(summary: WorkPatternSummary): string {
    const templates = this.getTemplatesForPattern(summary.commitDistribution);
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    return this.fillTemplate(template, summary);
  }

  /**
   * Gets template variations for a specific commit distribution pattern
   * @param pattern - Commit distribution pattern
   * @returns Array of template strings
   */
  private getTemplatesForPattern(pattern: WorkPatternSummary['commitDistribution']): string[] {
    switch (pattern) {
      case 'focused':
        return [
          "Deep dive week! Really focused on {top_repo} with {total_commits} commits. Sometimes you just need to lock in and ship.",
          "All in on {top_repo} this week - {total_commits} commits shows the dedication. That's what focused work looks like.",
          "Single-minded focus on {top_repo} with {total_commits} commits. Quality over quantity, right?",
          "Locked in on {top_repo} - {total_commits} commits worth of progress. That's the beauty of deep work."
        ];
      
      case 'clustered':
        return [
          "Concentrated effort across a few key projects - {top_repo} and {second_repo} getting most love with {total_commits} commits total.",
          "Splitting time between {top_repo} and {second_repo} this week. {total_commits} commits across the board shows good multitasking.",
          "Main focus on {top_repo} and {second_repo} with {total_commits} commits. Sometimes you gotta juggle a few things.",
          "Divided attention between {top_repo} and {second_repo} - {total_commits} commits and making progress on multiple fronts."
        ];
      
      case 'spread':
        return [
          "Spreading the love around! {total_commits} commits across {active_repos} repos shows you're playing the field.",
          "Jack of all trades this week - {total_commits} commits spread across {active_repos} different projects.",
          "Touching everything with {total_commits} commits across {active_repos} repos. Variety is the spice of dev life.",
          "Playing the long game with {total_commits} commits across {active_repos} projects. Keeping all plates spinning."
        ];
      
      case 'sparse':
        return [
          "Quiet week with just {total_commits} commits. Sometimes you need to recharge the batteries.",
          "Light activity this week - {total_commits} commits total. Even developers need vacation mode.",
          "Taking it easy with {total_commits} commits. Rest is part of the process.",
          "Minimal commits this week ({total_commits}). Every sprint needs a recovery week."
        ];
      
      default:
        return ["Week done. {total_commits} commits in the books."];
    }
  }

  /**
   * Fills template placeholders with actual data
   * @param template - Template string with placeholders
   * @param summary - Work pattern summary data
   * @returns Filled template string
   */
  private fillTemplate(template: string, summary: WorkPatternSummary): string {
    let result = template;
    
    // Basic replacements
    result = result.replace('{total_commits}', summary.totalCommits.toString());
    result = result.replace('{total_repos}', summary.totalRepos.toString());
    result = result.replace('{active_repos}', summary.activeRepos.toString());
    result = result.replace('{cold_repos}', summary.coldRepos.toString());
    
    // Top repos
    if (summary.mostActiveRepos.length > 0) {
      result = result.replace('{top_repo}', summary.mostActiveRepos[0]);
      result = result.replace('{second_repo}', summary.mostActiveRepos[1] || 'other projects');
    } else {
      result = result.replace('{top_repo}', 'various projects');
      result = result.replace('{second_repo}', 'other projects');
    }
    
    // Languages
    if (summary.topLanguages.length > 0) {
      const topLang = summary.topLanguages[0].language;
      result = result.replace('{top_language}', topLang);
    } else {
      result = result.replace('{top_language}', 'various languages');
    }
    
    return result;
  }
}
