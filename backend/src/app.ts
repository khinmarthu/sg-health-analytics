import cors from "cors";
import express from "express";
import { healthRouter } from "./routes/health.js";
import { recordsRouter } from "./routes/records.js";
import { filtersRouter } from "./routes/filters.js";

// Builds the app but does not start listening on a port.
// Kept separate from index.ts so tests can import `app` and send it
// requests directly (via Supertest), without needing a real running server.
export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use(healthRouter);
  app.use(recordsRouter);
  app.use(filtersRouter);

  return app;
}
