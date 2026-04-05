/**
 * Tests for GET /api/metrics/yearly
 *
 * Strategy: mock Prisma and the in-memory cache so we can test the route
 * handler in isolation without a running database.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks — vi.mock is hoisted, so these run before imports
// ---------------------------------------------------------------------------

vi.mock("@/lib/cache", () => ({
  cache: {
    get: vi.fn(() => undefined),
    set: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    metricSnapshot: {
      findMany: vi.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks are registered)
// ---------------------------------------------------------------------------

import { GET } from "@/app/api/metrics/yearly/route";
import { prisma } from "@/lib/prisma";
import { cache } from "@/lib/cache";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/metrics/yearly");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url.toString());
}

function makeSnapshot(metricKey: string, year: number, value: number, metadata?: Record<string, unknown>) {
  return { metricKey, year, rorId: null, value, metadata: metadata ?? null };
}

async function callGet(params: Record<string, string>) {
  const res = await GET(makeRequest(params));
  return { res, json: await res.json() };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/metrics/yearly", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cache.get).mockReturnValue(undefined);
    vi.mocked(prisma.metricSnapshot.findMany).mockResolvedValue([]);
  });

  describe("validation", () => {
    it("returns 400 when metric param is missing", async () => {
      const { res } = await callGet({});
      expect(res.status).toBe(400);
    });

    it("returns 400 for an invalid metric value", async () => {
      const { res } = await callGet({ metric: "totally_invalid" });
      expect(res.status).toBe(400);
    });

    it("400 error includes a list of valid metrics", async () => {
      const { json } = await callGet({ metric: "bad" });
      expect(json.error).toMatch(/metric/i);
    });

    it.each([
      "project_count",
      "oa_rate",
      "output_by_category",
      "funding_efficiency",
      "open_data_rate",
      "open_software_rate",
    ])("accepts valid metric %s and returns 200", async (metric) => {
      const { res } = await callGet({ metric });
      expect(res.status).toBe(200);
    });
  });

  describe("standard metrics (non-category)", () => {
    it("returns an array of yearly metrics", async () => {
      vi.mocked(prisma.metricSnapshot.findMany).mockResolvedValue([
        makeSnapshot("oa_publication_rate_by_year", 2020, 65.2),
        makeSnapshot("oa_publication_rate_by_year", 2021, 68.1),
      ]);

      const { json } = await callGet({ metric: "oa_rate" });
      expect(Array.isArray(json)).toBe(true);
      expect(json).toHaveLength(2);
    });

    it("each item has year and value fields", async () => {
      vi.mocked(prisma.metricSnapshot.findMany).mockResolvedValue([
        makeSnapshot("oa_publication_rate_by_year", 2022, 70.0),
      ]);

      const { json } = await callGet({ metric: "oa_rate" });
      expect(json[0]).toMatchObject({ year: 2022, value: 70.0 });
    });

    it("returns empty array when no snapshots exist", async () => {
      vi.mocked(prisma.metricSnapshot.findMany).mockResolvedValue([]);
      const { json } = await callGet({ metric: "project_count" });
      expect(json).toEqual([]);
    });

    it("stores result in cache after DB query", async () => {
      vi.mocked(prisma.metricSnapshot.findMany).mockResolvedValue([
        makeSnapshot("project_count_by_year", 2023, 1200),
      ]);

      await callGet({ metric: "project_count" });
      expect(cache.set).toHaveBeenCalledOnce();
    });

    it("returns cached value without hitting the DB", async () => {
      const cachedData = [{ year: 2020, value: 55.0, metadata: {} }];
      vi.mocked(cache.get).mockReturnValue(cachedData);

      const { json } = await callGet({ metric: "oa_rate" });
      expect(json[0].value).toBe(55.0);
      expect(prisma.metricSnapshot.findMany).not.toHaveBeenCalled();
    });
  });

  describe("output_by_category metric", () => {
    it("returns rows with category in metadata", async () => {
      vi.mocked(prisma.metricSnapshot.findMany).mockResolvedValue([
        makeSnapshot("output_count_by_category_year:publication", 2021, 800),
        makeSnapshot("output_count_by_category_year:dataset", 2021, 120),
      ]);

      const { json } = await callGet({ metric: "output_by_category" });
      expect(json).toHaveLength(2);
      const categories = json.map((r: { metadata: { category: string } }) => r.metadata.category);
      expect(categories).toContain("publication");
      expect(categories).toContain("dataset");
    });

    it("includes metricKey in metadata", async () => {
      vi.mocked(prisma.metricSnapshot.findMany).mockResolvedValue([
        makeSnapshot("output_count_by_category_year:software", 2022, 45),
      ]);

      const { json } = await callGet({ metric: "output_by_category" });
      expect(json[0].metadata.metricKey).toBe("output_count_by_category_year:software");
    });
  });

  describe("year filtering", () => {
    it("passes startYear filter through to DB query", async () => {
      await callGet({ metric: "project_count", startYear: "2010" });

      const callArg = vi.mocked(prisma.metricSnapshot.findMany).mock.lastCall?.[0];
      expect(JSON.stringify(callArg)).toContain("2010");
    });

    it("passes endYear filter through to DB query", async () => {
      await callGet({ metric: "project_count", endYear: "2022" });

      const callArg = vi.mocked(prisma.metricSnapshot.findMany).mock.lastCall?.[0];
      expect(JSON.stringify(callArg)).toContain("2022");
    });

    it("uses different cache keys for different year ranges", async () => {
      vi.mocked(prisma.metricSnapshot.findMany).mockResolvedValue([]);

      await callGet({ metric: "oa_rate", startYear: "2000" });
      await callGet({ metric: "oa_rate", startYear: "2010" });

      const keys = vi.mocked(cache.set).mock.calls.map((c) => c[0]);
      expect(keys[0]).not.toBe(keys[1]);
    });
  });
});
