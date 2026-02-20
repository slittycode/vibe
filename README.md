# vibe-cli

AI-powered git repository activity summary tool that scans your repositories and generates casual, journal-style summaries of your recent coding activity.

## Installation

```bash
npm install -g vibe-cli
```

## Configuration

Set your Anthropic API key:

```bash
export ANTHROPIC_API_KEY="your-api-key-here"
```

Optionally, set a custom root directory (defaults to `~/code`):

```bash
export VIBE_ROOT="~/projects"
```

## Usage

```bash
# Analyze last 7 days (default)
vibe

# Analyze custom time period
vibe --days 14

# Analyze custom directory
vibe --root ~/projects

# Combine options
vibe --days 30 --root ~/work
```

## Requirements

- Node.js 22.0.0 or higher
- Git installed and available in PATH
- Anthropic API key

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
