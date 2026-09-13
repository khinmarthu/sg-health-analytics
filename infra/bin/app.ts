import { App } from "aws-cdk-lib";
import { SgHealthAnalyticsStack } from "../lib/sg-health-analytics-stack.js";

const app = new App();
new SgHealthAnalyticsStack(app, "SgHealthAnalyticsStack");
