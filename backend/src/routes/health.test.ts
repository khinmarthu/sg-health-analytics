import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";

describe("GET /health", () => {
  it("responds ok", async () => {
    const res = await request(createApp()).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { status: "ok" } });
  });
});
