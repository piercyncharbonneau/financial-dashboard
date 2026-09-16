"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartTheme } from "@/lib/chart-theme";
import { formatCurrency } from "@/lib/data/metrics";

interface Props {
  data: { period: string; revenue: number }[];
}

export function RevenueTrendChart({ data }: Props) {
  const theme = useChartTheme();

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
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
          tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
          width={48}
        />
        <Tooltip
          cursor={{ fill: theme.gridline, opacity: 0.4 }}
          contentStyle={{
            background: theme.surface,
            border: `1px solid ${theme.gridline}`,
            borderRadius: 8,
            fontSize: 12,
            color: theme.primaryInk,
          }}
          formatter={(value) => [formatCurrency(Number(value)), "Revenue"]}
        />
        <Bar
          dataKey="revenue"
          fill={theme.series1}
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
