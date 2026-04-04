"use client";

import { useState, useEffect } from "react";

export const CHART_COLORS = [
  "#1e40af", // blue   (primary)
  "#0d9488", // teal   (secondary)
  "#d97706", // amber  (accent)
  "#7c3aed", // violet
  "#db2777", // pink
  "#059669", // emerald
  "#0284c7", // sky
  "#dc2626", // red
  "#9333ea", // purple
  "#16a34a", // green
  "#b45309", // dark amber
] as const;

export interface ChartTheme {
  isDark: boolean;
  gridColor: string;
  textColor: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
}

/**
 * Tracks the current dark/light mode in real-time.
 * Listens for `.dark` class changes on <html> caused by the theme toggle.
 */
export function useChartTheme(): ChartTheme {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const check = () =>
      setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);

  return {
    isDark,
    gridColor:     isDark ? "#1f2937" : "#f1f5f9",
    textColor:     isDark ? "#9ca3af" : "#6b7280",
    tooltipBg:     isDark ? "#1e293b" : "#ffffff",
    tooltipBorder: isDark ? "#334155" : "#e2e8f0",
    tooltipText:   isDark ? "#f1f5f9" : "#111827",
  };
}
