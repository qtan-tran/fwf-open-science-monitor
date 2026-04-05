/**
 * Tests for GET /api/projects
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
    $transaction: vi.fn(),
    project: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { GET } from "@/app/api/projects/route";
import { prisma } from "@/lib/prisma";
import { cache } from "@/lib/cache";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/projects");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url.toString());
}

function makeProject(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    grantDoi: `10.55776/${id}`,
    titleEn: `Project ${id}`,
    programEn: "Stand-Alone Projects",
    statusEn: "ongoing",
    approvalYear: 2021,
    approvedAmount: BigInt(200_000),
    piFirstName: "Jane",
    piLastName: "Doe",
    piInstitutionName: "University of Vienna",
    piInstitutionRor: "https://ror.org/03prydq77",
    keywords: ["open science"],
    fieldsEn: ["Life Sciences"],
    _count: { outputs: 3 },
    ...overrides,
  };
}

function mockTransaction(total: number, projects: ReturnType<typeof makeProject>[]) {
  vi.mocked(prisma.$transaction).mockResolvedValue([total, projects]);
}

async function callGet(params: Record<string, string> = {}) {
  const res = await GET(makeRequest(params));
  return { res, json: await res.json() };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cache.get).mockReturnValue(undefined);
    mockTransaction(0, []);
  });

  describe("happy path", () => {
    it("returns 200 with paginated shape", async () => {
      mockTransaction(2, [makeProject("p1"), makeProject("p2")]);
      const { res, json } = await callGet();
      expect(res.status).toBe(200);
      expect(json).toMatchObject({
        data: expect.any(Array),
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it("maps BigInt approvedAmount to number", async () => {
      mockTransaction(1, [makeProject("p1", { approvedAmount: BigInt(150_000) })]);
      const { json } = await callGet();
      expect(json.data[0].approvedAmount).toBe(150_000);
      expect(typeof json.data[0].approvedAmount).toBe("number");
    });

    it("returns null for null approvedAmount", async () => {
      mockTransaction(1, [makeProject("p1", { approvedAmount: null })]);
      const { json } = await callGet();
      expect(json.data[0].approvedAmount).toBeNull();
    });

    it("maps _count.outputs to outputCount", async () => {
      mockTransaction(1, [makeProject("p1", { _count: { outputs: 7 } })]);
      const { json } = await callGet();
      expect(json.data[0].outputCount).toBe(7);
    });

    it("stores result in cache", async () => {
      mockTransaction(1, [makeProject("p1")]);
      await callGet();
      expect(cache.set).toHaveBeenCalledOnce();
    });

    it("returns cached value without hitting the DB", async () => {
      const cached = { data: [], total: 42, page: 1, limit: 20, totalPages: 3 };
      vi.mocked(cache.get).mockReturnValue(cached);

      const { json } = await callGet();
      expect(json.total).toBe(42);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("pagination", () => {
    it("defaults to page 1, limit 20", async () => {
      mockTransaction(0, []);
      const { json } = await callGet();
      expect(json.page).toBe(1);
      expect(json.limit).toBe(20);
    });

    it("respects custom page and limit", async () => {
      mockTransaction(100, []);
      const { json } = await callGet({ page: "3", limit: "10" });
      expect(json.page).toBe(3);
      expect(json.limit).toBe(10);
    });

    it("calculates totalPages correctly", async () => {
      mockTransaction(45, []);
      const { json } = await callGet({ limit: "10" });
      expect(json.totalPages).toBe(5);
    });

    it("caps limit at 100", async () => {
      mockTransaction(0, []);
      const { json } = await callGet({ limit: "999" });
      expect(json.limit).toBe(100);
    });
  });

  describe("filters", () => {
    it("passes year filter to the query", async () => {
      await callGet({ year: "2022" });
      const callArg = vi.mocked(prisma.project.findMany).mock.lastCall?.[0];
      expect(JSON.stringify(callArg)).toContain("2022");
    });

    it("passes search filter to the query", async () => {
      await callGet({ search: "climate" });
      const callArg = vi.mocked(prisma.project.findMany).mock.lastCall?.[0];
      expect(JSON.stringify(callArg)).toContain("climate");
    });

    it("passes institution filter to the query", async () => {
      await callGet({ institution: "https://ror.org/03prydq77" });
      const callArg = vi.mocked(prisma.project.findMany).mock.lastCall?.[0];
      expect(JSON.stringify(callArg)).toContain("03prydq77");
    });

    it("passes status filter to the query", async () => {
      await callGet({ status: "ongoing" });
      const callArg = vi.mocked(prisma.project.findMany).mock.lastCall?.[0];
      expect(JSON.stringify(callArg)).toContain("ongoing");
    });
  });

  describe("hasOutputs filter", () => {
    it("filters projects with outputs when hasOutputs=true", async () => {
      await callGet({ hasOutputs: "true" });
      const callArg = vi.mocked(prisma.project.findMany).mock.lastCall?.[0];
      expect(JSON.stringify(callArg)).toContain("some");
    });

    it("filters projects without outputs when hasOutputs=false", async () => {
      await callGet({ hasOutputs: "false" });
      const callArg = vi.mocked(prisma.project.findMany).mock.lastCall?.[0];
      expect(JSON.stringify(callArg)).toContain("none");
    });

    it("does not add output filter when hasOutputs is absent", async () => {
      await callGet({});
      const callArg = vi.mocked(prisma.project.findMany).mock.lastCall?.[0];
      expect(JSON.stringify(callArg)).not.toContain("some");
      expect(JSON.stringify(callArg)).not.toContain("none");
    });
  });
});
