"use client";

import { useSyncExternalStore } from "react";

// Validated default palette (see dataviz skill references/palette.md)
export const palette = {
  light: {
    surface: "#fcfcfb",
    primaryInk: "#0b0b0b",
    secondaryInk: "#52514e",
    mutedInk: "#898781",
    gridline: "#e1e0d9",
    axis: "#c3c2b7",
    series1: "#2a78d6", // blue
    series2: "#eb6834", // orange
    series3: "#1baf7a", // aqua
    good: "#0ca30c",
    critical: "#d03b3b",
  },
  dark: {
    surface: "#1a1a19",
    primaryInk: "#ffffff",
    secondaryInk: "#c3c2b7",
    mutedInk: "#898781",
    gridline: "#2c2c2a",
    axis: "#383835",
    series1: "#3987e5",
    series2: "#d95926",
    series3: "#199e70",
    good: "#0ca30c",
    critical: "#e66767",
  },
} as const;

function subscribe(callback: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getSnapshot(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getServerSnapshot(): "light" | "dark" {
  return "light";
}

export function useChartTheme() {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return palette[mode];
}
