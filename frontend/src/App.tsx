import { useEffect, useState } from "react";
import { Alert, Box, Container, Stack, Typography } from "@mui/material";
import { useGetRecordsQuery } from "./app/api.js";
import { useAppSelector } from "./app/hooks.js";
import { selectRecordsFilters } from "./features/filters/filtersSlice.js";
import { FilterBar } from "./components/FilterBar.js";
import { InsightSummary } from "./components/InsightSummary.js";
import { RecordsTable } from "./components/RecordsTable.js";

export function App() {
  const [limit, setLimit] = useState(100);
  const [offset, setOffset] = useState(0);
  const filters = useAppSelector(selectRecordsFilters);

  // Reset to page 1 whenever the filter selection changes — otherwise you
  // could be sitting on page 3 of a filtered set that now only has 1 page.
  const filtersKey = JSON.stringify(filters);
  useEffect(() => {
    setOffset(0);
  }, [filtersKey]);

  const { data, isLoading, error } = useGetRecordsQuery({ limit, offset, filters });

  return (
    <Container sx={{ height: "100%", display: "flex", flexDirection: "column", py: 3 }}>
      {/* Fixed-size header block: title, filters, insight. Doesn't scroll —
          the page itself has no scrollbar (see index.css); only the table
          rows below get their own internal scroll region. */}
      <Stack spacing={2} sx={{ flexShrink: 0, pb: 2 }}>
        <Typography variant="h4">SG Health Analytics</Typography>
        <FilterBar />

        {isLoading && <p>Loading...</p>}
        {(error || (data && !data.success)) && (
          <Alert severity="error">Failed to load records</Alert>
        )}

        {data?.success && <InsightSummary insights={data.data.insights} />}
      </Stack>

      {/* Takes all remaining height; minHeight: 0 is required for a flex
          child to be allowed to shrink/scroll instead of overflowing. */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        {data?.success && (
          <RecordsTable
            items={data.data.items}
            total={data.data.total}
            limit={limit}
            offset={offset}
            onOffsetChange={setOffset}
            onLimitChange={setLimit}
          />
        )}
      </Box>
    </Container>
  );
}
