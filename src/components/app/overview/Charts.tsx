"use client";

import { AllCommunityModule, ModuleRegistry, type AgCartesianChartOptions, type AgChartTheme } from "ag-charts-community";
import { AgCharts } from "ag-charts-react";
import { useMemo } from "react";
import type { WeekPoint } from "@/lib/overview";
import { usd } from "@/lib/format";

ModuleRegistry.registerModules([AllCommunityModule]);

export const CHART = {
  green: "#15803d",
  red: "#b91c1c",
  refund: "#d4d4d4",
  ink: "#0a0a0a",
  grid: "#f2f2f2",
  label: "#a1a1a1",
};

/** Exhibit's chart theme: Geist, no chrome, grey grid, ink tooltips. Canvas needs the resolved font family name. */
function useTheme(): AgChartTheme {
  return useMemo(() => {
    const font = typeof document !== "undefined" ? getComputedStyle(document.body).fontFamily : "system-ui";
    return {
      baseTheme: "ag-default",
      palette: { fills: [CHART.green, CHART.refund, CHART.red, CHART.ink], strokes: [CHART.green, CHART.refund, CHART.red, CHART.ink] },
      params: {
        fontFamily: font,
        fontSize: 11,
        foregroundColor: CHART.ink,
        textColor: "#737373",
        subtleTextColor: CHART.label,
        backgroundColor: "transparent",
        chartBackgroundColor: "transparent",
        gridLineColor: CHART.grid,
        axisLineColor: "#ebebeb",
        chartPadding: 0,
        tooltipBackgroundColor: CHART.ink,
        tooltipTextColor: "#ffffff",
        tooltipSubtleTextColor: "#a1a1a1",
        tooltipBorder: false,
        tooltipBorderRadius: 8,
      },
    };
  }, []);
}

const money = (n: number) => (Math.abs(n) >= 1000 ? `$${(Math.abs(n) / 1000).toFixed(1).replace(/\.0$/, "")}k` : `$${Math.abs(Math.round(n))}`);

/** Weekly money out of resolved cases: kept above the line, given back below it. */
export function RecoveryChart({ weekly }: { weekly: WeekPoint[] }) {
  const theme = useTheme();
  const options = useMemo<AgCartesianChartOptions>(() => {
    const data = weekly.map((w) => ({ label: w.label, recovered: w.recovered, refunded: -w.refunded, lost: -w.lost }));
    const tooltip = {
      renderer: ({ datum }: { datum: (typeof data)[number] }) => ({
        heading: `Week of ${datum.label}`,
        data: [
          { label: "Recovered", value: usd(datum.recovered, 0) },
          { label: "Refunded honestly", value: usd(-datum.refunded, 0) },
          { label: "Lost", value: usd(-datum.lost, 0) },
        ],
      }),
    };
    return {
      theme,
      data,
      background: { visible: false },
      padding: { top: 6, right: 2, bottom: 0, left: 0 },
      legend: { enabled: false },
      series: [
        { type: "bar", xKey: "label", yKey: "recovered", yName: "Recovered", stackGroup: "kept", fill: CHART.green, cornerRadius: 3, tooltip },
        { type: "bar", xKey: "label", yKey: "refunded", yName: "Refunded honestly", stackGroup: "out", fill: CHART.refund, cornerRadius: 0, tooltip },
        { type: "bar", xKey: "label", yKey: "lost", yName: "Lost", stackGroup: "out", fill: CHART.red, fillOpacity: 0.85, cornerRadius: 3, tooltip },
      ],
      axes: {
        x: {
          type: "category",
          position: "bottom",
          paddingInner: 0.42,
          paddingOuter: 0.2,
          line: { enabled: false },
          tick: { enabled: false },
          label: { color: CHART.label, fontSize: 10.5, avoidCollisions: true, minSpacing: 12, wrapping: "never", rotation: 0 },
          gridLine: { enabled: false },
        },
        y: {
          type: "number",
          position: "left",
          line: { enabled: false },
          tick: { enabled: false },
          label: { color: CHART.label, fontSize: 10.5, formatter: ({ value }: { value: number }) => (value === 0 ? "$0" : money(value)) },
          gridLine: { style: [{ stroke: CHART.grid, lineDash: [] }] },
          crossLines: [{ type: "line", value: 0, stroke: "#d4d4d4", strokeWidth: 1 }],
        },
      },
    } as AgCartesianChartOptions;
  }, [weekly, theme]);
  return <AgCharts options={options} style={{ height: "100%", width: "100%" }} />;
}

/** Rolling 30-day dispute rate against the card networks' 1.5% monitoring line. */
export function RateChart({ series, threshold, height = 150 }: { series: { label: string; rate: number }[]; threshold: number; height?: number }) {
  const theme = useTheme();
  const options = useMemo<AgCartesianChartOptions>(() => {
    const top = Math.max(2, Math.ceil(Math.max(...series.map((s) => s.rate), threshold) * 2) / 2 + 0.25);
    return {
      theme,
      data: series,
      background: { visible: false },
      padding: { top: 4, right: 10, bottom: 0, left: 0 },
      legend: { enabled: false },
      series: [
        {
          type: "area",
          xKey: "label",
          yKey: "rate",
          yName: "Dispute rate",
          fill: CHART.ink,
          fillOpacity: 0.05,
          stroke: CHART.ink,
          strokeWidth: 1.5,
          interpolation: { type: "smooth" },
          marker: { enabled: false },
          tooltip: { renderer: ({ datum }: { datum: { label: string; rate: number } }) => ({ heading: `30 days to ${datum.label}`, data: [{ label: "Dispute rate", value: `${datum.rate.toFixed(2)}%` }] }) },
        },
      ],
      axes: {
        x: { type: "category", position: "bottom", line: { enabled: false }, tick: { enabled: false }, label: { color: CHART.label, fontSize: 10, minSpacing: 22, wrapping: "never", rotation: 0, avoidCollisions: true }, gridLine: { enabled: false } },
        y: {
          type: "number",
          position: "left",
          min: 0,
          max: top,
          interval: { step: 0.5 },
          line: { enabled: false },
          tick: { enabled: false },
          label: { color: CHART.label, fontSize: 10, formatter: ({ value }: { value: number }) => `${value}%` },
          gridLine: { style: [{ stroke: CHART.grid, lineDash: [] }] },
          crossLines: [
            {
              type: "line",
              value: threshold,
              stroke: CHART.red,
              strokeWidth: 1,
              lineDash: [4, 3],
              strokeOpacity: 0.8,
              label: { text: `${threshold}% network line`, position: "inside-top-right", color: CHART.red, fontSize: 10, padding: 4 },
            },
          ],
        },
      },
    } as AgCartesianChartOptions;
  }, [series, threshold, theme]);
  return <AgCharts options={options} style={{ height, width: "100%" }} />;
}
