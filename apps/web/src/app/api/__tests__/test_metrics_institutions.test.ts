/**
 * Tests for GET /api/metrics/institutions
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks
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
    institution: {
      findMany: vi.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { GET } from "@/app/api/metrics/institutions/route";
import { prisma } from "@/lib/prisma";
import { cache } from "@/lib/cache";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/metrics/institutions");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url.toString());
}

function makeInstitution(rorId: string, name: string, country: string, projectCount = 10, outputCount = 50) {
  return { rorId, name, country, projectCount, outputCount };
}

function makeSnapshot(rorId: string, value: number, meta?: Record<string, unknown>) {
  return {
    metricKey: "institution_project_count",
    year: null,
    rorId,
    value,
    metadata: meta ?? null,
  };
}

async function callGet(params: Record<string, string> = {}) {
  const res = await GET(makeRequest(params));
  return { res, json: await res.json() };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/metrics/institutions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cache.get).mockReturnValue(undefined);
    vi.mocked(prisma.metricSnapshot.findMany).mockResolvedValue([]);
    vi.mocked(prisma.institution.findMany).mockResolvedValue([]);
  });

  describe("happy path", () => {
    it("returns 200 with an array", async () => {
      const { res, json } = await callGet();
      expect(res.status).toBe(200);
      expect(Array.isArray(json)).toBe(true);
    });

    it("merges institution and snapshot data", async () => {
      vi.mocked(prisma.institution.findMany).mockResolvedValue([
        makeInstitution("ror-1", "Uni Vienna", "AT", 5, 20),
      ]);
      vi.mocked(prisma.metricSnapshot.findMany).mockResolvedValue([
        makeSnapshot("ror-1", 7, { output_count: 30, oa_publication_rate: 72.5 }),
      ]);

      const { json } = await callGet();
      expect(json[0]).toMatchObject({
        rorId: "ror-1",
        name: "Uni Vienna",
        country: "AT",
        projectCount: 7,
        outputCount: 30,
        oaPublicationRate: 72.5,
      });
    });

    it("falls back to institution counts when no snapshot exists", async () => {
      vi.mocked(prisma.institution.findMany).mockResolvedValue([
        makeInstitution("ror-2", "TU Graz", "AT", 15, 60),
      ]);
      vi.mocked(prisma.metricSnapshot.findMany).mockResolvedValue([]);

      const { json } = await callGet();
      expect(json[0].projectCount).toBe(15);
      expect(json[0].outputCount).toBe(60);
    });

    it("stores result in cache", async () => {
      await callGet();
      expect(cache.set).toHaveBeenCalledOnce();
    });

    it("returns cached value without hitting the DB", async () => {
      const cached = [{ rorId: "ror-x", name: "Cached Uni", country: "AT", projectCount: 99, outputCount: 0, publicationCount: 0, oaPublicationRate: 0 }];
      vi.mocked(cache.get).mockReturnValue(cached);

      const { json } = await callGet();
      expect(json[0].projectCount).toBe(99);
      expect(prisma.institution.findMany).not.toHaveBeenCalled();
    });
  });

  describe("sortBy parameter", () => {
    beforeEach(() => {
      vi.mocked(prisma.institution.findMany).mockResolvedValue([
        makeInstitution("ror-a", "Alpha Uni", "AT", 5, 10),
        makeInstitution("ror-b", "Beta Uni", "DE", 20, 5),
        makeInstitution("ror-c", "Gamma Uni", "CH", 10, 30),
      ]);
      vi.mocked(prisma.metricSnapshot.findMany).mockResolvedValue([
        makeSnapshot("ror-a", 5, { output_count: 10, oa_publication_rate: 80 }),
        makeSnapshot("ror-b", 20, { output_count: 5, oa_publication_rate: 40 }),
        makeSnapshot("ror-c", 10, { output_count: 30, oa_publication_rate: 60 }),
      ]);
    });

    it("defaults to sorting by project_count descending", async () => {
      const { json } = await callGet();
      expect(json[0].projectCount).toBeGreaterThanOrEqual(json[1].projectCount);
      expect(json[1].projectCount).toBeGreaterThanOrEqual(json[2].projectCount);
    });

    it("sorts by output_count when requested", async () => {
      const { json } = await callGet({ sortBy: "output_count" });
      expect(json[0].outputCount).toBeGreaterThanOrEqual(json[1].outputCount);
    });

    it("sorts by oa_rate when requested", async () => {
      const { json } = await callGet({ sortBy: "oa_rate" });
      expect(json[0].oaPublicationRate).toBeGreaterThanOrEqual(json[1].oaPublicationRate);
    });

    it("returns 400 for an invalid sortBy value", async () => {
      const { res } = await callGet({ sortBy: "invalid_sort" });
      expect(res.status).toBe(400);
    });
  });

  describe("limit parameter", () => {
    beforeEach(() => {
      const institutions = Array.from({ length: 30 }, (_, i) =>
        makeInstitution(`ror-${i}`, `Uni ${i}`, "AT", i, i * 2)
      );
      vi.mocked(prisma.institution.findMany).mockResolvedValue(institutions);
      vi.mocked(prisma.metricSnapshot.findMany).mockResolvedValue([]);
    });

    it("defaults to 20 results", async () => {
      const { json } = await callGet();
      expect(json).toHaveLength(20);
    });

    it("respects custom limit", async () => {
      const { json } = await callGet({ limit: "5" });
      expect(json).toHaveLength(5);
    });

    it("caps limit at 200", async () => {
      const { json } = await callGet({ limit: "999" });
      expect(json.length).toBeLessThanOrEqual(200);
    });
  });

  describe("country filter", () => {
    it("passes country filter to institution query", async () => {
      vi.mocked(prisma.institution.findMany).mockResolvedValue([
        makeInstitution("ror-at", "AT Uni", "AT"),
      ]);

      await callGet({ country: "AT" });

      const callArg = vi.mocked(prisma.institution.findMany).mock.lastCall?.[0];
      expect(JSON.stringify(callArg)).toContain("AT");
    });

    it("does not include snapshot-only institutions when country filter is set", async () => {
      vi.mocked(prisma.institution.findMany).mockResolvedValue([]);
      vi.mocked(prisma.metricSnapshot.findMany).mockResolvedValue([
        makeSnapshot("ror-orphan", 5),
      ]);

      const { json } = await callGet({ country: "AT" });
      expect(json).toHaveLength(0);
    });
  });
});
