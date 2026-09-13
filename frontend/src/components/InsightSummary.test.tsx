import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { InsightsSummary } from "@sg-health/types";
import { InsightSummary } from "./InsightSummary.js";

const fullInsights: InsightsSummary = {
  averageByAgeGroup: [{ ageGroup: "0 - 11 years old", average: 2.9 }],
  weekOverWeekChange: {
    latestWeek: "2024-08",
    previousWeek: "2024-07",
    latestTotal: 15.2,
    previousTotal: 15.9,
    percentChange: -4.4,
  },
  peakWeek: { epiWeek: "2023-50", total: 572.7 },
  icuToHospitalisedRatio: { icuTotal: 210.9, hospitalisedTotal: 8066.8, ratio: 0.026 },
};

describe("InsightSummary", () => {
  it("renders every metric when all are present", () => {
    render(<InsightSummary insights={fullInsights} />);

    expect(screen.getByText(/Average by age group/i)).toBeInTheDocument();
    expect(screen.getByText(/0 - 11 years old: 2.9/)).toBeInTheDocument();
    expect(screen.getByText(/Week-over-week change/i)).toBeInTheDocument();
    expect(screen.getByText(/Peak week/i)).toBeInTheDocument();
    expect(screen.getByText(/ICU : Hospitalised ratio/i)).toBeInTheDocument();
  });

  it("doesn't render a card for an omitted metric (e.g. ICU ratio)", () => {
    const { icuToHospitalisedRatio: _omit, ...withoutRatio } = fullInsights;

    render(<InsightSummary insights={withoutRatio} />);

    expect(screen.queryByText(/ICU : Hospitalised ratio/i)).not.toBeInTheDocument();
  });
});
