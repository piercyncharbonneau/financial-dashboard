"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartTheme } from "@/lib/chart-theme";
import { formatPercent } from "@/lib/data/metrics";

interface Props {
  data: { period: string; grossMarginPct: number; netMarginPct: number }[];
}

export function MarginTrendChart({ data }: Props) {
  const theme = useChartTheme();

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={theme.gridline} />
        <XAxis
          dataKey="period"
          tick={{ fill: theme.mutedInk, fontSize: 12 }}
          axisLine={{ stroke: theme.axis }}
          tickLine={false}
          tickFormatter={(v: string) => v.replace(" 2026", "")}
        />
        <YAxis
          tick={{ fill: theme.mutedInk, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
          width={44}
        />
        <Tooltip
          contentStyle={{
            background: theme.surface,
            border: `1px solid ${theme.gridline}`,
            borderRadius: 8,
            fontSize: 12,
            color: theme.primaryInk,
          }}
          formatter={(value, name) => [
            formatPercent(Number(value)),
            name === "grossMarginPct" ? "Gross margin" : "Net margin",
          ]}
        />
        <Line
          type="monotone"
          dataKey="grossMarginPct"
          stroke={theme.series1}
          strokeWidth={2}
          dot={{ r: 3, fill: theme.series1 }}
          name="grossMarginPct"
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="netMarginPct"
          stroke={theme.series2}
          strokeWidth={2}
          dot={{ r: 3, fill: theme.series2 }}
          name="netMarginPct"
          isAnimationActive={false}
        />
        <Legend
          verticalAlign="top"
          height={28}
          iconType="plainline"
          formatter={(value: string) =>
            value === "grossMarginPct" ? "Gross margin" : "Net margin"
          }
          wrapperStyle={{ fontSize: 12, color: theme.secondaryInk }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
