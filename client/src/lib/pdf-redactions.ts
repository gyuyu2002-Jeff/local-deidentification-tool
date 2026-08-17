// 設計提醒：PDF 遮罩資料只存在於瀏覽器工作階段；使用穩定、可匯出的 PDF 座標，讓覆核畫面與下載結果一致。

import { deidentifyText, type RuleId } from "./deidentify";

export type TextItemLike = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};

export type PdfRedactionColor = "blue" | "red" | "black";

export const DEFAULT_PDF_REDACTION_COLOR: PdfRedactionColor = "blue";

export const PDF_REDACTION_COLORS: Record<PdfRedactionColor, string> = {
  blue: "#2f5b93",
  red: "#b54843",
  black: "#101613",
};

export type PdfRedaction = {
  id: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  origin: "automatic" | "manual";
  color?: PdfRedactionColor;
};

export type PdfReviewState = {
  redactionEdits: PdfRedaction[];
  hiddenRedactionIds: string[];
};

export type PdfReviewHistory = {
  entries: PdfReviewState[];
  index: number;
};

export type PdfRedactionResizeHandle = "nw" | "ne" | "se" | "sw";

export type PdfPageBounds = {
  width: number;
  height: number;
};

export const EMPTY_PDF_REVIEW_STATE: PdfReviewState = {
  redactionEdits: [],
  hiddenRedactionIds: [],
};

function clonePdfReviewState(state: PdfReviewState): PdfReviewState {
  return {
    redactionEdits: state.redactionEdits.map((item) => ({ ...item })),
    hiddenRedactionIds: [...state.hiddenRedactionIds],
  };
}

function samePdfReviewState(left: PdfReviewState, right: PdfReviewState) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function createPdfReviewHistory(initialState: PdfReviewState = EMPTY_PDF_REVIEW_STATE): PdfReviewHistory {
  return { entries: [clonePdfReviewState(initialState)], index: 0 };
}

export function recordPdfReviewState(history: PdfReviewHistory, nextState: PdfReviewState): PdfReviewHistory {
  const current = history.entries[history.index];
  if (samePdfReviewState(current, nextState)) return history;
  return {
    entries: [...history.entries.slice(0, history.index + 1), clonePdfReviewState(nextState)],
    index: history.index + 1,
  };
}

export function undoPdfReviewHistory(history: PdfReviewHistory): PdfReviewHistory {
  return history.index > 0 ? { ...history, index: history.index - 1 } : history;
}

export function redoPdfReviewHistory(history: PdfReviewHistory): PdfReviewHistory {
  return history.index < history.entries.length - 1 ? { ...history, index: history.index + 1 } : history;
}

export function resizePdfRedaction(
  redaction: PdfRedaction,
  handle: PdfRedactionResizeHandle,
  point: { x: number; y: number },
  bounds: PdfPageBounds,
  minimumSize = 5,
): PdfRedaction {
  const right = redaction.x + redaction.width;
  const bottom = redaction.y + redaction.height;
  const clamp = (value: number, lower: number, upper: number) => Math.max(lower, Math.min(value, Math.max(lower, upper)));

  if (handle === "nw") {
    const x = clamp(point.x, 0, right - minimumSize);
    const y = clamp(point.y, 0, bottom - minimumSize);
    return { ...redaction, x, y, width: right - x, height: bottom - y };
  }
  if (handle === "ne") {
    const x = clamp(point.x, redaction.x + minimumSize, bounds.width);
    const y = clamp(point.y, 0, bottom - minimumSize);
    return { ...redaction, y, width: x - redaction.x, height: bottom - y };
  }
  if (handle === "sw") {
    const x = clamp(point.x, 0, right - minimumSize);
    const y = clamp(point.y, redaction.y + minimumSize, bounds.height);
    return { ...redaction, x, width: right - x, height: y - redaction.y };
  }
  const x = clamp(point.x, redaction.x + minimumSize, bounds.width);
  const y = clamp(point.y, redaction.y + minimumSize, bounds.height);
  return { ...redaction, width: x - redaction.x, height: y - redaction.y };
}

export function isTextItem(item: unknown): item is TextItemLike {
  return typeof item === "object" && item !== null && "str" in item && "transform" in item && "width" in item && "height" in item;
}

export function createAutomaticRedactions(
  items: TextItemLike[],
  pageNumber: number,
  pageHeight: number,
  enabledRules: RuleId[],
  customTerms: string[],
  color: PdfRedactionColor = DEFAULT_PDF_REDACTION_COLOR,
) {
  const redactions: PdfRedaction[] = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item.str.trim()) continue;
    const revised = deidentifyText(item.str, enabledRules, customTerms);
    if (!revised.total) continue;

    const [, , , , rawX, rawY] = item.transform;
    const itemHeight = Math.max(10, Math.abs(item.height || item.transform[3] || 10));
    const width = Math.max(28, item.width + 5);
    const height = Math.max(16, itemHeight + 5);
    const label = "";
    redactions.push({
      id: `automatic-${pageNumber}-${index}-${Math.round(rawX * 10)}-${Math.round(rawY * 10)}`,
      pageNumber,
      x: rawX - 2,
      y: pageHeight - rawY - itemHeight - 2,
      width,
      height,
      label,
      origin: "automatic",
      color,
    });
  }

  return redactions;
}

export function resolvePdfRedactions(
  automaticRedactions: PdfRedaction[],
  edits: PdfRedaction[],
  hiddenRedactionIds: string[],
) {
  const hidden = new Set(hiddenRedactionIds);
  const adjustments = new Map(edits.filter((item) => item.origin === "automatic").map((item) => [item.id, item]));
  const resolvedAutomatic = automaticRedactions
    .filter((item) => !hidden.has(item.id))
    .map((item) => adjustments.get(item.id) ?? item);
  const manual = edits.filter((item) => item.origin === "manual");
  return [...resolvedAutomatic, ...manual];
}

export function drawPdfRedactions(
  context: CanvasRenderingContext2D,
  redactions: PdfRedaction[],
  scale: number,
  selectedId?: string | null,
  draft?: PdfRedaction | null,
) {
  context.save();

  for (const redaction of [...redactions, ...(draft ? [draft] : [])]) {
    const x = redaction.x * scale;
    const y = redaction.y * scale;
    const width = redaction.width * scale;
    const height = redaction.height * scale;
    const isDraft = draft?.id === redaction.id;
    const isSelected = selectedId === redaction.id;

    context.fillStyle = PDF_REDACTION_COLORS[redaction.color ?? DEFAULT_PDF_REDACTION_COLOR];
    context.fillRect(x, y, width, height);
    if (isSelected || isDraft) {
      context.strokeStyle = "#3a77a8";
      context.lineWidth = Math.max(1.5, 2 * scale);
      context.strokeRect(x - scale, y - scale, width + 2 * scale, height + 2 * scale);
    }
    if (isSelected && !isDraft) {
      const handleSize = Math.max(5, 6 * scale);
      const half = handleSize / 2;
      context.fillStyle = "#f7f3eb";
      context.strokeStyle = "#3a77a8";
      context.lineWidth = Math.max(1, 1.25 * scale);
      for (const [handleX, handleY] of [[x, y], [x + width, y], [x + width, y + height], [x, y + height]]) {
        context.fillRect(handleX - half, handleY - half, handleSize, handleSize);
        context.strokeRect(handleX - half, handleY - half, handleSize, handleSize);
      }
    }
  }

  context.restore();
}
