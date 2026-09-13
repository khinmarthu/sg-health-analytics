import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as path from "node:path";

export interface BackendConstructProps {
  resourceId: string;
  cacheTtlSeconds: string;
}

/** Backend: VPC + ECS Cluster + Fargate Service + Application Load Balancer.
 * Low/spiky traffic (see PLAN.md) is why Fargate over e.g. always-on EC2. */
export class BackendConstruct extends Construct {
  public readonly service: ecsPatterns.ApplicationLoadBalancedFargateService;

  constructor(scope: Construct, id: string, props: BackendConstructProps) {
    super(scope, id);

    // 2 AZs for real load-balancer failover; 1 NAT gateway (not 2) since
    // this is a small, non-production-traffic workload — every NAT gateway
    // has an hourly cost regardless of traffic.
    const vpc = new ec2.Vpc(this, "Vpc", { maxAzs: 2, natGateways: 1 });

    const cluster = new ecs.Cluster(this, "Cluster", { vpc });

    // Referenced by name, not created here — CDK should never contain an
    // actual secret value (see PLAN.md Decisions Log #6). If this secret
    // doesn't exist in the target AWS account, that's fine for `cdk synth`
    // (this only produces a template); it would need to actually exist
    // before a real `cdk deploy`.
    const dataGovApiKeySecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      "DataGovApiKeySecret",
      "sg-health/data-gov-api-key",
    );

    this.service = new ecsPatterns.ApplicationLoadBalancedFargateService(this, "Service", {
      cluster,
      publicLoadBalancer: true,
      desiredCount: 1,
      cpu: 256, // smallest Fargate size — this is a lightweight Node API
      memoryLimitMiB: 512,
      taskImageOptions: {
        // Build context is the monorepo root, not backend/ alone — backend
        // depends on the workspace package @sg-health/types, so Docker
        // needs to see the whole workspace, not just the backend folder.
        image: ecs.ContainerImage.fromAsset(path.join(import.meta.dirname, "../.."), {
          file: "backend/Dockerfile",
        }),
        containerPort: 5000,
        environment: {
          PORT: "5000",
          RESOURCE_ID: props.resourceId,
          DATA_GOV_BASE_URL: "https://data.gov.sg/api/action/datastore_search",
          CACHE_TTL_SECONDS: props.cacheTtlSeconds,
        },
        secrets: {
          DATA_GOV_API_KEY: ecs.Secret.fromSecretsManager(dataGovApiKeySecret),
        },
      },
    });
  }
}
