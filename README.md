# vibe-cli

AI-powered git repository activity summary tool that scans your repositories and generates casual, journal-style summaries of your recent coding activity.

## Installation

```bash
npm install -g vibe-cli
```

## Configuration

Set up AWS credentials for Bedrock mode:

```bash
# Option 1: Environment variables
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_REGION="us-east-1"

# Option 2: AWS profile
export AWS_PROFILE="your-profile-name"
```

Optionally, set a custom root directory (defaults to `~/code`):

```bash
export VIBE_ROOT="~/projects"
```

If you only use `template` mode, AWS credentials are not required.
See `AWS_BEDROCK_SETUP.md` for detailed Bedrock setup instructions.

## Usage

```bash
# Analyze last 7 days (default)
vibe

# Analyze custom time period
vibe --days 14

# Analyze custom directory
vibe --root ~/projects

# Use template provider (no API keys needed)
vibe --provider template --days 7

# Use Bedrock explicitly
vibe --provider bedrock --days 7

# Use local LLM via Ollama
vibe --provider ollama --days 7

# Auto provider (default order: Bedrock → Ollama → Template)
vibe --provider auto --days 7

# Auto provider, local-first order (Ollama → Bedrock → Template)
vibe --provider auto --fallback-order local-first --days 7

# Debug provider routing / fallback reasons
vibe --provider auto --debug-provider --days 7

# Raw output (no AI processing)
vibe --raw --days 7

# Show provider status
vibe --status

# Combine options
vibe --days 30 --root ~/work --provider template
```

## Providers

### Bedrock (Default)

- Uses AWS Bedrock with Claude 3.5 Haiku
- Requires AWS credentials configuration
- Most natural, conversational summaries

### Template (API-Free)

- Pattern-based text generation
- No API keys required
- Fast and reliable offline operation

### Ollama (Local LLM)

- Local LLM integration via Ollama
- Full privacy with local models
- Requires Ollama installation and models
- See `OLLAMA_SETUP.md` for setup guide

### Auto (Intelligent Fallback)

- Deterministic fallback chain with configurable order:
  - `--fallback-order cloud-first` (default): Bedrock → Ollama → Template
  - `--fallback-order local-first`: Ollama → Bedrock → Template
- Explicit fallback reason logging with `--debug-provider`
- Bedrock remains the preferred cloud path in `cloud-first` mode

## Failure Behavior and Debugging

Use `--debug-provider` to see why a provider was skipped or why fallback happened:

```bash
vibe --provider auto --fallback-order cloud-first --debug-provider
```

Example debug output (stderr):

```text
[debug-provider] selected_provider=auto
[debug-provider] auto_chain=bedrock -> ollama -> template
[debug-provider] [provider-fallback] provider=bedrock decision=skipped-unavailable reason=bedrock is unavailable: missing AWS credentials or AWS_PROFILE
[debug-provider] [provider-fallback] provider=ollama decision=fallback reason=Ollama API error: Cannot connect to Ollama. Is Ollama running? Start with: ollama serve
[debug-provider] [provider-fallback] provider=template decision=success reason=provider returned grounded summary
```

Grounding guardrails are applied so summaries avoid hallucinated commit hashes/file paths and stay tied to detected git facts.

## Requirements

- Node.js 22.0.0 or higher
- Git installed and available in PATH
- AWS credentials (for Bedrock provider), or Ollama (for local LLM), or template/auto providers for API-free operation

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev

# Run tests
npm test
```

## License

MIT
