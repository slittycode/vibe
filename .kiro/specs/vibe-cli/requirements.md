# Requirements Document: vibe-cli

## Introduction

The vibe-cli tool provides developers with an AI-generated summary of their recent coding activity across git repositories. The system scans a configurable directory tree for git repositories, collects commit metrics and language statistics, aggregates this data into work pattern analysis, and uses Claude via AWS Bedrock to generate a casual, journal-style summary. The tool is designed as a globally installable npm package that runs as a single command with minimal configuration.

## Glossary

- **CLI_Entry_Point**: The command-line interface component that parses arguments and orchestrates the workflow
- **Repository_Scanner**: Component that recursively finds git repositories in a directory tree
- **Git_Analyzer**: Component that extracts commit metrics from a git repository
- **Language_Detector**: Component that identifies programming languages used in a repository
- **Data_Aggregator**: Component that combines repository metrics into work pattern insights
- **Bedrock_Client**: Component that generates casual summaries using Claude via AWS Bedrock
- **Config_Manager**: Component that loads and manages configuration from environment and defaults
- **RepoMetrics**: Data structure containing metrics for a single repository
- **WorkPatternSummary**: Aggregated data structure containing insights across all repositories
- **Active_Repository**: A repository with at least one commit in the specified time period
- **Cold_Repository**: A repository with no commits in the specified time period
- **Focused_Work**: Work pattern where all activity is concentrated in a single repository
- **Clustered_Work**: Work pattern where activity is concentrated in a few repositories with high variance
- **Spread_Work**: Work pattern where activity is distributed evenly across multiple repositories
- **Sparse_Work**: Work pattern with no activity in any repository

## Requirements

### Requirement 1: Command-Line Interface

**User Story:** As a developer, I want to run a simple command to get my coding activity summary, so that I can quickly understand my recent work patterns.

#### Acceptance Criteria

1. WHEN the user executes the vibe command without arguments, THE CLI_Entry_Point SHALL use a default of 7 days for the analysis period
2. WHEN the user provides the --days flag with a positive integer, THE CLI_Entry_Point SHALL analyze commits from that many days in the past
3. WHEN the user provides the --root flag with a directory path, THE CLI_Entry_Point SHALL scan that directory instead of the default root path
4. WHEN the user provides the --raw flag, THE CLI_Entry_Point SHALL output metrics in key=value format without calling Bedrock
5. WHEN command-line arguments are invalid, THE CLI_Entry_Point SHALL display a clear error message and exit with code 1
6. WHEN the vibe command completes successfully, THE CLI_Entry_Point SHALL output the summary to stdout and exit with code 0

### Requirement 2: Configuration Management

**User Story:** As a developer, I want to configure the tool through environment variables, so that I can customize behavior without passing arguments every time.

#### Acceptance Criteria

1. WHEN AWS credentials are not configured and --raw flag is not used, THE Config_Manager SHALL display an error message and exit with code 1
2. WHEN the --raw flag is used, THE Config_Manager SHALL skip AWS credential validation
3. WHEN the VIBE_ROOT environment variable is set, THE Config_Manager SHALL use that path as the default root directory
4. WHEN the VIBE_ROOT environment variable is not set, THE Config_Manager SHALL default to ~/code as the root directory
5. THE Config_Manager SHALL expand tilde (~) in path configurations to the user's home directory
6. WHEN a root path does not exist or is not a directory, THE Config_Manager SHALL display an error message and exit with code 1
7. WHEN AWS_REGION or AWS_DEFAULT_REGION is set, THE Config_Manager SHALL use that region for Bedrock
8. WHEN no AWS region is specified, THE Config_Manager SHALL default to us-east-1
9. WHEN BEDROCK_MODEL_ID is set, THE Config_Manager SHALL use that model ID
10. WHEN BEDROCK_MODEL_ID is not set, THE Config_Manager SHALL default to us.anthropic.claude-3-5-haiku-20241022-v1:0

### Requirement 3: Repository Discovery

**User Story:** As a developer, I want the tool to automatically find all my git repositories, so that I don't have to manually specify each one.

#### Acceptance Criteria

1. WHEN scanning a directory tree, THE Repository_Scanner SHALL identify all directories containing a .git subdirectory
2. WHEN a git repository is found, THE Repository_Scanner SHALL not scan inside that repository for nested repositories
3. WHEN scanning directories, THE Repository_Scanner SHALL skip hidden directories (starting with .)
4. WHEN scanning directories, THE Repository_Scanner SHALL skip common non-code directories including node_modules
5. WHEN no git repositories are found, THE Repository_Scanner SHALL return an empty list
6. WHEN permission is denied for a directory, THE Repository_Scanner SHALL log a warning and continue scanning accessible directories
7. THE Repository_Scanner SHALL return absolute paths for all discovered repositories

### Requirement 4: Git Commit Analysis

**User Story:** As a developer, I want accurate commit metrics for each repository, so that the summary reflects my actual coding activity.

#### Acceptance Criteria

1. WHEN analyzing a repository, THE Git_Analyzer SHALL execute git commands to retrieve commit history
2. WHEN a repository has commits, THE Git_Analyzer SHALL determine the date of the most recent commit
3. WHEN a repository has no commits, THE Git_Analyzer SHALL set the last commit date to null
4. WHEN analyzing a repository for a time period, THE Git_Analyzer SHALL count commits made within that period
5. WHEN a repository has at least one commit in the time period, THE Git_Analyzer SHALL classify it as an active repository
6. WHEN a repository has zero commits in the time period, THE Git_Analyzer SHALL classify it as a cold repository
7. WHEN git commands fail for a repository, THE Git_Analyzer SHALL log a warning and skip that repository
8. THE Git_Analyzer SHALL return non-negative commit counts for all repositories

### Requirement 5: Language Detection

**User Story:** As a developer, I want to see which programming languages I've been working with, so that I can understand my technology focus.

#### Acceptance Criteria

1. WHEN detecting languages in a repository, THE Language_Detector SHALL analyze file extensions to identify programming languages
2. WHEN calculating language distribution, THE Language_Detector SHALL compute the percentage of files for each detected language
3. THE Language_Detector SHALL return languages sorted by percentage in descending order
4. THE Language_Detector SHALL skip hidden directories and node_modules when analyzing files
5. WHEN a repository contains no recognized code files, THE Language_Detector SHALL return an empty language list
6. THE Language_Detector SHALL ensure the sum of language percentages does not exceed 100

### Requirement 6: Data Aggregation

**User Story:** As a developer, I want my repository metrics combined into meaningful patterns, so that I can understand my overall work behavior.

#### Acceptance Criteria

1. WHEN aggregating metrics, THE Data_Aggregator SHALL count the total number of repositories
2. WHEN aggregating metrics, THE Data_Aggregator SHALL count active repositories and cold repositories separately
3. WHEN aggregating metrics, THE Data_Aggregator SHALL sum the total commits across all repositories
4. WHEN aggregating metrics, THE Data_Aggregator SHALL determine the commit distribution pattern as focused, clustered, spread, or sparse
5. WHEN only one repository has commits, THE Data_Aggregator SHALL classify the pattern as focused
6. WHEN multiple repositories have commits with high variance, THE Data_Aggregator SHALL classify the pattern as clustered
7. WHEN multiple repositories have commits with low variance, THE Data_Aggregator SHALL classify the pattern as spread
8. WHEN no repositories have commits, THE Data_Aggregator SHALL classify the pattern as sparse
9. WHEN aggregating language statistics, THE Data_Aggregator SHALL identify the top 5 languages across all repositories
10. WHEN aggregating metrics, THE Data_Aggregator SHALL identify the top 3 most active repositories by commit count
11. THE Data_Aggregator SHALL ensure that activeRepos plus coldRepos equals totalRepos

### Requirement 7: AI Summary Generation

**User Story:** As a developer, I want a casual, friendly summary of my work, so that I can get insights in an engaging format.

#### Acceptance Criteria

1. WHEN generating a summary, THE Bedrock_Client SHALL call AWS Bedrock with the work pattern data
2. WHEN calling Bedrock, THE Bedrock_Client SHALL use the Claude 3.5 Haiku model via cross-region inference profile
3. WHEN calling Bedrock, THE Bedrock_Client SHALL request a casual, journal-style summary of 3-4 sentences
4. WHEN Bedrock returns a response, THE Bedrock_Client SHALL extract and return the generated text
5. WHEN the Bedrock request fails, THE Bedrock_Client SHALL display an error message with details and exit with code 1
6. THE Bedrock_Client SHALL never log or display AWS credentials in any output
7. THE Bedrock_Client SHALL use AWS SDK for secure communication with Bedrock
8. THE Bedrock_Client SHALL limit the request to 200 max tokens for fast responses
9. THE Bedrock_Client SHALL format distribution patterns as natural language in the prompt (focused, clustered, spread, sparse)

### Requirement 8: Output Formatting

**User Story:** As a developer, I want the summary displayed clearly in my terminal, so that I can easily read and understand it.

#### Acceptance Criteria

1. WHEN the analysis completes successfully without --raw flag, THE CLI_Entry_Point SHALL output the AI-generated summary to stdout
2. WHEN the --raw flag is used, THE CLI_Entry_Point SHALL output metrics in key=value format, one per line
3. WHEN outputting raw metrics, THE CLI_Entry_Point SHALL use pipe-friendly format for easy parsing
4. WHEN an error occurs, THE CLI_Entry_Point SHALL output error messages to stderr

### Requirement 9: Error Handling

**User Story:** As a developer, I want clear error messages when something goes wrong, so that I can understand and fix issues.

#### Acceptance Criteria

1. WHEN AWS credentials are not configured and --raw is not used, THE CLI_Entry_Point SHALL display "Error: AWS credentials not configured"
2. WHEN a specified root path is invalid, THE CLI_Entry_Point SHALL display "Error: Root path '{path}' does not exist or is not a directory"
3. WHEN Bedrock API fails, THE CLI_Entry_Point SHALL display "Error calling Bedrock API: {error message}"
4. WHEN no repositories are found, THE CLI_Entry_Point SHALL display "No git repositories found." and exit with code 0
5. WHEN git commands fail for a repository, THE Git_Analyzer SHALL log a warning and continue processing other repositories
6. WHEN permission is denied for a directory, THE Repository_Scanner SHALL log a warning and continue scanning accessible areas
7. WHEN Bedrock model is not available, THE CLI_Entry_Point SHALL display helpful error message about model access

### Requirement 10: Performance

**User Story:** As a developer, I want the tool to run quickly, so that I can get my summary without waiting.

#### Acceptance Criteria

1. WHEN scanning for repositories, THE Repository_Scanner SHALL use breadth-first search for efficient traversal
2. WHEN executing git commands, THE Git_Analyzer SHALL use minimal output formats to reduce parsing overhead
3. WHEN calling Bedrock, THE Bedrock_Client SHALL limit the request to 200 max tokens for fast responses
4. THE CLI_Entry_Point SHALL complete analysis in under 10 seconds for typical developer setups with 20-30 repositories
5. WHEN using --raw flag, THE CLI_Entry_Point SHALL complete in under 5 seconds by skipping AI generation

### Requirement 11: Security

**User Story:** As a developer, I want my AWS credentials and data handled securely, so that I can use the tool without security concerns.

#### Acceptance Criteria

1. WHEN reading AWS credentials, THE Config_Manager SHALL only use AWS SDK credential chain and never hardcode credentials
2. WHEN executing git commands, THE Git_Analyzer SHALL use execFile to prevent shell injection attacks
3. WHEN processing paths, THE CLI_Entry_Point SHALL validate and sanitize all paths before passing to git commands
4. THE Repository_Scanner SHALL respect file system permissions and handle permission errors gracefully
5. THE Repository_Scanner SHALL not follow symlinks that could lead outside the intended directory tree
6. WHEN making Bedrock calls, THE Bedrock_Client SHALL validate API responses before processing
7. THE Bedrock_Client SHALL never log or display AWS credentials in any output or error messages

### Requirement 12: Package Distribution

**User Story:** As a developer, I want to install the tool globally via npm, so that I can use it from anywhere on my system.

#### Acceptance Criteria

1. THE package SHALL be installable globally using npm install -g vibe-cli
2. WHEN installed globally, THE package SHALL provide a vibe command in the system PATH
3. THE package SHALL require Node.js version 22.0.0 or higher
4. THE package SHALL require git to be installed and available in the system PATH
5. THE package SHALL use ECMAScript modules (type: "module")
6. THE package SHALL include @aws-sdk/client-bedrock-runtime as a dependency
7. THE package SHALL work with standard AWS credential configuration methods (environment variables, profiles, IAM roles)
