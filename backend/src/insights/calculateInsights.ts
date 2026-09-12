import type { RawHealthRecord } from "../services/dataGovClient.js";

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
  // omitted (not just null) when the matching rows don't support the metric —
  // see calculateInsights below for exactly when.
  weekOverWeekChange?: WeekOverWeekChange;
  peakWeek?: PeakWeek;
  icuToHospitalisedRatio?: IcuToHospitalisedRatio;
}

interface ParsedRecord {
  epiWeek: string;
  clinicalStatus: string;
  ageGroup: string;
  count: number;
}

function parseRecord(raw: RawHealthRecord): ParsedRecord {
  return {
    epiWeek: raw.epi_week,
    clinicalStatus: raw.clinical_status,
    ageGroup: raw.age_groups,
    count: Number(raw.count),
  };
}

/** Computes all insight metrics from whatever rows are passed in — the
 * caller decides the scope (full dataset, or a filtered subset). Every
 * metric here operates only on `records`, so filtering upstream is all
 * that's needed to make insights reflect the current filter selection. */
export function calculateInsights(rawRecords: RawHealthRecord[]): InsightsSummary {
  const records = rawRecords.map(parseRecord);

  if (records.length === 0) {
    return { averageByAgeGroup: [] };
  }

  // 1. Average count by age group.
  const countsByAgeGroup = new Map<string, number[]>();
  for (const r of records) {
    const list = countsByAgeGroup.get(r.ageGroup) ?? [];
    list.push(r.count);
    countsByAgeGroup.set(r.ageGroup, list);
  }
  const averageByAgeGroup: AgeGroupAverage[] = [...countsByAgeGroup.entries()].map(
    ([ageGroup, counts]) => ({
      ageGroup,
      average: counts.reduce((sum, c) => sum + c, 0) / counts.length,
    }),
  );

  // Shared groundwork for #2 and #3: total count per epi_week.
  const totalsByWeek = new Map<string, number>();
  for (const r of records) {
    totalsByWeek.set(r.epiWeek, (totalsByWeek.get(r.epiWeek) ?? 0) + r.count);
  }
  const weeksSorted = [...totalsByWeek.keys()].sort(); // "YYYY-WW" sorts correctly as plain strings

  // 2. Week-over-week % change — needs at least 2 distinct weeks in the
  // matching rows; omitted otherwise (e.g. a filter that collapses to one week).
  let weekOverWeekChange: WeekOverWeekChange | undefined;
  if (weeksSorted.length >= 2) {
    const latestWeek = weeksSorted[weeksSorted.length - 1];
    const previousWeek = weeksSorted[weeksSorted.length - 2];
    const latestTotal = totalsByWeek.get(latestWeek)!;
    const previousTotal = totalsByWeek.get(previousWeek)!;
    const percentChange =
      previousTotal === 0 ? 0 : ((latestTotal - previousTotal) / previousTotal) * 100;
    weekOverWeekChange = { latestWeek, previousWeek, latestTotal, previousTotal, percentChange };
  }

  // 3. Peak week — highest total count across the matching rows.
  let peakWeek: PeakWeek | undefined;
  for (const [epiWeek, total] of totalsByWeek) {
    if (!peakWeek || total > peakWeek.total) {
      peakWeek = { epiWeek, total };
    }
  }

  // 4. ICU:Hospitalised ratio — omitted when the matching rows only have
  // one clinical_status present (e.g. clinical_status is the active filter),
  // since there's nothing to compare against.
  const hasIcu = records.some((r) => r.clinicalStatus === "ICU");
  const hasHospitalised = records.some((r) => r.clinicalStatus === "Hospitalised");
  let icuToHospitalisedRatio: IcuToHospitalisedRatio | undefined;
  if (hasIcu && hasHospitalised) {
    const icuTotal = records
      .filter((r) => r.clinicalStatus === "ICU")
      .reduce((sum, r) => sum + r.count, 0);
    const hospitalisedTotal = records
      .filter((r) => r.clinicalStatus === "Hospitalised")
      .reduce((sum, r) => sum + r.count, 0);
    icuToHospitalisedRatio = {
      icuTotal,
      hospitalisedTotal,
      ratio: hospitalisedTotal === 0 ? 0 : icuTotal / hospitalisedTotal,
    };
  }

  return { averageByAgeGroup, weekOverWeekChange, peakWeek, icuToHospitalisedRatio };
}
