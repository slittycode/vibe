# Ollama Setup for vibe-cli

This guide covers setting up Ollama for local LLM integration with vibe-cli.

## Prerequisites

1. [Ollama installed](https://ollama.com/download)
2. Local LLM model(s) downloaded
3. Sufficient system resources (RAM/CPU)

## Installation

### macOS/Linux
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### Windows
Download and run the installer from [ollama.com](https://ollama.com/download)

## Starting Ollama

```bash
# Start Ollama server
ollama serve

# In another terminal, verify it's running
curl http://localhost:11434/api/tags
```

## Recommended Models

### Lightweight (Good for summaries)
```bash
ollama pull qwen2.5:1.5b    # ~1GB RAM
ollama pull phi3:mini       # ~2GB RAM
ollama pull gemma2:2b       # ~2GB RAM
```

### Balanced (Better quality)
```bash
ollama pull qwen2.5:7b      # ~5GB RAM
ollama pull llama3.1:8b     # ~5GB RAM
ollama pull mistral:7b      # ~5GB RAM
```

### High Quality (More resources)
```bash
ollama pull llama3.1:70b    # ~40GB RAM
ollama pull mixtral:8x7b    # ~50GB RAM
```

## Configuration

### Environment Variables
```bash
# Optional: Custom Ollama URL (default: http://localhost:11434)
export OLLAMA_BASE_URL="http://localhost:11434"

# Optional: Specific model (default: auto-detect)
export OLLAMA_MODEL="qwen2.5:7b"
```

### Usage Examples

```bash
# Auto-detect best available model
vibe --provider ollama --days 7

# Use specific model
OLLAMA_MODEL=qwen2.5:7b vibe --provider ollama --days 7

# Custom Ollama server
OLLAMA_BASE_URL=http://192.168.1.100:11434 vibe --provider ollama --days 7
```

## Auto Provider Mode

The `auto` provider tries Ollama first, then falls back to AWS Bedrock, then templates:

```bash
# Best available provider automatically
vibe --provider auto --days 7
```

## Model Preference Order

vibe-cli automatically selects models in this order:
1. `llama3.2`, `llama3.1`, `llama3`
2. `mistral`, `mixtral`
3. `qwen2.5`, `phi3`, `gemma2`
4. First available model

## Troubleshooting

### "Cannot connect to Ollama"
```bash
# Start Ollama server
ollama serve

# Check if running
curl http://localhost:11434/api/tags
```

### "No Ollama models available"
```bash
# Download a model
ollama pull qwen2.5:7b

# List available models
ollama list
```

### Performance Issues
- Use smaller models for faster responses
- Ensure sufficient RAM available
- Close other memory-intensive applications

## Resource Requirements

| Model Size | RAM Required | Approx. Response Time |
|------------|-------------|---------------------|
| 1-2B       | 2-4 GB      | 2-5 seconds         |
| 7-8B       | 8-12 GB     | 5-10 seconds        |
| 70B+       | 40+ GB      | 20+ seconds         |

## Privacy Benefits

- **100% Local**: No data leaves your machine
- **No API Keys**: No external service dependencies
- **Private**: Your git data stays private
- **Offline**: Works without internet connection
