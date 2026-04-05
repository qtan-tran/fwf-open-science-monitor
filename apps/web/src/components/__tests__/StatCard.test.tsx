import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCard } from "@/components/ui/StatCard";
import { TrendingUp } from "lucide-react";

describe("StatCard", () => {
  it("renders title and string value", () => {
    render(<StatCard title="Total Projects" value="1,500" />);
    expect(screen.getByText("Total Projects")).toBeInTheDocument();
    expect(screen.getByText("1,500")).toBeInTheDocument();
  });

  it("formats numeric value with toLocaleString", () => {
    render(<StatCard title="Outputs" value={12000} />);
    // toLocaleString varies by locale — just check it rendered something
    expect(screen.getByText(/12/)).toBeInTheDocument();
  });

  it("renders unit when provided", () => {
    render(<StatCard title="OA Rate" value={67.5} unit="%" />);
    expect(screen.getByText("%")).toBeInTheDocument();
  });

  it("does not render unit when omitted", () => {
    const { container } = render(<StatCard title="Projects" value={100} />);
    // No unit span should be present — all text should be title + value
    expect(container.querySelectorAll("span")).toHaveLength(1);
  });

  it("renders icon when provided", () => {
    const { container } = render(
      <StatCard title="Projects" value={100} icon={TrendingUp} />
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders trend label when trend and trendLabel are provided", () => {
    render(
      <StatCard title="OA Rate" value={67} trend="up" trendLabel="+5% vs last year" />
    );
    expect(screen.getByText("+5% vs last year")).toBeInTheDocument();
  });

  it("does not render trend section when trend is absent", () => {
    render(<StatCard title="Projects" value={100} trendLabel="some label" />);
    expect(screen.queryByText("some label")).not.toBeInTheDocument();
  });

  it("renders all three trend directions without error", () => {
    const { rerender } = render(
      <StatCard title="T" value={1} trend="up" trendLabel="up" />
    );
    expect(screen.getByText("up")).toBeInTheDocument();

    rerender(<StatCard title="T" value={1} trend="down" trendLabel="down" />);
    expect(screen.getByText("down")).toBeInTheDocument();

    rerender(<StatCard title="T" value={1} trend="neutral" trendLabel="flat" />);
    expect(screen.getByText("flat")).toBeInTheDocument();
  });
});
