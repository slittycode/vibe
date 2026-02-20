# AWS Bedrock Configuration for vibe-cli

This tool uses AWS Bedrock to access Claude for generating AI summaries.

## Prerequisites

1. AWS Account with Bedrock access
2. Claude 3.5 Haiku model enabled in your AWS region
3. AWS credentials configured

## AWS Credentials Setup

You need to configure AWS credentials using one of these methods:

### Option 1: Environment Variables
```bash
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_REGION=us-east-1  # optional, defaults to us-east-1
```

### Option 2: AWS Profile
```bash
export AWS_PROFILE=your_profile_name
```

### Option 3: AWS CLI Configuration
Run `aws configure` to set up credentials in `~/.aws/credentials`

## Configuration Options

### Environment Variables

- `AWS_REGION` or `AWS_DEFAULT_REGION`: AWS region (default: `us-east-1`)
- `BEDROCK_MODEL_ID`: Bedrock model ID (default: `us.anthropic.claude-3-5-haiku-20241022-v1:0`)
- `VIBE_ROOT`: Root directory to scan (default: `~/code`)

### Model IDs

The tool uses cross-region inference profiles for better availability:

- Default: `us.anthropic.claude-3-5-haiku-20241022-v1:0` (US cross-region)
- EU: `eu.anthropic.claude-3-5-haiku-20241022-v1:0` (EU cross-region)

To use a different model:
```bash
export BEDROCK_MODEL_ID=us.anthropic.claude-3-5-sonnet-20241022-v2:0
```

## Usage

### With AI Summary (requires AWS credentials)
```bash
vibe --days 7
```

### Raw Output (no AWS credentials needed)
```bash
vibe --raw --days 7
```

The `--raw` flag outputs metrics in key=value format without calling Bedrock, useful for:
- Piping to other tools
- Debugging
- Offline usage
- Avoiding API costs

## IAM Permissions

Your AWS credentials need the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel"
      ],
      "Resource": [
        "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-5-haiku-*"
      ]
    }
  ]
}
```

## Troubleshooting

### "AWS credentials not configured"
- Verify credentials are set using `aws sts get-caller-identity`
- Check that environment variables are exported in your current shell
- Try using `--raw` flag to test without AWS

### "Invocation of model ID ... isn't supported"
- Make sure you're using a cross-region inference profile (starts with `us.` or `eu.`)
- Verify the model is enabled in your AWS account via Bedrock console
- Check that your region has access to Claude models

### "Access Denied"
- Verify your IAM user/role has `bedrock:InvokeModel` permission
- Check that the model ARN in your IAM policy matches the model you're using

## Cost Considerations

Claude 3.5 Haiku via Bedrock pricing (as of 2024):
- Input: ~$0.25 per million tokens
- Output: ~$1.25 per million tokens

Each vibe-cli run uses approximately:
- Input: ~200 tokens (summary data)
- Output: ~100 tokens (3-4 sentences)

Cost per run: < $0.001 (less than a tenth of a cent)
