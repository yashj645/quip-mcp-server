# Quip MCP Server - Agent Core Runtime Deployment

This directory contains the AWS CDK infrastructure for deploying the Quip MCP Server to AWS Agent Core Runtime.

## Overview

AWS Agent Core Runtime provides a serverless, secure hosting environment for AI agents and MCP (Model Context Protocol) servers with enhanced capabilities:

- **8-hour execution time** (vs 15-minute Lambda limit)
- **100MB payload support** (vs 6MB Lambda limit)
- **Session isolation** with dedicated microVMs
- **Built-in authentication** and observability
- **Consumption-based pricing**

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   MCP Client    │────│  Agent Core      │────│  Quip MCP       │
│   (Claude, etc) │    │  Runtime         │    │  Server         │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │                         │
                              ▼                         ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │ IAM Role &       │    │ S3 Bucket &     │
                       │ Permissions      │    │ Secrets Manager │
                       └──────────────────┘    └─────────────────┘
```

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** configured with credentials
3. **Node.js** (version 18 or higher)
4. **Docker** with buildx support for ARM64
5. **CDK CLI** installed globally (`npm install -g aws-cdk`)

## Required Resources

Before deployment, ensure the following resources exist:

### 1. Secrets Manager Secret

Create a secret containing your Quip API token and optional MCP API key:

```bash
aws secretsmanager create-secret \
  --name "quip-mcp-server/secrets" \
  --description "Quip MCP Server credentials" \
  --secret-string '{
    "QUIP_TOKEN":"your-quip-api-token-here",
    "MCP_API_KEY":"your-mcp-api-key-here",
    "QUIP_BASE_URL":"https://platform.quip.com"
  }' \
  --region us-west-2
```

**Secret Format Options:**
- **JSON Format** (recommended): Contains structured data with QUIP_TOKEN, MCP_API_KEY, and QUIP_BASE_URL
- **Simple String**: Just the Quip token as plain text (legacy support)
- **Alternative Keys**: Supports token, quipToken, apiKey, mcpApiKey, baseUrl, quipBaseUrl for flexibility

### 2. S3 Bucket (Optional)

The stack can create a new S3 bucket or use an existing one. To use an existing bucket, specify it in the deployment parameters.

## Deployment

### 1. Install Dependencies

```bash
cd infrastructure/agent-core
npm install
```

### 2. Bootstrap CDK (First Time Only)

```bash
npx cdk bootstrap
```

### 3. Deploy the Stack

```bash
# Deploy with default settings (IAM SigV4 authentication)
npx cdk deploy

# Deploy with custom parameters
npx cdk deploy \
  --context agentRuntimeName=my_quip_mcp_server \
  --context s3BucketName=my-existing-bucket \
  --context secretARN=arn:aws:secretsmanager:region:account:secret:name

# Deploy with JWT Bearer Token authentication (requires Cognito or similar OAuth provider)
npx cdk deploy \
  --context agentRuntimeName=my_quip_mcp_server \
  --context secretARN=arn:aws:secretsmanager:region:account:secret:name \
  --context jwtDiscoveryUrl=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_poolid/.well-known/openid-configuration \
  --context jwtAllowedClients=client-id-123,client-id-456 \
  --context jwtAllowedAudiences=my-app-audience
```

**Required Parameter:**
- `secretARN`: Complete ARN of the Secrets Manager secret containing Quip credentials

**Optional Parameters:**
- `agentRuntimeName`: Name for the Agent Core Runtime (default: 'quip_mcp_server', pattern: a-zA-Z0-9_)
- `s3BucketName`: Existing S3 bucket name (creates new if not specified)
- `s3Prefix`: S3 key prefix for data storage (default: 'quip-data/')

**JWT Authorization Parameters (Optional):**
- `jwtDiscoveryUrl`: OpenID Connect discovery URL for JWT validation (must match pattern: `^.+/\.well-known/openid-configuration$`)
- `jwtAllowedClients`: Comma-separated list or array of allowed client identifiers for JWT authentication
- `jwtAllowedAudiences`: Comma-separated list or array of allowed audiences for JWT token validation (optional)

When JWT parameters are provided, the Agent Runtime will use JWT Bearer Token authentication instead of the default IAM SigV4 authentication.

### 4. Verify Deployment

After deployment, you'll see outputs similar to:

```
✅  QuipMcpAgentCoreStack

Outputs:
QuipMcpAgentCoreStack.AgentRuntimeArn = arn:aws:bedrock-agent-core:us-west-2:123456789012:runtime/quip_mcp_server_xyz123
QuipMcpAgentCoreStack.McpInvocationEndpoint = https://bedrock-agent-core.us-west-2.amazonaws.com/runtimes/...
QuipMcpAgentCoreStack.EcrRepositoryUri = 123456789012.dkr.ecr.us-west-2.amazonaws.com/quip_mcp_server_repository
```

## Configuration

The stack creates an Agent Core Runtime with the following configuration:

- **Protocol**: MCP (Model Context Protocol)
- **Port**: 8000 (MCP standard)
- **Network**: Public access
- **Platform**: ARM64 Linux container
- **Secret Handling**: Automatic retrieval from AWS Secrets Manager via run.js wrapper
- **Authentication**: Built-in MCP authentication with configurable API keys
- **Update Strategy**: Supports in-place updates without recreating runtime

### Environment Variables

The following environment variables are automatically configured:

| Variable | Value | Description |
|----------|-------|-------------|
| `MCP_PORT` | `8000` | MCP server port |
| `MCP_AUTH_ENABLED` | `true` | Enable MCP authentication |
| `MCP_API_KEY_HEADER` | `X-API-Key` | HTTP header for MCP API key |
| `STORAGE_TYPE` | `s3` | Use S3 for data storage |
| `S3_BUCKET` | `<bucket-name>` | S3 bucket for Quip data |
| `S3_REGION` | `<region>` | AWS region |
| `S3_PREFIX` | `quip-data/` | S3 key prefix |
| `S3_URL_EXPIRATION` | `3600` | S3 presigned URL expiration (seconds) |
| `USE_PRESIGNED_URLS` | `true` | Enable S3 presigned URLs |
| `SECRET_ARN` | `<secret-arn>` | Secrets Manager ARN |
| `NODE_ENV` | `production` | Node.js environment |
| `LOG_LEVEL` | `info` | Application log level |

**Runtime Variables** (Set by run.js from Secrets Manager):
- `QUIP_TOKEN`: Extracted from secret
- `MCP_API_KEY`: Extracted from secret (if available)
- `QUIP_BASE_URL`: Extracted from secret (if available)

## Authentication Methods

The Agent Core Runtime supports two authentication methods:

### 1. AWS IAM Authentication (Default)

Default authentication method using AWS IAM SigV4 signing.

### 2. JWT Bearer Token Authentication (Optional)

When JWT configuration is provided, the runtime accepts JWT bearer tokens for authentication. This is useful for integrating with OAuth providers like AWS Cognito, Auth0, or other OpenID Connect compliant services.

**Benefits of JWT Authentication:**
- User-specific authentication contexts
- Support for OAuth flows (Authorization Code Grant)
- Integration with existing identity providers
- User session management

**Requirements:**
- OpenID Connect compliant identity provider
- Discovery URL ending with `/.well-known/openid-configuration`
- Valid client identifiers
- Properly signed JWT tokens with required claims

## Setting Up JWT Authentication

### Prerequisites

1. **OAuth Provider Setup**: Configure an OAuth provider (e.g., AWS Cognito)
2. **User Pool**: Create users in your OAuth provider
3. **Client Configuration**: Register client applications

### Example: AWS Cognito Setup

```bash
#!/bin/bash

# Create Cognito User Pool
export POOL_ID=$(aws cognito-idp create-user-pool \
  --pool-name "QuipMcpUserPool" \
  --policies '{"PasswordPolicy":{"MinimumLength":8}}' \
  --region us-east-1 | jq -r '.UserPool.Id')

# Create App Client
export CLIENT_ID=$(aws cognito-idp create-user-pool-client \
  --user-pool-id $POOL_ID \
  --client-name "QuipMcpClient" \
  --no-generate-secret \
  --explicit-auth-flows "ALLOW_USER_PASSWORD_AUTH" "ALLOW_REFRESH_TOKEN_AUTH" \
  --region us-east-1 | jq -r '.UserPoolClient.ClientId')

# Create Test User
aws cognito-idp admin-create-user \
  --user-pool-id $POOL_ID \
  --username "testuser" \
  --temporary-password "TempPass123!" \
  --region us-east-1 \
  --message-action SUPPRESS

# Set Permanent Password
aws cognito-idp admin-set-user-password \
  --user-pool-id $POOL_ID \
  --username "testuser" \
  --password "MySecurePass123!" \
  --region us-east-1 \
  --permanent

echo "Discovery URL: https://cognito-idp.us-east-1.amazonaws.com/$POOL_ID/.well-known/openid-configuration"
echo "Client ID: $CLIENT_ID"
```

### Deploy with JWT Configuration

```bash
npx cdk deploy \
  --context secretARN=arn:aws:secretsmanager:region:account:secret:name \
  --context jwtDiscoveryUrl=https://cognito-idp.us-east-1.amazonaws.com/$POOL_ID/.well-known/openid-configuration \
  --context jwtAllowedClients=$CLIENT_ID
```

## Testing the Deployment

### AWS IAM Authentication

When using the default IAM authentication, you'll need to:

1. **Configure AWS Credentials**: Ensure your AWS CLI or SDK is configured with appropriate permissions
2. **Use AWS Signature Version 4**: All requests must be signed using AWS SigV4
3. **Access via AWS SDK**: Use AWS Bedrock Agent Runtime SDK or direct HTTP calls with proper signing

### JWT Bearer Token Authentication

When using JWT authentication, you'll need to:

1. **Obtain JWT Token**: Get a valid JWT token from your OAuth provider
2. **Include Authorization Header**: Add `Authorization: Bearer <token>` to requests
3. **Verify Token Claims**: Ensure token contains required `aud` and `client_id` claims

#### Testing with JWT Token

```bash
# Get JWT token from Cognito
export TOKEN=$(aws cognito-idp initiate-auth \
  --client-id "$CLIENT_ID" \
  --auth-flow USER_PASSWORD_AUTH \
  --auth-parameters USERNAME='testuser',PASSWORD='MySecurePass123!' \
  --region us-east-1 | jq -r '.AuthenticationResult.AccessToken')

# Test MCP endpoint with JWT token
curl -X POST "https://bedrock-agentcore.us-east-1.amazonaws.com/runtimes/${ENCODED_AGENT_ARN}/invocations?qualifier=DEFAULT" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -H "X-Amzn-Bedrock-AgentCore-Runtime-Session-Id: test-session-123" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

#### JWT Token Requirements

The JWT token must include:
- **iss** (issuer): Must match the configured discovery URL domain
- **aud** (audience): Must be in the allowed audiences list (if specified)
- **client_id**: Must be in the allowed clients list
- **exp** (expiration): Token must not be expired
- Valid signature from the OAuth provider

### Using AWS CLI to Test

```bash
# Get agent runtime status
aws bedrock-agentcore-control get-agent-runtime --agent-runtime-id "your-agent-runtime-id(you can find it from stack outputs)"

# Test MCP endpoint (requires proper IAM permissions)
aws bedrock-agentcore invoke-agent-runtime \
--agent-runtime-arn "your-agent-runtime-arn(you can find it from stack outputs)" \
--payload `echo '{"jsonrpc":"2.0","id":123456,"method":"tools/list","params":{}}'|base64|tr -d '\n'` \
--content 'application/json' --accept 'application/json, text/event-stream' outfile
```

### Using MCP Inspector with AWS Authentication

```bash
# Install MCP Inspector
npx @modelcontextprotocol/inspector

# Note: MCP Inspector requires custom AWS IAM authentication setup
# Configure your AWS credentials before accessing the endpoint
```

## Stack Outputs

| Output | Description |
|--------|-------------|
| `AgentRuntimeArn` | ARN of the created Agent Core Runtime |
| `AgentRuntimeId` | ID of the Agent Core Runtime |
| `McpInvocationEndpoint` | Complete URL for MCP client connections |
| `S3BucketName` | Name of the S3 bucket for data storage |
| `AgentCoreRoleArn` | ARN of the IAM execution role |
| `AuthorizationType` | Authentication method (IAM SigV4 or JWT Bearer Token) |
| `JWTDiscoveryUrl` | OpenID Connect discovery URL (JWT mode only) |
| `AllowedClients` | Allowed client identifiers (JWT mode only) |
| `AllowedAudiences` | Allowed audiences (JWT mode only, if specified) |

## Monitoring and Logs

- **CloudWatch Logs**: Automatically configured for application logs
- **Agent Runtime Status**: Check via AWS Console or CLI
- **Container Health**: Built-in health checks

```bash
# Check agent runtime status
aws bedrock-agent-core-control list-agent-runtimes --region us-west-2

# Get specific runtime details
aws bedrock-agent-core-control describe-agent-runtime \
  --agent-runtime-arn "arn:aws:bedrock-agent-core:us-west-2:123456789012:runtime/quip_mcp_server_xyz123"
```

## Troubleshooting

### Common Issues

1. **Container Build Failures**
   - Ensure Docker is running and has build-x support
   - Check platform architecture: `docker build-x ls`
   - Verify all dependencies are installed (including @aws-sdk/client-secrets-manager)

2. **Permission Errors**
   - Verify IAM permissions for CDK deployment
   - Check Agent Core Runtime service permissions
   - Ensure secrets manager permissions are correctly configured

3. **Secret Not Found**
   - Ensure Secrets Manager secret exists in the correct region
   - Verify secret ARN matches the configuration
   - Check secret format is valid JSON or plain text

4. **MCP Connection Failures**
   - Check AWS IAM permissions for bedrock-agent-core service
   - Verify endpoint URL encoding
   - Confirm agent runtime status is "READY"
   - Ensure AWS credentials are properly configured
   - Validate MCP_API_KEY if authentication is enabled

5. **Deployment Update Issues**
   - Stack now uses updateAgentRuntime for updates (not create)
   - Check agent runtime ID consistency during updates
   - Verify container image updates are properly applied

6. **Missing Dependencies**
   - Error: "Cannot find module '@aws-sdk/client-secrets-manager'"
   - Solution: Dependency is now included in package.json
   - Rebuild container if using cached images

### Debug Commands

```bash
# View CDK diff before deployment
npx cdk diff

# Synthesize CloudFormation template
npx cdk synth

# View stack events
aws cloudformation describe-stack-events --stack-name QuipMcpAgentCoreStack

# Check agent runtime logs
aws logs describe-log-groups --log-group-name-prefix "/aws/bedrock-agent-core"
```

## Cleanup

To remove all resources:

```bash
npx cdk destroy
```

This will delete:
- Agent Core Runtime
- ECR repository and images
- IAM roles and policies
- S3 bucket (if created by the stack)

**Note**: Secrets Manager secrets are not automatically deleted and may incur charges.

## Cost Optimization

- **Container Images**: Lifecycle policies automatically clean up old images
- **S3 Storage**: 180-day expiration policy for data files
- **Consumption Pricing**: Pay only for actual runtime usage
- **Session Isolation**: Automatic resource cleanup after sessions

## Security Features

- **IAM Least Privilege**: Minimal required permissions with specific resource ARNs
- **VPC Isolation**: Optional VPC deployment support
- **Encrypted Storage**: S3 server-side encryption
- **Secret Management**: AWS Secrets Manager integration with automatic retrieval
- **Container Security**: Image vulnerability scanning enabled
- **Workload Identity**: Secure authentication using Agent Core Runtime workload identity
- **Service Principal Conditions**: Strict IAM assume role conditions with source account/ARN validation
- **Secret Extraction**: Multiple fallback mechanisms for secret format compatibility
- **Process Isolation**: Dedicated microVM execution environment

## Implementation Details

### Secret Handling Architecture

The deployment uses a two-stage secret handling approach:

1. **Build Time**: CDK deploys the infrastructure with SECRET_ARN environment variable
2. **Runtime**: The run.js wrapper script:
   - Retrieves secrets from AWS Secrets Manager
   - Supports multiple secret formats (JSON, plain text)
   - Sets environment variables before starting the MCP server
   - Handles graceful fallbacks for different key naming conventions

### Container Structure

```
/app/
├── dist/           # Compiled TypeScript code
├── run.js          # Secret management wrapper
├── package.json    # Dependencies including AWS SDK
└── node_modules/   # Production dependencies only
```

### Update Behavior

The CDK stack is designed for safe updates:
- Uses `updateAgentRuntime` instead of `createAgentRuntime` for re-deployments
- Maintains physical resource ID consistency
- Supports in-place container image updates
- Comprehensive error handling for rollback scenarios