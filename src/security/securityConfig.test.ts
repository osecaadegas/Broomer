import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("production security configuration", () => {
  it("does not identify the application framework", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("sets restrictive headers on every route", async () => {
    const configured = await nextConfig.headers?.();
    const headers = new Map(
      configured?.[0]?.headers.map((header) => [header.key, header.value]),
    );

    expect(headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
    expect(headers.get("Content-Security-Policy")).toContain(
      "frame-ancestors 'none'",
    );
    expect(headers.get("Content-Security-Policy")).not.toContain("unsafe-eval");
  });

  it("prevents API response caching", async () => {
    const configured = await nextConfig.headers?.();
    expect(configured?.[1]?.source).toBe("/api/(.*)");
    expect(configured?.[1]?.headers[0]?.value).toContain("no-store");
  });
});