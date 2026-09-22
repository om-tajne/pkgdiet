# Future Integration: AWS CodeBuild MCP Server

## Overview
While PkgDiet excels as a local development guardrail via its CLI and MCP integrations, enterprise environments often require centralized, verifiable security checks in CI/CD pipelines.

This design document outlines a planned, future integration with AWS CodeBuild, contributing to the `awslabs/mcp` open-source ecosystem.

## Planned MCP Server: `aws-codebuild-pkgdiet-mcp-server`

This server will enable agentic AIs (like Kiro or Amazon Q Developer) to trigger, monitor, and retrieve PkgDiet security evaluations natively inside an AWS CodeBuild project.

### Architecture

The Python-based MCP server will wrap the AWS `boto3` CodeBuild client and expose the following tools:

#### 1. `trigger_pkgdiet_scan` (Planned Deployment Integration - Not Implemented)
- **Description:** Triggers a specific AWS CodeBuild project configured to run `npx pkgdiet ci`.
- **Inputs:** `projectName`, `sourceVersion` (git hash or branch), `environmentVariablesOverride`.
- **Outputs:** The `buildId` and execution status.

#### 2. `get_scan_results` (Planned Deployment Integration - Not Implemented)
- **Description:** Retrieves the execution status of a CodeBuild run. If the run failed due to a `PkgDiet` violation, it parses the CloudWatch logs or S3 artifacts to extract the JSON audit report.
- **Inputs:** `buildId`.
- **Outputs:** A structured JSON object containing the PkgDiet evaluation result, highlighting specific package failures (e.g., deprecated packages, low health scores).

## Security & Deployment Considerations

Because this integration will interact with live AWS infrastructure, it requires:
1. **AWS Credentials:** Configured via `~/.aws/credentials` or an execution role.
2. **Least Privilege IAM:** 
   ```json
   {
       "Version": "2012-10-17",
       "Statement": [
           {
               "Effect": "Allow",
               "Action": [
                   "codebuild:StartBuild",
                   "codebuild:BatchGetBuilds"
               ],
               "Resource": "arn:aws:codebuild:region:account:project/pkgdiet-scan-project"
           }
       ]
   }
   ```
3. **Billable Resources:** Using AWS CodeBuild, CloudWatch Logs, and S3 Artifacts incurs costs outside of the AWS Free Tier. Ensure cost alarms are configured before deployment.

*(Note: The server code and deployment templates are currently in the design phase and have not been committed to `awslabs/mcp` yet).*
