import { Stack, type StackProps } from "aws-cdk-lib";
import type { Construct } from "constructs";
import { BackendConstruct } from "./backend-construct.js";
import { FrontendConstruct } from "./frontend-construct.js";

export class SgHealthAnalyticsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Non-secret config, read from CDK context (cdk.json, or `-c key=value`
    // on the CLI) rather than hardcoded — see PLAN.md Step 7.
    const resourceId = this.node.getContext("resourceId") as string;
    const cacheTtlSeconds = this.node.getContext("cacheTtlSeconds") as string;

    new BackendConstruct(this, "Backend", { resourceId, cacheTtlSeconds });
    new FrontendConstruct(this, "Frontend");
  }
}
