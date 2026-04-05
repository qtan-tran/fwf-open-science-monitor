/**
 * Tests for GET /api/metrics/summary
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
    get: vi.fn(() => undefined), // always cache-miss by default
    set: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    metricSnapshot: {
      findFirst: vi.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks are registered)
// ---------------------------------------------------------------------------

import { GET } from "@/app/api/metrics/summary/route";
import { prisma } from "@/lib/prisma";
import { cache } from "@/lib/cache";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSnapshot(meta: Record<string, unknown>) {
  return { metricKey: "summary", year: null, rorId: null, value: 1500, metadata: meta };
}

async function callGet() {
  const res = await GET();
  return { res, json: await res.json() };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/metrics/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cache.get).mockReturnValue(undefined);
  });

  describe("happy path", () => {
    it("returns 200 when a summary snapshot exists", async () => {
      vi.mocked(prisma.metricSnapshot.findFirst).mockResolvedValue(
        makeSnapshot({
          total_projects: 1500,
          total_outputs: 12_000,
          total_institutions: 80,
          overall_oa_rate: 67.5,
          year_range: [1995, 2024],
        }),
      );

      const { res } = await callGet();
      expect(res.status).toBe(200);
    });

    it("returns correct MetricSummary shape", async () => {
      vi.mocked(prisma.metricSnapshot.findFirst).mockResolvedValue(
        makeSnapshot({
          total_projects: 1500,
          total_outputs: 12_000,
          total_institutions: 80,
          overall_oa_rate: 67.5,
          year_range: [1995, 2024],
        }),
      );

      const { json } = await callGet();
      expect(json).toMatchObject({
        totalProjects:     1500,
        totalOutputs:      12_000,
        totalInstitutions: 80,
        overallOaRate:     67.5,
        yearRange:         [1995, 2024],
      });
    });

    it("stores result in cache", async () => {
      vi.mocked(prisma.metricSnapshot.findFirst).mockResolvedValue(
        makeSnapshot({ total_projects: 100, total_outputs: 500, total_institutions: 10, overall_oa_rate: 50, year_range: [2000, 2023] }),
      );

      await callGet();
      expect(cache.set).toHaveBeenCalledOnce();
    });

    it("returns cached value without hitting the DB", async () => {
      const cached = { totalProjects: 999, totalOutputs: 0, totalInstitutions: 0, overallOaRate: 0, yearRange: [null, null] as [null, null] };
      vi.mocked(cache.get).mockReturnValue(cached);

      const { json } = await callGet();
      expect(json.totalProjects).toBe(999);
      expect(prisma.metricSnapshot.findFirst).not.toHaveBeenCalled();
    });

    it("defaults missing metadata fields to 0", async () => {
      vi.mocked(prisma.metricSnapshot.findFirst).mockResolvedValue(
        makeSnapshot({}), // no metadata fields at all
      );

      const { json } = await callGet();
      expect(json.totalProjects).toBe(0);
      expect(json.totalOutputs).toBe(0);
      expect(json.totalInstitutions).toBe(0);
      expect(json.overallOaRate).toBe(0);
    });
  });

  describe("error cases", () => {
    it("returns 404 when no summary snapshot exists", async () => {
      vi.mocked(prisma.metricSnapshot.findFirst).mockResolvedValue(null);

      const { res, json } = await callGet();
      expect(res.status).toBe(404);
      expect(json.error).toBeDefined();
    });

    it("404 response includes a helpful message", async () => {
      vi.mocked(prisma.metricSnapshot.findFirst).mockResolvedValue(null);

      const { json } = await callGet();
      expect(json.error).toMatch(/etl/i);
    });
  });
});
