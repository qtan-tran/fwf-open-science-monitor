import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataTable } from "@/components/ui/DataTable";

const COLUMNS = [
  { key: "name",  label: "Name",   sortable: true  },
  { key: "year",  label: "Year",   sortable: true  },
  { key: "score", label: "Score",  sortable: false },
];

const DATA = [
  { name: "Alpha", year: 2020, score: 90 },
  { name: "Beta",  year: 2019, score: 75 },
  { name: "Gamma", year: 2021, score: 88 },
];

describe("DataTable", () => {
  describe("rendering", () => {
    it("renders column headers", () => {
      render(
        <DataTable
          columns={COLUMNS}
          data={DATA}
          page={1}
          totalPages={1}
          onPageChange={vi.fn()}
        />
      );
      expect(screen.getByText("Name")).toBeInTheDocument();
      expect(screen.getByText("Year")).toBeInTheDocument();
      expect(screen.getByText("Score")).toBeInTheDocument();
    });

    it("renders data rows", () => {
      render(
        <DataTable
          columns={COLUMNS}
          data={DATA}
          page={1}
          totalPages={1}
          onPageChange={vi.fn()}
        />
      );
      expect(screen.getByText("Alpha")).toBeInTheDocument();
      expect(screen.getByText("Beta")).toBeInTheDocument();
      expect(screen.getByText("Gamma")).toBeInTheDocument();
    });

    it("renders '—' for null/undefined values", () => {
      const dataWithNull = [{ name: null, year: 2020, score: 0 }];
      render(
        <DataTable
          columns={COLUMNS}
          data={dataWithNull}
          page={1}
          totalPages={1}
          onPageChange={vi.fn()}
        />
      );
      expect(screen.getByText("—")).toBeInTheDocument();
    });

    it("renders empty state message when data is empty", () => {
      render(
        <DataTable
          columns={COLUMNS}
          data={[]}
          page={1}
          totalPages={1}
          onPageChange={vi.fn()}
        />
      );
      expect(screen.getByText(/no data/i)).toBeInTheDocument();
    });

    it("uses custom render function when provided", () => {
      const columnsWithRender = [
        { key: "name", label: "Name", render: (v: unknown) => <strong>{String(v)}-custom</strong> },
      ];
      render(
        <DataTable
          columns={columnsWithRender}
          data={[{ name: "Alpha" }]}
          page={1}
          totalPages={1}
          onPageChange={vi.fn()}
        />
      );
      expect(screen.getByText("Alpha-custom")).toBeInTheDocument();
    });
  });

  describe("pagination", () => {
    it("does not render pagination when totalPages is 1", () => {
      render(
        <DataTable
          columns={COLUMNS}
          data={DATA}
          page={1}
          totalPages={1}
          onPageChange={vi.fn()}
        />
      );
      expect(screen.queryByText(/page 1 of/i)).not.toBeInTheDocument();
    });

    it("shows page indicator when totalPages > 1", () => {
      render(
        <DataTable
          columns={COLUMNS}
          data={DATA}
          page={2}
          totalPages={5}
          onPageChange={vi.fn()}
        />
      );
      expect(screen.getByText(/page 2 of 5/i)).toBeInTheDocument();
    });

    it("calls onPageChange with decremented page when Previous is clicked", async () => {
      const onPageChange = vi.fn();
      render(
        <DataTable
          columns={COLUMNS}
          data={DATA}
          page={3}
          totalPages={5}
          onPageChange={onPageChange}
        />
      );
      await userEvent.click(screen.getByLabelText("Previous page"));
      expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it("calls onPageChange with incremented page when Next is clicked", async () => {
      const onPageChange = vi.fn();
      render(
        <DataTable
          columns={COLUMNS}
          data={DATA}
          page={2}
          totalPages={5}
          onPageChange={onPageChange}
        />
      );
      await userEvent.click(screen.getByLabelText("Next page"));
      expect(onPageChange).toHaveBeenCalledWith(3);
    });

    it("disables Previous button on first page", () => {
      render(
        <DataTable
          columns={COLUMNS}
          data={DATA}
          page={1}
          totalPages={5}
          onPageChange={vi.fn()}
        />
      );
      expect(screen.getByLabelText("Previous page")).toBeDisabled();
    });

    it("disables Next button on last page", () => {
      render(
        <DataTable
          columns={COLUMNS}
          data={DATA}
          page={5}
          totalPages={5}
          onPageChange={vi.fn()}
        />
      );
      expect(screen.getByLabelText("Next page")).toBeDisabled();
    });
  });

  describe("sorting", () => {
    it("calls onSort when a sortable column header is clicked", async () => {
      const onSort = vi.fn();
      render(
        <DataTable
          columns={COLUMNS}
          data={DATA}
          page={1}
          totalPages={1}
          onPageChange={vi.fn()}
          onSort={onSort}
        />
      );
      await userEvent.click(screen.getByText("Name"));
      expect(onSort).toHaveBeenCalledWith("name", "asc");
    });

    it("toggles sort direction on second click", async () => {
      const onSort = vi.fn();
      render(
        <DataTable
          columns={COLUMNS}
          data={DATA}
          page={1}
          totalPages={1}
          onPageChange={vi.fn()}
          onSort={onSort}
        />
      );
      await userEvent.click(screen.getByText("Name"));
      await userEvent.click(screen.getByText("Name"));
      expect(onSort).toHaveBeenLastCalledWith("name", "desc");
    });

    it("does not call onSort for non-sortable columns", async () => {
      const onSort = vi.fn();
      render(
        <DataTable
          columns={COLUMNS}
          data={DATA}
          page={1}
          totalPages={1}
          onPageChange={vi.fn()}
          onSort={onSort}
        />
      );
      await userEvent.click(screen.getByText("Score"));
      expect(onSort).not.toHaveBeenCalled();
    });
  });
});
