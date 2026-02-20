/**
 * Unit tests for DataAggregator
 */

import { describe, it, expect } from 'vitest';
import { DataAggregator } from '../src/aggregator.js';
import { RepoMetrics } from '../src/analyzer.js';

describe('DataAggregator', () => {
  const aggregator = new DataAggregator();

  it('should handle empty metrics array', () => {
    const summary = aggregator.aggregate([]);

    expect(summary.totalRepos).toBe(0);
    expect(summary.activeRepos).toBe(0);
    expect(summary.coldRepos).toBe(0);
    expect(summary.totalCommits).toBe(0);
    expect(summary.commitDistribution).toBe('sparse');
    expect(summary.topLanguages).toEqual([]);
    expect(summary.mostActiveRepos).toEqual([]);
  });

  it('should aggregate single active repository', () => {
    const metrics: RepoMetrics[] = [
      {
        repoPath: '/path/to/repo1',
        repoName: 'repo1',
        lastCommitDate: new Date(),
        commitCountInPeriod: 10,
        languages: [
          { language: 'TypeScript', percentage: 80 },
          { language: 'JavaScript', percentage: 20 }
        ],
        isActive: true
      }
    ];

    const summary = aggregator.aggregate(metrics);

    expect(summary.totalRepos).toBe(1);
    expect(summary.activeRepos).toBe(1);
    expect(summary.coldRepos).toBe(0);
    expect(summary.totalCommits).toBe(10);
    expect(summary.commitDistribution).toBe('focused');
    expect(summary.mostActiveRepos).toEqual(['repo1']);
  });

  it('should aggregate multiple repositories with mixed activity', () => {
    const metrics: RepoMetrics[] = [
      {
        repoPath: '/path/to/repo1',
        repoName: 'repo1',
        lastCommitDate: new Date(),
        commitCountInPeriod: 15,
        languages: [{ language: 'TypeScript', percentage: 100 }],
        isActive: true
      },
      {
        repoPath: '/path/to/repo2',
        repoName: 'repo2',
        lastCommitDate: new Date(),
        commitCountInPeriod: 5,
        languages: [{ language: 'Python', percentage: 100 }],
        isActive: true
      },
      {
        repoPath: '/path/to/repo3',
        repoName: 'repo3',
        lastCommitDate: null,
        commitCountInPeriod: 0,
        languages: [{ language: 'Java', percentage: 100 }],
        isActive: false
      }
    ];

    const summary = aggregator.aggregate(metrics);

    expect(summary.totalRepos).toBe(3);
    expect(summary.activeRepos).toBe(2);
    expect(summary.coldRepos).toBe(1);
    expect(summary.totalCommits).toBe(20);
    expect(summary.mostActiveRepos).toEqual(['repo1', 'repo2']);
  });

  it('should limit most active repos to 3', () => {
    const metrics: RepoMetrics[] = [
      {
        repoPath: '/path/to/repo1',
        repoName: 'repo1',
        lastCommitDate: new Date(),
        commitCountInPeriod: 100,
        languages: [],
        isActive: true
      },
      {
        repoPath: '/path/to/repo2',
        repoName: 'repo2',
        lastCommitDate: new Date(),
        commitCountInPeriod: 80,
        languages: [],
        isActive: true
      },
      {
        repoPath: '/path/to/repo3',
        repoName: 'repo3',
        lastCommitDate: new Date(),
        commitCountInPeriod: 60,
        languages: [],
        isActive: true
      },
      {
        repoPath: '/path/to/repo4',
        repoName: 'repo4',
        lastCommitDate: new Date(),
        commitCountInPeriod: 40,
        languages: [],
        isActive: true
      }
    ];

    const summary = aggregator.aggregate(metrics);

    expect(summary.mostActiveRepos).toHaveLength(3);
    expect(summary.mostActiveRepos).toEqual(['repo1', 'repo2', 'repo3']);
  });

  it('should limit top languages to 5', () => {
    const metrics: RepoMetrics[] = [
      {
        repoPath: '/path/to/repo1',
        repoName: 'repo1',
        lastCommitDate: new Date(),
        commitCountInPeriod: 10,
        languages: [
          { language: 'TypeScript', percentage: 20 },
          { language: 'JavaScript', percentage: 20 },
          { language: 'Python', percentage: 20 },
          { language: 'Java', percentage: 20 },
          { language: 'Go', percentage: 10 },
          { language: 'Rust', percentage: 10 }
        ],
        isActive: true
      }
    ];

    const summary = aggregator.aggregate(metrics);

    expect(summary.topLanguages.length).toBeLessThanOrEqual(5);
  });

  it('should classify distribution as sparse when no commits', () => {
    const metrics: RepoMetrics[] = [
      {
        repoPath: '/path/to/repo1',
        repoName: 'repo1',
        lastCommitDate: null,
        commitCountInPeriod: 0,
        languages: [],
        isActive: false
      },
      {
        repoPath: '/path/to/repo2',
        repoName: 'repo2',
        lastCommitDate: null,
        commitCountInPeriod: 0,
        languages: [],
        isActive: false
      }
    ];

    const summary = aggregator.aggregate(metrics);

    expect(summary.commitDistribution).toBe('sparse');
  });

  it('should classify distribution as focused for single active repo', () => {
    const metrics: RepoMetrics[] = [
      {
        repoPath: '/path/to/repo1',
        repoName: 'repo1',
        lastCommitDate: new Date(),
        commitCountInPeriod: 50,
        languages: [],
        isActive: true
      },
      {
        repoPath: '/path/to/repo2',
        repoName: 'repo2',
        lastCommitDate: null,
        commitCountInPeriod: 0,
        languages: [],
        isActive: false
      }
    ];

    const summary = aggregator.aggregate(metrics);

    expect(summary.commitDistribution).toBe('focused');
  });

  it('should calculate time range correctly', () => {
    const days = 14;
    const now = Date.now();
    const summary = aggregator.aggregate([], days);

    expect(Math.abs(summary.timeRange.end.getTime() - now)).toBeLessThan(1000);
    
    const expectedStart = now - days * 24 * 60 * 60 * 1000;
    expect(Math.abs(summary.timeRange.start.getTime() - expectedStart)).toBeLessThan(1000);
    
    expect(summary.timeRange.start.getTime()).toBeLessThan(summary.timeRange.end.getTime());
  });
});
