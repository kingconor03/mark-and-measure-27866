import { useState, useEffect } from "react";

export interface FootingColors {
  "SF1": string;
  "SF2": string;
  "Pad Footing": string;
  "Strip Footing": string;
  "Custom Type...": string;
}

const DEFAULT_FOOTING_COLORS: FootingColors = {
  "SF1": "#0ea5e9", // Sky blue
  "SF2": "#8b5cf6", // Purple
  "Pad Footing": "#ec4899", // Pink
  "Strip Footing": "#f97316", // Orange
  "Custom Type...": "#64748b", // Slate
};

export function useFootingColors(): [FootingColors, (colors: FootingColors) => void] {
  const [footingColors, setFootingColors] = useState<FootingColors>(() => {
    const saved = localStorage.getItem("footingColors");
    return saved ? JSON.parse(saved) : DEFAULT_FOOTING_COLORS;
  });

  useEffect(() => {
    localStorage.setItem("footingColors", JSON.stringify(footingColors));
  }, [footingColors]);

  return [footingColors, setFootingColors];
}
