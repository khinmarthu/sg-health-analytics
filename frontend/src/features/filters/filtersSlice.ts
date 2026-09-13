import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RecordsFilters } from "@sg-health/types";
import type { RootState } from "../../app/store.js";

// Stored as arrays always (even a single checked box), since checkboxes
// are inherently multi-select. An empty array means "no filter on this field".
export interface FiltersState {
  clinical_status: string[];
  age_groups: string[];
  epi_week: string[];
}

const initialState: FiltersState = {
  clinical_status: [],
  age_groups: [],
  epi_week: [],
};

type FilterField = keyof FiltersState;

const filtersSlice = createSlice({
  name: "filters",
  initialState,
  reducers: {
    // MUI's <Select multiple> hands back the complete new selection array
    // on every change (not one-value-at-a-time events), so this replaces
    // the whole field rather than toggling a single value.
    setField(state, action: PayloadAction<{ field: FilterField; values: string[] }>) {
      state[action.payload.field] = action.payload.values;
    },
    clearAll() {
      return initialState;
    },
  },
});

export const { setField, clearAll } = filtersSlice.actions;
export default filtersSlice.reducer;

/** Builds the RecordsFilters object /api/records expects — only fields
 * with at least one selected value are included. */
export function selectRecordsFilters(state: RootState): RecordsFilters {
  const { clinical_status, age_groups, epi_week } = state.filters;
  const filters: RecordsFilters = {};
  if (clinical_status.length > 0) filters.clinical_status = clinical_status;
  if (age_groups.length > 0) filters.age_groups = age_groups;
  if (epi_week.length > 0) filters.epi_week = epi_week;
  return filters;
}
