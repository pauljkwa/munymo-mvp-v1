import React, { createContext, useContext, useEffect, useState } from "react";

export type TextSize = "small" | "medium" | "large";

/**
 * Root font-size percentages. Percent (not px) so the scale stays relative to
 * whatever default font size the reader has configured in their own browser —
 * someone running a 20px browser default keeps that, scaled by their choice.
 *
 * "small" is the site's original look; "medium" is the default. Every text,
 * spacing and radius token in the app is rem-based, so moving the root scales
 * the layout proportionally rather than just inflating text into its gutters.
 *
 * Keep in sync with the pre-paint script in client/index.html.
 */
const ROOT_FONT_SIZE: Record<TextSize, string> = {
  small: "100%",
  medium: "112.5%",
  large: "125%",
};

export const TEXT_SIZE_ORDER: TextSize[] = ["small", "medium", "large"];

const STORAGE_KEY = "munymo-text-size";
const DEFAULT_SIZE: TextSize = "medium";

interface TextSizeContextType {
  textSize: TextSize;
  setTextSize: (size: TextSize) => void;
}

const TextSizeContext = createContext<TextSizeContextType | undefined>(undefined);

function readStoredSize(): TextSize {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in ROOT_FONT_SIZE) return stored as TextSize;
  } catch {
    // Private-mode / blocked storage: fall through to the default.
  }
  return DEFAULT_SIZE;
}

export function TextSizeProvider({ children }: { children: React.ReactNode }) {
  const [textSize, setTextSize] = useState<TextSize>(readStoredSize);

  useEffect(() => {
    document.documentElement.style.fontSize = ROOT_FONT_SIZE[textSize];
    try {
      localStorage.setItem(STORAGE_KEY, textSize);
    } catch {
      // Non-fatal: the size still applies for this session.
    }
  }, [textSize]);

  return (
    <TextSizeContext.Provider value={{ textSize, setTextSize }}>
      {children}
    </TextSizeContext.Provider>
  );
}

export function useTextSize() {
  const context = useContext(TextSizeContext);
  if (!context) {
    throw new Error("useTextSize must be used within TextSizeProvider");
  }
  return context;
}
