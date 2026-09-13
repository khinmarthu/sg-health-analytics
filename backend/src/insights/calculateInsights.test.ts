import { describe, expect, it } from "vitest";
import type { RawHealthRecord } from "@sg-health/types";
import { calculateInsights } from "./calculateInsights.js";

function record(overrides: Partial<RawHealthRecord>): RawHealthRecord {
  return {
    _id: 1,
    epi_year: "2023",
    epi_week: "2023-09",
    clinical_status: "Hospitalised",
    age_groups: "0 - 11 years old",
    count: "0.0",
    ...overrides,
  };
}

describe("calculateInsights", () => {
  it("returns an empty summary for no records", () => {
    expect(calculateInsights([])).toEqual({ averageByAgeGroup: [] });
  });

  it("averages count by age group across all matching rows", () => {
    const records = [
      record({ epi_week: "2023-09", clinical_status: "Hospitalised", count: "2.0" }),
      record({ epi_week: "2023-09", clinical_status: "ICU", count: "1.0" }),
      record({ epi_week: "2023-10", clinical_status: "Hospitalised", count: "4.0" }),
      record({ epi_week: "2023-10", clinical_status: "ICU", count: "3.0" }),
    ];

    const { averageByAgeGroup } = calculateInsights(records);

    expect(averageByAgeGroup).toEqual([{ ageGroup: "0 - 11 years old", average: 2.5 }]);
  });

  it("computes week-over-week change between the two latest weeks present", () => {
    const records = [
      record({ epi_week: "2023-09", clinical_status: "Hospitalised", count: "2.0" }),
      record({ epi_week: "2023-09", clinical_status: "ICU", count: "1.0" }),
      record({ epi_week: "2023-10", clinical_status: "Hospitalised", count: "4.0" }),
      record({ epi_week: "2023-10", clinical_status: "ICU", count: "3.0" }),
    ];

    const { weekOverWeekChange } = calculateInsights(records);

    expect(weekOverWeekChange).toBeDefined();
    expect(weekOverWeekChange).toMatchObject({
      latestWeek: "2023-10",
      previousWeek: "2023-09",
      latestTotal: 7,
      previousTotal: 3,
    });
    expect(weekOverWeekChange!.percentChange).toBeCloseTo(133.33, 1);
  });

  it("omits week-over-week change when only one week is present", () => {
    const records = [record({ epi_week: "2023-09", count: "2.0" })];

    expect(calculateInsights(records).weekOverWeekChange).toBeUndefined();
  });

  it("finds the peak week by total count", () => {
    const records = [
      record({ epi_week: "2023-09", count: "3.0" }),
      record({ epi_week: "2023-10", count: "7.0" }),
      record({ epi_week: "2023-11", count: "5.0" }),
    ];

    expect(calculateInsights(records).peakWeek).toEqual({ epiWeek: "2023-10", total: 7 });
  });

  it("computes the ICU:Hospitalised ratio when both statuses are present", () => {
    const records = [
      record({ clinical_status: "ICU", count: "4.0" }),
      record({ clinical_status: "Hospitalised", count: "6.0" }),
    ];

    expect(calculateInsights(records).icuToHospitalisedRatio).toMatchObject({
      icuTotal: 4,
      hospitalisedTotal: 6,
    });
  });

  it("omits the ICU:Hospitalised ratio when only one status is present", () => {
    const records = [
      record({ clinical_status: "ICU", count: "4.0" }),
      record({ clinical_status: "ICU", count: "1.0" }),
    ];

    expect(calculateInsights(records).icuToHospitalisedRatio).toBeUndefined();
  });
});
