# Implementation Plan: vibe-cli

## Overview

This plan implements a CLI tool that scans git repositories, analyzes commit activity, and generates AI-powered summaries of coding patterns using Claude via AWS Bedrock. The implementation follows a bottom-up approach, building core utilities first, then data collection components, aggregation logic, Bedrock integration, and finally the CLI orchestration layer with support for both AI summaries and raw metric output.

## Tasks

- [x] 1. Set up project structure and configuration
  - Create package.json with type: "module", bin entry, and dependencies
  - Create tsconfig.json for TypeScript compilation targeting ESM
  - Set up directory structure: src/, dist/, tests/
  - Configure build script to compile TypeScript to dist/
  - Add shebang to entry point for CLI execution
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 2. Implement configuration management
  - [x] 2.1 Create Config interface and ConfigManager class
    - Define Config interface with rootPath, awsRegion, modelId, defaultDays, maxDepth
    - Implement loadConfig(requireAwsConfig) to read from environment variables
    - Implement tilde expansion for paths
    - Check AWS credentials via SDK credential chain when requireAwsConfig is true
    - Default to us-east-1 region and cross-region inference profile model ID
    - Skip AWS validation when --raw flag is used
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_
  
  - [x] 2.2 Write property test for tilde expansion
    - **Property 14: Tilde Expansion**
    - **Validates: Requirements 2.4**

- [x] 3. Implement repository scanner
  - [x] 3.1 Create RepositoryScanner class with scanRepos method
    - Implement breadth-first search to traverse directory tree
    - Check for .git subdirectory to identify repositories
    - Skip hidden directories (starting with .)
    - Skip node_modules and other common non-code directories
    - Return array of absolute paths to discovered repositories
    - Handle permission errors gracefully with warnings
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 10.1_
  
  - [x] 3.2 Write property test for repository scanning completeness
    - **Property 1: Repository Scanning Completeness**
    - **Validates: Requirements 3.1, 3.2, 3.7**
  
  - [x] 3.3 Write property test for hidden directory exclusion
    - **Property 2: Hidden Directory Exclusion**
    - **Validates: Requirements 3.3, 3.4**
  
  - [x] 3.4 Write property test for symlink safety
    - **Property 20: Symlink Safety**
    - **Validates: Requirements 11.5**

- [x] 4. Implement git command execution utility
  - [x] 4.1 Create execGit helper function
    - Use child_process.execFile for safe command execution
    - Execute git commands in specified repository directory
    - Return stdout as string on success
    - Return empty string on failure, log warning
    - Validate and sanitize paths before execution
    - _Requirements: 4.1, 4.7, 11.2, 11.3_
  
  - [x] 4.2 Write property test for path validation
    - **Property 19: Path Validation**
    - **Validates: Requirements 11.3**

- [x] 5. Implement language detector
  - [x] 5.1 Create LanguageDetector class with detectLanguages method
    - Define extension-to-language mapping for common languages
    - Recursively walk directory tree counting files by extension
    - Skip hidden directories and node_modules
    - Calculate percentage distribution of languages
    - Sort languages by percentage descending
    - Return LanguageStats array
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [x] 5.2 Write property test for language percentage validity
    - **Property 6: Language Percentage Validity**
    - **Validates: Requirements 5.2, 5.3, 5.6**
  
  - [x] 5.3 Write property test for directory exclusion
    - **Property 7: Language Detection Directory Exclusion**
    - **Validates: Requirements 5.4**

- [x] 6. Implement git analyzer
  - [x] 6.1 Create GitAnalyzer class with analyzeRepo method
    - Execute git log to get last commit date
    - Execute git log with --since flag to count commits in period
    - Parse git output to extract dates and counts
    - Call LanguageDetector to get language statistics
    - Determine isActive based on commit count
    - Return RepoMetrics object
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.8, 10.2_
  
  - [x] 6.2 Write property test for commit count accuracy
    - **Property 3: Commit Count Accuracy**
    - **Validates: Requirements 4.4**
  
  - [x] 6.3 Write property test for repository classification
    - **Property 4: Repository Classification Correctness**
    - **Validates: Requirements 4.5, 4.6**
  
  - [x] 6.4 Write property test for non-negative commit counts
    - **Property 5: Non-Negative Commit Counts**
    - **Validates: Requirements 4.8**

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement data aggregator
  - [x] 8.1 Create DataAggregator class with aggregate method
    - Count total, active, and cold repositories
    - Sum total commits across all repositories
    - Implement determineDistribution helper for commit pattern analysis
    - Aggregate language statistics across all repositories
    - Calculate top 5 languages by percentage
    - Identify top 3 most active repositories by commit count
    - Calculate time range based on days parameter
    - Return WorkPatternSummary object
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10_
  
  - [x] 8.2 Write property test for aggregation consistency
    - **Property 8: Aggregation Consistency**
    - **Validates: Requirements 6.1, 6.2, 6.7**
  
  - [x] 8.3 Write property test for total commits accuracy
    - **Property 9: Total Commits Accuracy**
    - **Validates: Requirements 6.3**
  
  - [x] 8.4 Write property test for distribution classification
    - **Property 10: Distribution Classification Validity**
    - **Validates: Requirements 6.4, 6.8, 6.9**
  
  - [x] 8.5 Write property test for top languages limit
    - **Property 11: Top Languages Limit**
    - **Validates: Requirements 6.5**
  
  - [x] 8.6 Write property test for top repositories limit
    - **Property 12: Top Repositories Limit**
    - **Validates: Requirements 6.6**
  
  - [x] 8.7 Write property test for time range calculation
    - **Property 13: Time Range Calculation**
    - **Validates: Requirements 1.2**

- [x] 9. Implement Bedrock API client
  - [x] 9.1 Create BedrockClient class with generateVibeCheck method
    - Initialize AWS Bedrock Runtime client with region
    - Implement buildPrompt helper to format WorkPatternSummary into prompt with natural language distribution descriptions
    - Call Bedrock with Claude 3.5 Haiku via cross-region inference profile
    - Set max_tokens to 200 for concise responses
    - Extract text from Bedrock API response
    - Handle Bedrock API errors with descriptive messages
    - Never log or expose AWS credentials in output
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 10.3, 11.1, 11.7_
  
  - [x] 9.2 Write property test for AWS credential security
    - **Property 15: AWS Credential Security**
    - **Validates: Requirements 7.6, 11.7**
  
  - [x] 9.3 Write property test for secure communication
    - **Property 16: Secure Bedrock Communication**
    - **Validates: Requirements 7.7, 11.6**
  
  - [x] 9.4 Write property test for API response validation
    - **Property 21: API Response Validation**
    - **Validates: Requirements 11.6**

- [x] 10. Implement CLI entry point and argument parsing
  - [x] 10.1 Create CLI runner with argument parsing
    - Use commander library to parse CLI arguments
    - Define --days flag with default value of 7
    - Define --root flag for custom root path
    - Define --raw flag for outputting metrics without AI summary
    - Implement parseCLIArgs to extract CLIOptions
    - Validate that days is positive integer
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
  
  - [x] 10.2 Write unit tests for CLI argument parsing
    - Test default values
    - Test custom --days and --root flags
    - Test --raw flag
    - Test invalid argument handling
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 11. Implement main orchestration logic
  - [x] 11.1 Create main function to orchestrate workflow
    - Load configuration using ConfigManager (skip AWS validation if --raw)
    - Parse CLI arguments
    - Scan repositories using RepositoryScanner
    - Analyze each repository using GitAnalyzer
    - Aggregate metrics using DataAggregator
    - If --raw flag: output metrics in key=value format
    - If not --raw: generate summary using BedrockClient and output to stdout
    - Handle all error scenarios with appropriate messages
    - Exit with code 0 on success, code 1 on error
    - _Requirements: 1.5, 1.6, 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_
  
  - [x] 11.2 Write property test for successful execution output
    - **Property 17: Successful Execution Output**
    - **Validates: Requirements 1.5, 1.6, 8.1**
  
  - [x] 11.3 Write property test for error output routing
    - **Property 18: Error Output Routing**
    - **Validates: Requirements 8.3, 8.4**

- [x] 12. Create CLI entry point file
  - [x] 12.1 Create src/index.ts with shebang and main invocation
    - Add #!/usr/bin/env node shebang
    - Import and invoke main function
    - Catch unhandled errors and exit with code 1
    - _Requirements: 12.2_

- [x] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Add package build and distribution setup
  - [x] 14.1 Configure TypeScript compilation and build process
    - Ensure tsconfig.json outputs to dist/ directory
    - Add build script to package.json: "tsc"
    - Add prepublishOnly script to run build
    - Ensure bin entry points to dist/index.js
    - Make dist/index.js executable in build process
    - _Requirements: 12.1, 12.2_
  
  - [x] 14.2 Write integration test for end-to-end workflow
    - Create temporary test directory with mock git repositories
    - Run vibe CLI against test directory
    - Verify output contains expected patterns
    - Mock Claude API to avoid external dependencies
    - _Requirements: 1.5, 8.1_

- [x] 15. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript with ESM modules as specified in the design


## AWS Bedrock Configuration

This implementation uses AWS Bedrock instead of the Anthropic Claude API directly. Key differences:

- **Authentication**: Uses AWS SDK credential chain (environment variables, profiles, IAM roles) instead of ANTHROPIC_API_KEY
- **Model ID**: Uses cross-region inference profile `us.anthropic.claude-3-5-haiku-20241022-v1:0` for better availability
- **Region**: Defaults to `us-east-1`, configurable via AWS_REGION environment variable
- **Raw Mode**: The `--raw` flag allows running without AWS credentials, outputting metrics in pipe-friendly key=value format
- **Dependencies**: Requires `@aws-sdk/client-bedrock-runtime` package

See `AWS_BEDROCK_SETUP.md` for detailed configuration instructions, IAM permissions, and troubleshooting.
