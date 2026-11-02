"use client";

import { AllCommunityModule, ModuleRegistry, type AgChartOptions, type AgChartTheme } from "ag-charts-community";
import { AgCharts } from "ag-charts-react";
import { useMemo } from "react";
import type { AnswerChart, ChartTone } from "@/lib/ask/schema";

ModuleRegistry.registerModules([AllCommunityModule]);

const TONE: Record<ChartTone, string> = { green: "#15803d", red: "#b91c1c", grey: "#d4d4d4", ink: "#0a0a0a", amber: "#e8a33d" };
const NEUTRALS = ["#0a0a0a", "#525252", "#a3a3a3", "#d4d4d4", "#e5e5e5", "#f0f0f0"];

/** Slice colours carry meaning when the label does (won/lost/refunded), otherwise greys. */
function sliceColor(label: string, i: number) {
  if (/recover|won|kept|buyer closed/i.test(label)) return TONE.green;
  if (/lost/i.test(label)) return TONE.red;
  if (/refund|settled/i.test(label)) return "#d4d4d4";
  return NEUTRALS[i % NEUTRALS.length];
}

export function formatValue(v: number, unit: AnswerChart["unit"], short = false) {
  if (unit === "usd") return short && Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(1).replace(/\.0$/, "")}k` : `$${Math.round(v).toLocaleString("en-US")}`;
  if (unit === "percent") return `${Math.round(v)}%`;
  if (unit === "hours") return v >= 72 && short ? `${Math.round(v / 24)}d` : `${Math.round(v)}h`;
  return Math.round(v).toLocaleString("en-US");
}

/** A tight y axis: about four steps that end just above the data, never far past it. */
export function niceAxis(maxVal: number, unit: AnswerChart["unit"]) {
  if (!(maxVal > 0)) return { max: unit === "percent" ? 100 : 1, step: unit === "percent" ? 25 : 0.25 };
  // Deadlines read in days once they pass three: whole-day steps, so every tick is exact.
  if (unit === "hours" && maxVal > 72) {
    const days = (maxVal * 1.02) / 24;
    const stepDays = [1, 2, 5, 7, 14, 30].find((d) => Math.ceil(days / d) <= 6) ?? 30;
    return { max: Math.ceil(days / stepDays) * stepDays * 24, step: stepDays * 24 };
  }
  // The smallest round step that keeps the axis to six ticks or fewer.
  const mag = 10 ** Math.floor(Math.log10(maxVal / 6));
  const step = [1, 2, 2.5, 5, 10, 20].map((m) => m * mag).find((st) => Math.ceil((maxVal * 1.02) / st) <= 6) ?? 20 * mag;
  let max = Math.ceil((maxVal * 1.02) / step) * step;
  if (unit === "percent" && maxVal <= 100) max = Math.min(max, 100);
  return { max, step };
}

function useTheme(): AgChartTheme {
  return useMemo(() => {
    const font = typeof document !== "undefined" ? getComputedStyle(document.body).fontFamily : "system-ui";
    return {
      baseTheme: "ag-default",
      params: {
        fontFamily: font,
        fontSize: 11,
        foregroundColor: "#0a0a0a",
        textColor: "#737373",
        subtleTextColor: "#a1a1a1",
        backgroundColor: "transparent",
        chartBackgroundColor: "transparent",
        gridLineColor: "#f2f2f2",
        axisLineColor: "#ebebeb",
        chartPadding: 0,
        tooltipBackgroundColor: "#0a0a0a",
        tooltipTextColor: "#ffffff",
        tooltipSubtleTextColor: "#a1a1a1",
        tooltipBorder: false,
        tooltipBorderRadius: 8,
      },
    };
  }, []);
}

export function AskChart({ chart, height = 176 }: { chart: AnswerChart; height?: number }) {
  const theme = useTheme();
  const options = useMemo<AgChartOptions>(() => {
    const unit = chart.unit;
    if (chart.type === "donut") {
      const s = chart.series[0];
      const data = chart.labels.map((label, i) => ({ label, value: s.values[i] ?? 0 })).filter((d) => d.value > 0);
      const total = data.reduce((a, d) => a + d.value, 0);
      return {
        theme,
        data,
        background: { visible: false },
        padding: { top: 4, right: 4, bottom: 4, left: 4 },
        legend: { enabled: true, position: "right", item: { marker: { shape: "circle", size: 7 }, label: { color: "#3f3f3f", fontSize: 11.5, formatter: ({ value, itemId }: { value: string; itemId?: unknown }) => { const d = data.find((x) => x.label === value) ?? data[Number(itemId)]; return d ? `${value}  ${formatValue(d.value, unit)}` : value; } } } },
        series: [
          {
            type: "donut",
            angleKey: "value",
            legendItemKey: "label",
            innerRadiusRatio: 0.7,
            fills: data.map((d, i) => sliceColor(d.label, i)),
            strokes: data.map(() => "#ffffff"),
            strokeWidth: 2,
            calloutLabel: { enabled: false },
            sectorLabel: { enabled: false },
            innerLabels: [
              { text: formatValue(total, unit, true), fontSize: 17, fontWeight: 600, color: "#0a0a0a" },
              { text: "total", fontSize: 10.5, color: "#a1a1a1", spacing: 2 },
            ],
            tooltip: { renderer: ({ datum }: { datum: { label: string; value: number } }) => ({ heading: datum.label, data: [{ label: s.name, value: `${formatValue(datum.value, unit)} · ${Math.round((datum.value / total) * 100)}%` }] }) },
          },
        ],
      } as AgChartOptions;
    }
    const data = chart.labels.map((label, i) => Object.fromEntries([["label", label], ...chart.series.map((s, j) => [`s${j}`, s.values[i] ?? 0])]));
    const multi = chart.series.length > 1;
    // Stacked bars reach the sum per label; everything else reaches its largest value.
    const peak = Math.max(0, ...chart.labels.map((_, i) => (chart.type === "bar" && chart.stacked ? chart.series.reduce((a, s) => a + Math.max(0, s.values[i] ?? 0), 0) : Math.max(...chart.series.map((s) => s.values[i] ?? 0)))));
    const floor = Math.min(0, ...chart.series.flatMap((s) => s.values));
    const axis = niceAxis(peak, unit);
    const series = chart.series.map((s, j) => {
      const color = TONE[s.tone ?? (j === 0 ? "ink" : "grey")];
      const tooltip = { renderer: ({ datum }: { datum: Record<string, number | string> }) => ({ heading: String(datum.label), data: chart.series.map((x, k) => ({ label: x.name, value: formatValue(Number(datum[`s${k}`]), unit) })) }) };
      return chart.type === "line"
        ? { type: "line", xKey: "label", yKey: `s${j}`, yName: s.name, stroke: color, strokeWidth: 1.75, interpolation: { type: "smooth" }, marker: { enabled: true, size: 5, fill: color, stroke: "#fff", strokeWidth: 1.5 }, tooltip }
        : { type: "bar", xKey: "label", yKey: `s${j}`, yName: s.name, fill: color, cornerRadius: 3, stackGroup: chart.stacked ? "all" : undefined, tooltip };
    });
    return {
      theme,
      data,
      background: { visible: false },
      padding: { top: 6, right: 4, bottom: 0, left: 0 },
      legend: { enabled: multi, position: "top", item: { marker: { shape: "square", size: 8 }, label: { color: "#737373", fontSize: 11 } } },
      series,
      axes: {
        x: {
          type: "category",
          position: "bottom",
          paddingInner: 0.38,
          paddingOuter: 0.15,
          line: { enabled: false },
          tick: { enabled: false },
          label: { color: "#a1a1a1", fontSize: 10.5, avoidCollisions: true, minSpacing: 6, wrapping: "never", rotation: 0 },
          gridLine: { enabled: false },
        },
        y: {
          type: "number",
          position: "left",
          line: { enabled: false },
          tick: { enabled: false },
          nice: false,
          min: floor < 0 ? -niceAxis(-floor, unit).max : 0,
          max: axis.max,
          interval: { step: axis.step },
          label: { color: "#a1a1a1", fontSize: 10.5, formatter: ({ value }: { value: number }) => (unit === "hours" && axis.step % 24 === 0 ? `${Math.round(value / 24)}d` : formatValue(value, unit, true)) },
          gridLine: { style: [{ stroke: "#f2f2f2", lineDash: [] }] },
        },
      },
    } as AgChartOptions;
  }, [chart, theme]);
  return <AgCharts options={options} style={{ height, width: "100%" }} />;
}
