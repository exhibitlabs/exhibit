"use client";

import { AllCommunityModule, ModuleRegistry, type AgCartesianChartOptions, type AgChartTheme } from "ag-charts-community";
import { AgCharts } from "ag-charts-react";
import { useMemo } from "react";
import type { WeekPoint } from "@/lib/overview";
import { usd } from "@/lib/format";

ModuleRegistry.registerModules([AllCommunityModule]);

/** Chart colours: green is money kept, red a lost fight, a light warm grey a refund chosen on purpose; ink for neutral series. */
export const CHART = {
  green: "#15803d",
  red: "#b91c1c",
  refund: "#d9d9d6",
  ink: "#0a0a0a",
  grid: "#f1f1f0",
  base: "#cdcdca",
  label: "#737371",
};

/** Exhibit's chart theme: Geist, no chrome, faint horizontal grid, ink tooltips. Canvas needs the resolved font family name. */
function useTheme(): AgChartTheme {
  return useMemo(() => {
    const font = typeof document !== "undefined" ? getComputedStyle(document.body).fontFamily : "system-ui";
    return {
      baseTheme: "ag-default",
      palette: { fills: [CHART.green, CHART.refund, CHART.red, CHART.ink], strokes: [CHART.green, CHART.refund, CHART.red, CHART.ink] },
      params: {
        fontFamily: font,
        fontSize: 12,
        foregroundColor: CHART.ink,
        textColor: CHART.label,
        subtleTextColor: CHART.label,
        backgroundColor: "transparent",
        chartBackgroundColor: "transparent",
        gridLineColor: CHART.grid,
        axisLineColor: CHART.base,
        chartPadding: 0,
        tooltipBackgroundColor: CHART.ink,
        tooltipTextColor: "#ffffff",
        tooltipSubtleTextColor: "#b5b5b2",
        tooltipBorder: false,
        tooltipBorderRadius: 8,
      },
    };
  }, []);
}

const money = (n: number) => (Math.abs(n) >= 1000 ? `$${(Math.abs(n) / 1000).toFixed(1).replace(/\.0$/, "")}k` : `$${Math.abs(Math.round(n))}`);

/** Weekly money out of resolved cases: kept above the line, given back below it, on one signed scale. */
export function RecoveryChart({ weekly, height = 248 }: { weekly: WeekPoint[]; height?: number | string }) {
  const theme = useTheme();
  const options = useMemo<AgCartesianChartOptions>(() => {
    const data = weekly.map((w) => ({ label: w.label, recovered: w.recovered, refunded: -w.refunded, lost: -w.lost }));
    const tooltip = {
      renderer: ({ datum }: { datum: (typeof data)[number] }) => ({
        heading: `Week of ${datum.label}`,
        data: [
          { label: "Kept", value: usd(datum.recovered, 0) },
          { label: "Refunded", value: usd(-datum.refunded, 0) },
          { label: "Lost", value: usd(-datum.lost, 0) },
        ],
      }),
    };
    return {
      theme,
      data,
      background: { visible: false },
      padding: { top: 8, right: 16, bottom: 0, left: 0 },
      legend: { enabled: false },
      series: [
        { type: "bar", xKey: "label", yKey: "recovered", yName: "Kept", stackGroup: "kept", fill: CHART.green, cornerRadius: 2, tooltip },
        { type: "bar", xKey: "label", yKey: "refunded", yName: "Refunded", stackGroup: "out", fill: CHART.refund, cornerRadius: 0, tooltip },
        { type: "bar", xKey: "label", yKey: "lost", yName: "Lost", stackGroup: "out", fill: CHART.red, cornerRadius: 2, tooltip },
      ],
      axes: {
        x: {
          type: "category",
          position: "bottom",
          paddingInner: 0.42,
          paddingOuter: 0.2,
          line: { enabled: false },
          tick: { enabled: false },
          label: { color: CHART.label, fontSize: 12, avoidCollisions: true, minSpacing: 16, wrapping: "never", rotation: 0 },
          gridLine: { enabled: false },
        },
        y: {
          type: "number",
          position: "left",
          line: { enabled: false },
          tick: { enabled: false },
          label: { color: CHART.label, fontSize: 12, formatter: ({ value }: { value: number }) => (value === 0 ? "$0" : `${value < 0 ? "−" : ""}${money(value)}`) },
          gridLine: { style: [{ stroke: CHART.grid, lineDash: [] }] },
          crossLines: [{ type: "line", value: 0, stroke: CHART.base, strokeWidth: 1 }],
        },
      },
    } as AgCartesianChartOptions;
  }, [weekly, theme]);
  return <AgCharts options={options} style={{ height, width: "100%" }} />;
}

/** Rolling 30-day dispute rate in straight segments, against the card networks' monitoring line (dashed, labelled at its end). */
export function RateChart({ series, threshold, height = 140 }: { series: { label: string; rate: number }[]; threshold: number; height?: number }) {
  const theme = useTheme();
  const options = useMemo<AgCartesianChartOptions>(() => {
    const top = Math.max(2, Math.ceil(Math.max(...series.map((s) => s.rate), threshold) * 2) / 2 + 0.5);
    return {
      theme,
      data: series,
      background: { visible: false },
      padding: { top: 10, right: 16, bottom: 0, left: 0 },
      legend: { enabled: false },
      series: [
        {
          type: "line",
          xKey: "label",
          yKey: "rate",
          yName: "Dispute rate",
          stroke: CHART.ink,
          strokeWidth: 1.5,
          marker: { enabled: false },
          tooltip: { renderer: ({ datum }: { datum: { label: string; rate: number } }) => ({ heading: `30 days to ${datum.label}`, data: [{ label: "Dispute rate", value: `${datum.rate.toFixed(2)}%` }] }) },
        },
      ],
      axes: {
        x: { type: "category", position: "bottom", line: { enabled: false }, tick: { enabled: false }, label: { color: CHART.label, fontSize: 12, minSpacing: 28, wrapping: "never", rotation: 0, avoidCollisions: true }, gridLine: { enabled: false } },
        y: {
          type: "number",
          position: "left",
          min: 0,
          max: top,
          interval: { step: top > 2 ? 1 : 0.5 },
          line: { enabled: false },
          tick: { enabled: false },
          label: { color: CHART.label, fontSize: 12, formatter: ({ value }: { value: number }) => `${value}%` },
          gridLine: { style: [{ stroke: CHART.grid, lineDash: [] }] },
          crossLines: [
            {
              type: "line",
              value: threshold,
              stroke: CHART.red,
              strokeWidth: 1,
              lineDash: [4, 3],
              label: { text: `${threshold}% Visa line`, position: "inside-top-right", color: CHART.red, fontSize: 12, padding: 4 },
            },
          ],
        },
      },
    } as AgCartesianChartOptions;
  }, [series, threshold, theme]);
  return <AgCharts options={options} style={{ height, width: "100%" }} />;
}
