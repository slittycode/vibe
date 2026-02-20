# vibe-cli

AI-powered git repository activity summary tool that scans your repositories and generates casual, journal-style summaries of your recent coding activity.

## Installation

```bash
npm install -g vibe-cli
```

## Configuration

Set up AWS credentials (required for AI summaries):

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

See `AWS_BEDROCK_SETUP.md` for detailed setup instructions.

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

# Use local LLM via Ollama
vibe --provider ollama --days 7

# Auto provider (tries Ollama → Bedrock → Template)
vibe --provider auto --days 7

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

- Tries Ollama → Bedrock → Template automatically
- Uses best available provider
- Seamless fallback handling

## Requirements

- Node.js 22.0.0 or higher
- Git installed and available in PATH
- AWS credentials (for Bedrock provider) OR Ollama (for local LLM) OR use template/auto providers for API-free operation

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
