// Shapes shared between backend and frontend. Type-only package — every
// import of this is `import type { ... }`, erased at compile time, so
// there's nothing to build/bundle (see PLAN.md Decisions Log #9).
// These match what the backend actually returns, verified against real
// data.gov.sg data — not speculative shapes written ahead of the code.

/** Raw shape as data.gov.sg returns it: every field is a string except
 * _id, even the numeric-looking ones (epi_year, count). */
export interface RawHealthRecord {
  _id: number;
  epi_year: string;
  epi_week: string;
  clinical_status: string;
  age_groups: string;
  count: string;
}

export interface AgeGroupAverage {
  ageGroup: string;
  average: number;
}

export interface WeekOverWeekChange {
  latestWeek: string;
  previousWeek: string;
  latestTotal: number;
  previousTotal: number;
  percentChange: number;
}

export interface PeakWeek {
  epiWeek: string;
  total: number;
}

export interface IcuToHospitalisedRatio {
  icuTotal: number;
  hospitalisedTotal: number;
  ratio: number;
}

export interface InsightsSummary {
  averageByAgeGroup: AgeGroupAverage[];
  // omitted (not null) when the matching rows don't support the metric —
  // see backend/src/insights/calculateInsights.ts for exactly when.
  weekOverWeekChange?: WeekOverWeekChange;
  peakWeek?: PeakWeek;
  icuToHospitalisedRatio?: IcuToHospitalisedRatio;
}

/** GET /api/records response data. */
export interface RecordsResponseData {
  items: RawHealthRecord[];
  total: number;
  limit: number;
  offset: number;
  insights: InsightsSummary;
}

/** GET /api/filters response data: unique values per filterable field. */
export interface FiltersResponseData {
  clinical_status: string[];
  age_groups: string[];
  epi_week: string[];
}

/** Filters accepted by GET /api/records (as one JSON `filters` query param,
 * same shape data.gov.sg itself accepts — exact-match per field, and a
 * single value or an array (OR-match) per field). */
export interface RecordsFilters {
  clinical_status?: string | string[];
  age_groups?: string | string[];
  epi_week?: string | string[];
}

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string } };
