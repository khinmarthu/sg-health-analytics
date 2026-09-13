import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  ApiResponse,
  FiltersResponseData,
  RecordsFilters,
  RecordsResponseData,
} from "@sg-health/types";

const baseUrl = import.meta.env.VITE_API_BASE_URL;

export interface RecordsQueryParams {
  limit: number;
  offset: number;
  filters?: RecordsFilters;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
}

// One api slice for our whole backend (standard RTK Query pattern — a
// single createApi per backend, not one per feature), since both
// endpoints share the same baseUrl and cache/tag system.
export const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({ baseUrl }),
  endpoints: (builder) => ({
    getFilters: builder.query<ApiResponse<FiltersResponseData>, void>({
      query: () => "/api/filters",
    }),
    getRecords: builder.query<ApiResponse<RecordsResponseData>, RecordsQueryParams>({
      query: ({ limit, offset, filters, sort_by, sort_dir }) => ({
        url: "/api/records",
        params: {
          limit,
          offset,
          // omit entirely when empty/unset, rather than sending "filters={}"
          // or a meaningless sort_by=undefined
          ...(filters && Object.keys(filters).length > 0
            ? { filters: JSON.stringify(filters) }
            : {}),
          ...(sort_by ? { sort_by, sort_dir } : {}),
        },
      }),
    }),
  }),
});

export const { useGetFiltersQuery, useGetRecordsQuery } = api;
