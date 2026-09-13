import { Alert, Button, Stack } from "@mui/material";
import { useGetFiltersQuery } from "../app/api.js";
import { useAppDispatch } from "../app/hooks.js";
import { clearAll } from "../features/filters/filtersSlice.js";
import { FilterFieldSelect } from "./FilterFieldSelect.js";

export function FilterBar() {
  const dispatch = useAppDispatch();
  const { data, isLoading, error } = useGetFiltersQuery();

  if (isLoading) return <p>Loading filters...</p>;
  if (error || !data?.success) return <Alert severity="error">Failed to load filters</Alert>;

  const { clinical_status, age_groups, epi_week } = data.data;

  return (
    <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
      <FilterFieldSelect field="clinical_status" label="Clinical Status" options={clinical_status} />
      <FilterFieldSelect field="age_groups" label="Age Group" options={age_groups} />
      <FilterFieldSelect field="epi_week" label="Epi Week" options={epi_week} />
      <Button onClick={() => dispatch(clearAll())}>Clear filters</Button>
    </Stack>
  );
}
