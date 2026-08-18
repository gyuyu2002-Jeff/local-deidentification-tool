/* Design philosophy: reading preferences support the quiet archival workspace without changing its restrained visual hierarchy. */

import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

export type ReadingMode = "standard" | "comfortable" | "large";

type ReadingModeContextValue = {
  readingMode: ReadingMode;
  setReadingMode: (mode: ReadingMode) => void;
};

const READING_MODE_STORAGE_KEY = "unconscious-reading-mode";
const ReadingModeContext = createContext<ReadingModeContextValue | null>(null);

function getStoredReadingMode(): ReadingMode {
  if (typeof window === "undefined") return "standard";
  const stored = window.localStorage.getItem(READING_MODE_STORAGE_KEY);
  return stored === "comfortable" || stored === "large" || stored === "standard" ? stored : "standard";
}

export function ReadingModeProvider({ children }: { children: ReactNode }) {
  const [readingMode, setReadingMode] = useState<ReadingMode>(getStoredReadingMode);

  useEffect(() => {
    document.documentElement.dataset.readingMode = readingMode;
    window.localStorage.setItem(READING_MODE_STORAGE_KEY, readingMode);
  }, [readingMode]);

  return <ReadingModeContext.Provider value={{ readingMode, setReadingMode }}>{children}</ReadingModeContext.Provider>;
}

export function useReadingMode() {
  const context = useContext(ReadingModeContext);
  if (!context) throw new Error("useReadingMode 必須在 ReadingModeProvider 內使用。");
  return context;
}
