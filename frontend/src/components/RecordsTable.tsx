import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
} from "@mui/material";
import type { RawHealthRecord } from "@sg-health/types";

interface RecordsTableProps {
  items: RawHealthRecord[];
  total: number;
  limit: number;
  offset: number;
  onOffsetChange: (offset: number) => void;
  onLimitChange: (limit: number) => void;
}

export function RecordsTable({
  items,
  total,
  limit,
  offset,
  onOffsetChange,
  onLimitChange,
}: RecordsTableProps) {
  // MUI's TablePagination is 0-indexed (page 0 = first page); our API is
  // offset-based, so page = offset / limit.
  const page = Math.floor(offset / limit);

  return (
    <Paper sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Only this region scrolls — pagination below stays fixed in view. */}
      <TableContainer sx={{ flex: 1, overflow: "auto" }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Epi Week</TableCell>
              <TableCell>Clinical Status</TableCell>
              <TableCell>Age Group</TableCell>
              <TableCell align="right">Count</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((row) => (
              <TableRow key={row._id}>
                <TableCell>{row.epi_week}</TableCell>
                <TableCell>{row.clinical_status}</TableCell>
                <TableCell>{row.age_groups}</TableCell>
                <TableCell align="right">{row.count}</TableCell>
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
