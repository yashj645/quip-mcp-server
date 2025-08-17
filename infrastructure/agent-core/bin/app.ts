#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { QuipMcpAgentCoreStack, QuipMcpAgentCoreStackProps } from '../lib/quip-mcp-agent-core-stack';

const app = new cdk.App();

// Get required parameters from CDK context
const secretARN = app.node.tryGetContext('secretARN');
const agentRuntimeName = app.node.tryGetContext('agentRuntimeName');
const s3BucketName = app.node.tryGetContext('s3BucketName');

// Optional JWT authorization parameters
const jwtDiscoveryUrl = app.node.tryGetContext('jwtDiscoveryUrl');
const jwtAllowedClients = app.node.tryGetContext('jwtAllowedClients');
const jwtAllowedAudiences = app.node.tryGetContext('jwtAllowedAudiences');

// Validate required parameters
if (!secretARN) {
  throw new Error('secretARN context parameter is required. Pass it via --context secretARN=<arn>');
}

// Validate agentRuntimeName if provided
if (agentRuntimeName !== undefined && agentRuntimeName !== null) {
  if (typeof agentRuntimeName !== 'string' || agentRuntimeName.trim() === '') {
    throw new Error('agentRuntimeName must be a non-empty string');
  }
  if (!/^[a-zA-Z0-9_]+$/.test(agentRuntimeName)) {
    throw new Error('agentRuntimeName must contain only letters, numbers, and underscores (pattern: a-zA-Z0-9_)');
  }
}

// Validate s3BucketName if provided
if (s3BucketName !== undefined && s3BucketName !== null) {
  if (typeof s3BucketName !== 'string' || s3BucketName.trim() === '') {
    throw new Error('s3BucketName must be a non-empty string');
  }
}

// Validate JWT authorization parameters if provided
let jwtAuthConfig: QuipMcpAgentCoreStackProps['jwtAuthConfig'] = undefined;

if (jwtDiscoveryUrl || jwtAllowedClients) {
  // If JWT parameters are partially provided, validate completeness
  if (!jwtDiscoveryUrl) {
    throw new Error('jwtDiscoveryUrl is required when configuring JWT authentication');
  }
  
  if (!jwtAllowedClients) {
    throw new Error('jwtAllowedClients is required when configuring JWT authentication');
  }
  
  // Validate discovery URL format
  if (typeof jwtDiscoveryUrl !== 'string' || !jwtDiscoveryUrl.match(/^.+\/\.well-known\/openid-configuration$/)) {
    throw new Error('jwtDiscoveryUrl must match pattern: ^.+/\\.well-known/openid-configuration$');
  }
  
  // Parse and validate allowed clients
  let allowedClients: string[];
  if (typeof jwtAllowedClients === 'string') {
    allowedClients = jwtAllowedClients.split(',').map(c => c.trim()).filter(c => c.length > 0);
  } else if (Array.isArray(jwtAllowedClients)) {
    allowedClients = jwtAllowedClients;
  } else {
    throw new Error('jwtAllowedClients must be a comma-separated string or array of client identifiers');
  }
  
  if (allowedClients.length === 0) {
    throw new Error('At least one allowed client must be specified for JWT authentication');
  }
  
  // Parse and validate allowed audiences if provided
  let allowedAudiences: string[] | undefined = undefined;
  if (jwtAllowedAudiences) {
    if (typeof jwtAllowedAudiences === 'string') {
      allowedAudiences = jwtAllowedAudiences.split(',').map(a => a.trim()).filter(a => a.length > 0);
    } else if (Array.isArray(jwtAllowedAudiences)) {
      allowedAudiences = jwtAllowedAudiences;
    } else {
      throw new Error('jwtAllowedAudiences must be a comma-separated string or array of audience identifiers');
    }
    
    if (allowedAudiences.length === 0) {
      allowedAudiences = undefined; // Treat empty array as not provided
    }
  }
  
  jwtAuthConfig = {
    discoveryUrl: jwtDiscoveryUrl,
    allowedClients: allowedClients,
    allowedAudiences: allowedAudiences,
  };
  
  console.log('JWT Authorization Configuration:');
  console.log(`  Discovery URL: ${jwtDiscoveryUrl}`);
  console.log(`  Allowed Clients: ${allowedClients.join(', ')}`);
  if (allowedAudiences) {
    console.log(`  Allowed Audiences: ${allowedAudiences.join(', ')}`);
  }
}

// Stack configuration
const stackProps: QuipMcpAgentCoreStackProps = {
  description: 'Quip MCP Server deployment to AWS Agent Core Runtime',
  secretARN: secretARN,
  agentRuntimeName: agentRuntimeName,
  s3BucketName: s3BucketName,
  jwtAuthConfig: jwtAuthConfig,
  tags: {
    Project: 'QuipMcpServer',
    Environment: 'production',
    DeploymentType: 'AgentCoreRuntime'
  }
};

// Create the Agent Core Runtime stack
new QuipMcpAgentCoreStack(app, 'QuipMcpAgentCoreStack', stackProps);

// Add standard CDK tags
cdk.Tags.of(app).add('CreatedBy', 'CDK');
cdk.Tags.of(app).add('Repository', 'quip-mcp-server-typescript');