/**
 * Tests for GET /api/export
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      findMany: vi.fn(),
    },
    output: {
      findMany: vi.fn(),
    },
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

import { GET } from "@/app/api/export/route";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/export");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url.toString());
}

function makeProject(id: string) {
  return {
    id,
    grantDoi: `10.55776/${id}`,
    titleEn: `Project ${id}`,
    titleDe: null,
    summaryEn: null,
    programEn: "Stand-Alone Projects",
    statusEn: "ongoing",
    approvalDate: null,
    startDate: null,
    endDate: null,
    approvalYear: 2021,
    approvedAmount: BigInt(200_000),
    piFirstName: "Jane",
    piLastName: "Doe",
    piOrcid: null,
    piRole: "PI",
    piInstitutionName: "Uni Vienna",
    piInstitutionRor: "https://ror.org/03prydq77",
    researchRadarUrl: null,
    keywords: ["open science", "data"],
    disciplinesEn: ["Life Sciences"],
    fieldsEn: ["Biology"],
    rawJson: null,
    lastSyncedAt: new Date("2024-01-01"),
    _count: { outputs: 2 },
  };
}

function makeOutput(id: string) {
  return {
    id,
    doi: `10.1234/${id}`,
    title: `Output ${id}`,
    category: "publication",
    type: "journal-article",
    years: [2022],
    url: null,
    hasDoi: true,
    hasPmid: false,
    pmid: null,
    journal: "Nature",
    publisher: "Springer",
    providedToOthers: false,
    rawJson: null,
    lastSyncedAt: new Date("2024-01-01"),
  };
}

function makeSnapshot(metricKey: string, year: number | null, value: number) {
  return {
    id: `snap-${metricKey}`,
    metricKey,
    year,
    rorId: null,
    value,
    metadata: null,
    computedAt: new Date("2024-01-01"),
  };
}

function makeInstitution(rorId: string) {
  return {
    rorId,
    name: `Uni ${rorId}`,
    country: "AT",
    projectCount: 5,
    outputCount: 10,
    lastComputedAt: new Date("2024-01-01"),
  };
}

async function callGet(params: Record<string, string> = {}) {
  const res = await GET(makeRequest(params));
  return res;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/export", () => {
  beforeEach(() => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([]);
    vi.mocked(prisma.output.findMany).mockResolvedValue([]);
    vi.mocked(prisma.metricSnapshot.findMany).mockResolvedValue([]);
    vi.mocked(prisma.institution.findMany).mockResolvedValue([]);
  });

  describe("validation", () => {
    it("returns 400 when type param is missing", async () => {
      const res = await callGet({});
      expect(res.status).toBe(400);
    });

    it("returns 400 for an invalid type", async () => {
      const res = await callGet({ type: "foobar" });
      expect(res.status).toBe(400);
    });

    it("400 error message names the valid types", async () => {
      const res = await callGet({ type: "bad" });
      const json = await res.json();
      expect(json.error).toMatch(/projects/i);
    });

    it("returns 400 for an invalid format", async () => {
      const res = await callGet({ type: "projects", format: "xml" });
      expect(res.status).toBe(400);
    });

    it.each(["projects", "outputs", "metrics", "institutions"])(
      "accepts valid type=%s",
      async (type) => {
        const res = await callGet({ type });
        expect(res.status).toBe(200);
      }
    );
  });

  describe("JSON format (default)", () => {
    it("returns application/json content-type", async () => {
      vi.mocked(prisma.project.findMany).mockResolvedValue([makeProject("p1")]);
      const res = await callGet({ type: "projects" });
      expect(res.headers.get("Content-Type")).toContain("application/json");
    });

    it("returns Content-Disposition attachment header", async () => {
      const res = await callGet({ type: "projects" });
      expect(res.headers.get("Content-Disposition")).toMatch(/attachment/);
    });

    it("filename contains the type", async () => {
      const res = await callGet({ type: "institutions" });
      const cd = res.headers.get("Content-Disposition") ?? "";
      expect(cd).toMatch(/institutions/);
    });

    it("returns parseable JSON body", async () => {
      vi.mocked(prisma.project.findMany).mockResolvedValue([makeProject("p1")]);
      const res = await callGet({ type: "projects" });
      const body = await res.text();
      expect(() => JSON.parse(body)).not.toThrow();
    });
  });

  describe("CSV format", () => {
    it("returns text/csv content-type", async () => {
      vi.mocked(prisma.project.findMany).mockResolvedValue([makeProject("p1")]);
      const res = await callGet({ type: "projects", format: "csv" });
      expect(res.headers.get("Content-Type")).toContain("text/csv");
    });

    it("CSV contains a header row", async () => {
      vi.mocked(prisma.project.findMany).mockResolvedValue([makeProject("p1")]);
      const res = await callGet({ type: "projects", format: "csv" });
      const body = await res.text();
      const firstLine = body.split("\n")[0];
      expect(firstLine).toMatch(/titleEn|id|grant/i);
    });
  });

  describe("projects export", () => {
    it("flattens keywords array to semicolon-separated string", async () => {
      vi.mocked(prisma.project.findMany).mockResolvedValue([makeProject("p1")]);
      const res = await callGet({ type: "projects" });
      const data = await res.json();
      expect(data[0].keywords).toBe("open science; data");
    });

    it("converts BigInt approvedAmount to number", async () => {
      vi.mocked(prisma.project.findMany).mockResolvedValue([makeProject("p1")]);
      const res = await callGet({ type: "projects" });
      const data = await res.json();
      expect(data[0].approvedAmountEur).toBe(200_000);
    });
  });

  describe("outputs export", () => {
    it("flattens years array to semicolon-separated string", async () => {
      vi.mocked(prisma.output.findMany).mockResolvedValue([makeOutput("o1")]);
      const res = await callGet({ type: "outputs" });
      const data = await res.json();
      expect(data[0].years).toBe("2022");
    });
  });

  describe("metrics export", () => {
    it("converts computedAt Date to ISO string", async () => {
      vi.mocked(prisma.metricSnapshot.findMany).mockResolvedValue([
        makeSnapshot("oa_publication_rate", 2022, 67.5),
      ]);
      const res = await callGet({ type: "metrics" });
      const data = await res.json();
      expect(typeof data[0].computedAt).toBe("string");
      expect(data[0].computedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe("institutions export", () => {
    it("returns institution fields", async () => {
      vi.mocked(prisma.institution.findMany).mockResolvedValue([makeInstitution("ror-1")]);
      const res = await callGet({ type: "institutions" });
      const data = await res.json();
      expect(data[0]).toMatchObject({ rorId: "ror-1", country: "AT" });
    });
  });

  describe("error handling", () => {
    it("returns 500 when DB throws", async () => {
      vi.mocked(prisma.project.findMany).mockRejectedValue(new Error("DB failure"));
      const res = await callGet({ type: "projects" });
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBeDefined();
    });
  });
});
