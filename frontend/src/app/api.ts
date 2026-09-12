import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { ApiResponse, FiltersResponseData, RecordsResponseData } from "@sg-health/types";

const baseUrl = import.meta.env.VITE_API_BASE_URL;

export interface RecordsQueryParams {
  limit: number;
  offset: number;
  clinical_status?: string;
  age_groups?: string;
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
      query: (params) => ({ url: "/api/records", params }),
    }),
  }),
});

export const { useGetFiltersQuery, useGetRecordsQuery } = api;
