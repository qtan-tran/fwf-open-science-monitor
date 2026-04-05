import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterBar } from "@/components/ui/FilterBar";

const FILTERS = [
  {
    key: "status",
    label: "Status",
    options: [
      { value: "ongoing", label: "Ongoing" },
      { value: "completed", label: "Completed" },
    ],
  },
  {
    key: "year",
    label: "Year",
    options: [
      { value: "2022", label: "2022" },
      { value: "2023", label: "2023" },
    ],
  },
];

describe("FilterBar", () => {
  it("renders all filter labels", () => {
    render(<FilterBar filters={FILTERS} values={{}} onChange={vi.fn()} />);
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Year")).toBeInTheDocument();
  });

  it("renders 'All' as the default first option in each filter", () => {
    render(<FilterBar filters={FILTERS} values={{}} onChange={vi.fn()} />);
    const allOptions = screen.getAllByText("All");
    expect(allOptions).toHaveLength(2);
  });

  it("renders all provided options", () => {
    render(<FilterBar filters={FILTERS} values={{}} onChange={vi.fn()} />);
    expect(screen.getByText("Ongoing")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("2022")).toBeInTheDocument();
    expect(screen.getByText("2023")).toBeInTheDocument();
  });

  it("select shows current value from values prop", () => {
    render(
      <FilterBar
        filters={FILTERS}
        values={{ status: "ongoing" }}
        onChange={vi.fn()}
      />
    );
    const statusSelect = screen.getByLabelText("Status") as HTMLSelectElement;
    expect(statusSelect.value).toBe("ongoing");
  });

  it("defaults to empty string when no value provided for filter", () => {
    render(<FilterBar filters={FILTERS} values={{}} onChange={vi.fn()} />);
    const statusSelect = screen.getByLabelText("Status") as HTMLSelectElement;
    expect(statusSelect.value).toBe("");
  });

  it("calls onChange with the filter key and new value on change", async () => {
    const onChange = vi.fn();
    render(<FilterBar filters={FILTERS} values={{}} onChange={onChange} />);

    await userEvent.selectOptions(screen.getByLabelText("Status"), "completed");
    expect(onChange).toHaveBeenCalledWith("status", "completed");
  });

  it("calls onChange for each filter independently", async () => {
    const onChange = vi.fn();
    render(<FilterBar filters={FILTERS} values={{}} onChange={onChange} />);

    await userEvent.selectOptions(screen.getByLabelText("Year"), "2023");
    expect(onChange).toHaveBeenCalledWith("year", "2023");
  });

  it("renders empty state gracefully when no filters provided", () => {
    const { container } = render(
      <FilterBar filters={[]} values={{}} onChange={vi.fn()} />
    );
    expect(container.querySelectorAll("select")).toHaveLength(0);
  });

  it("has accessible role=search region", () => {
    render(<FilterBar filters={FILTERS} values={{}} onChange={vi.fn()} />);
    expect(screen.getByRole("search")).toBeInTheDocument();
  });
});
