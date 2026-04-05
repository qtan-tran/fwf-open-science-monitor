/**
 * Smoke tests for chart components.
 *
 * Strategy: render each chart with minimal realistic data and verify it
 * mounts without throwing and displays expected text content.
 * Recharts internals (SVG paths, animation) are not asserted — they are
 * implementation details and vary by version.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Recharts uses ResizeObserver — polyfilled in src/test/setup.ts

import { OARateChart } from "@/components/charts/OARateChart";
import { ProjectsByYearChart } from "@/components/charts/ProjectsByYearChart";
import type { YearlyMetric } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeYearlyMetric(year: number, value: number, metadata?: Record<string, unknown>): YearlyMetric {
  return { year, value, metadata };
}

// ---------------------------------------------------------------------------
// OARateChart
// ---------------------------------------------------------------------------

describe("OARateChart", () => {
  it("renders empty state when data is empty", () => {
    render(<OARateChart data={[]} />);
    expect(screen.getByText(/no oa rate data/i)).toBeInTheDocument();
  });

  it("renders without crashing when given data", () => {
    const data = [
      makeYearlyMetric(2020, 62.5, { total_publications: 100, oa_publications: 62 }),
      makeYearlyMetric(2021, 68.0, { total_publications: 120, oa_publications: 82 }),
    ];
    const { container } = render(<OARateChart data={data} />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders a non-empty container with data", () => {
    const data = [makeYearlyMetric(2022, 70.0)];
    const { container } = render(<OARateChart data={data} />);
    // ResponsiveContainer needs real dimensions to emit SVG; just verify
    // the component mounts and produces DOM output without throwing.
    expect(container.firstChild).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// ProjectsByYearChart
// ---------------------------------------------------------------------------

describe("ProjectsByYearChart", () => {
  it("renders empty state when data is empty", () => {
    render(<ProjectsByYearChart data={[]} />);
    expect(screen.getByText(/no project data/i)).toBeInTheDocument();
  });

  it("renders without crashing when given data", () => {
    const data = [
      makeYearlyMetric(2020, 350),
      makeYearlyMetric(2021, 410),
      makeYearlyMetric(2022, 390),
    ];
    const { container } = render(<ProjectsByYearChart data={data} />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders a non-empty container with data", () => {
    const data = [makeYearlyMetric(2023, 500)];
    const { container } = render(<ProjectsByYearChart data={data} />);
    expect(container.firstChild).toBeTruthy();
  });
});
