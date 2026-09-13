import { Card, CardContent, Stack, Typography } from "@mui/material";
import type { InsightsSummary } from "@sg-health/types";

interface InsightSummaryProps {
  insights: InsightsSummary;
}

/** Displays whatever the backend computed — fields it omitted (see
 * calculateInsights.ts) are simply not rendered, not shown as zero/null. */
export function InsightSummary({ insights }: InsightSummaryProps) {
  const { averageByAgeGroup, weekOverWeekChange, peakWeek, icuToHospitalisedRatio } = insights;

  return (
    <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
      <Card variant="outlined" sx={{ minWidth: 220 }}>
        <CardContent>
          <Typography variant="subtitle2">Average by age group</Typography>
          {averageByAgeGroup.map((a) => (
            <Typography key={a.ageGroup} variant="body2">
              {a.ageGroup}: {a.average.toFixed(1)}
            </Typography>
          ))}
        </CardContent>
      </Card>

      {weekOverWeekChange && (
        <Card variant="outlined" sx={{ minWidth: 220 }}>
          <CardContent>
            <Typography variant="subtitle2">Week-over-week change</Typography>
            <Typography variant="body2">
              {weekOverWeekChange.previousWeek} → {weekOverWeekChange.latestWeek}
            </Typography>
            <Typography variant="body2">
              {weekOverWeekChange.percentChange >= 0 ? "+" : ""}
              {weekOverWeekChange.percentChange.toFixed(1)}%
            </Typography>
          </CardContent>
        </Card>
      )}

      {peakWeek && (
        <Card variant="outlined" sx={{ minWidth: 220 }}>
          <CardContent>
            <Typography variant="subtitle2">Peak week</Typography>
            <Typography variant="body2">
              {peakWeek.epiWeek}: {peakWeek.total.toFixed(1)}
            </Typography>
          </CardContent>
        </Card>
      )}

      {icuToHospitalisedRatio && (
        <Card variant="outlined" sx={{ minWidth: 220 }}>
          <CardContent>
            <Typography variant="subtitle2">ICU : Hospitalised ratio</Typography>
            <Typography variant="body2">{icuToHospitalisedRatio.ratio.toFixed(3)}</Typography>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
