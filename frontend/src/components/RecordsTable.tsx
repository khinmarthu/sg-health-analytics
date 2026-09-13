import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
} from "@mui/material";
import type { RawHealthRecord } from "@sg-health/types";

type SortDirection = "asc" | "desc";

// Field + label pairs driving the header row — matches the sortable
// fields the backend accepts (see records.ts's `sortableFields`).
const columns: { field: keyof RawHealthRecord; label: string; align?: "right" }[] = [
  { field: "epi_year", label: "Epi Year" },
  { field: "epi_week", label: "Epi Week" },
  { field: "clinical_status", label: "Clinical Status" },
  { field: "age_groups", label: "Age Group" },
  { field: "count", label: "Count", align: "right" },
];

interface RecordsTableProps {
  items: RawHealthRecord[];
  total: number;
  limit: number;
  offset: number;
  onOffsetChange: (offset: number) => void;
  onLimitChange: (limit: number) => void;
  sortBy: string | undefined;
  sortDir: SortDirection;
  onSortChange: (field: string, direction: SortDirection) => void;
}

export function RecordsTable({
  items,
  total,
  limit,
  offset,
  onOffsetChange,
  onLimitChange,
  sortBy,
  sortDir,
  onSortChange,
}: RecordsTableProps) {
  // MUI's TablePagination is 0-indexed (page 0 = first page); our API is
  // offset-based, so page = offset / limit.
  const page = Math.floor(offset / limit);

  const handleSortClick = (field: string) => {
    // Same field clicked again -> flip direction; a different field ->
    // start fresh at ascending.
    const nextDir: SortDirection = sortBy === field && sortDir === "asc" ? "desc" : "asc";
    onSortChange(field, nextDir);
  };

  return (
    <Paper sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Only this region scrolls — pagination below stays fixed in view. */}
      <TableContainer sx={{ flex: 1, overflow: "auto" }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell key={column.field} align={column.align}>
                  <TableSortLabel
                    active={sortBy === column.field}
                    direction={sortBy === column.field ? sortDir : "asc"}
                    onClick={() => handleSortClick(column.field)}
                  >
                    {column.label}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((row) => (
              <TableRow key={row._id}>
                {columns.map((column) => (
                  <TableCell key={column.field} align={column.align}>
                    {row[column.field]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={total}
        page={page}
        rowsPerPage={limit}
        rowsPerPageOptions={[25, 50, 100]}
        onPageChange={(_event, newPage) => onOffsetChange(newPage * limit)}
        onRowsPerPageChange={(event) => {
          onLimitChange(Number(event.target.value));
          onOffsetChange(0); // changing page size resets to page 1 — old offset would misalign
        }}
        sx={{ flexShrink: 0 }}
      />
    </Paper>
  );
}
