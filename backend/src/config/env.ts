import "dotenv/config"; // side-effect import: loads .env into process.env before anything below reads it
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(5000), // coerce: env vars are always strings, e.g. "5000"
  RESOURCE_ID: z.string().min(1, "RESOURCE_ID is required"),
  DATA_GOV_BASE_URL: z.string().url(),
  CACHE_TTL_SECONDS: z.coerce.number().default(300),
});

// parse() throws on missing/invalid values, so a bad .env fails fast at
// startup with a readable message, instead of surfacing as a confusing
// bug later (e.g. a silent `undefined` RESOURCE_ID reaching the API call).
const parsed = envSchema.parse(process.env);

export const env = {
  port: parsed.PORT,
  resourceId: parsed.RESOURCE_ID,
  dataGovBaseUrl: parsed.DATA_GOV_BASE_URL,
  cacheTtlSeconds: parsed.CACHE_TTL_SECONDS,
};
