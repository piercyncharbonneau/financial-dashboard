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
  data: { label: string; value: number }[];
  valueLabel?: string;
  color?: "series1" | "series2" | "series3";
}

export function HorizontalBarChart({ data, valueLabel = "Value", color = "series1" }: Props) {
  const theme = useChartTheme();
  const chartData = data.slice(0, 10).map((d) => ({
    name: d.label.length > 28 ? d.label.slice(0, 26) + "…" : d.label,
    value: d.value,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 32)}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
      >
        <CartesianGrid horizontal={false} stroke={theme.gridline} />
        <XAxis
          type="number"
          tick={{ fill: theme.mutedInk, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: theme.secondaryInk, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={170}
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
          formatter={(value) => [formatCurrency(Number(value)), valueLabel]}
        />
        <Bar
          dataKey="value"
          fill={theme[color]}
          radius={[0, 4, 4, 0]}
          maxBarSize={18}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
