"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartTheme } from "@/lib/chart-theme";
import { formatCurrency } from "@/lib/data/metrics";

interface Props {
  data: { period: string; value: number; isActual: boolean }[];
  seriesLabel: string;
  color?: "series1" | "series3";
}

export function ActualVsForecastChart({ data, seriesLabel, color = "series1" }: Props) {
  const theme = useChartTheme();
  const base = theme[color];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={theme.gridline} />
        <XAxis
          dataKey="period"
          tick={{ fill: theme.mutedInk, fontSize: 12 }}
          axisLine={{ stroke: theme.axis }}
          tickLine={false}
          tickFormatter={(v: string) => v.split(" ")[0]}
        />
        <YAxis
          tick={{ fill: theme.mutedInk, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
          width={48}
        />
        <ReferenceLine y={0} stroke={theme.axis} />
        <Tooltip
          cursor={{ fill: theme.gridline, opacity: 0.4 }}
          contentStyle={{
            background: theme.surface,
            border: `1px solid ${theme.gridline}`,
            borderRadius: 8,
            fontSize: 12,
            color: theme.primaryInk,
          }}
          formatter={(value, _name, item) => [
            formatCurrency(Number(value)),
            item?.payload?.isActual ? `${seriesLabel} (actual)` : `${seriesLabel} (forecast)`,
          ]}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
          {data.map((d, i) => (
            <Cell key={i} fill={base} fillOpacity={d.isActual ? 1 : 0.4} />
          ))}
        </Bar>
        <Legend
          verticalAlign="top"
          height={28}
          content={() => (
            <div className="flex gap-4 justify-center text-xs mb-1" style={{ color: theme.secondaryInk }}>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: base }} />
                Actual
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: base, opacity: 0.4 }} />
                Forecast
              </span>
            </div>
          )}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
