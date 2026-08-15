// 設計提醒：PDF 遮罩資料只存在於瀏覽器工作階段；使用穩定、可匯出的 PDF 座標，讓覆核畫面與下載結果一致。

import { deidentifyText, type RuleId } from "./deidentify";

export type TextItemLike = {
  str: string;
  transform: number[];
  width: number;
  height: number;
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
};

export function isTextItem(item: unknown): item is TextItemLike {
  return typeof item === "object" && item !== null && "str" in item && "transform" in item && "width" in item && "height" in item;
}

export function createAutomaticRedactions(
  items: TextItemLike[],
  pageNumber: number,
  pageHeight: number,
  enabledRules: RuleId[],
  customTerms: string[],
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
    const label = revised.text.replace(/\[[A-Z_]+\]/g, "隱去").slice(0, 16) || "隱去";
    redactions.push({
      id: `automatic-${pageNumber}-${index}-${Math.round(rawX * 10)}-${Math.round(rawY * 10)}`,
      pageNumber,
      x: rawX - 2,
      y: pageHeight - rawY - itemHeight - 2,
      width,
      height,
      label,
      origin: "automatic",
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
  context.textBaseline = "middle";

  for (const redaction of [...redactions, ...(draft ? [draft] : [])]) {
    const x = redaction.x * scale;
    const y = redaction.y * scale;
    const width = redaction.width * scale;
    const height = redaction.height * scale;
    const isDraft = draft?.id === redaction.id;
    const isSelected = selectedId === redaction.id;

    context.fillStyle = isDraft ? "rgba(200, 148, 62, 0.56)" : "rgba(200, 148, 62, 0.93)";
    context.fillRect(x, y, width, height);
    if (isSelected || isDraft) {
      context.strokeStyle = "#3a77a8";
      context.lineWidth = Math.max(1.5, 2 * scale);
      context.strokeRect(x - scale, y - scale, width + 2 * scale, height + 2 * scale);
    }
    if (!isDraft && width >= 28 * scale && height >= 15 * scale) {
      context.fillStyle = "#20332b";
      context.font = `${Math.max(8, Math.min(12, height * 0.56))}px "Noto Sans TC", "Microsoft JhengHei", sans-serif`;
      context.fillText(redaction.label || "隱去", x + 5 * scale, y + height / 2 + 0.5, Math.max(10, width - 10 * scale));
    }
  }

  context.restore();
}
