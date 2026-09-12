import { Router } from "express";

// usage for server alive checking
export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok" } });
});
