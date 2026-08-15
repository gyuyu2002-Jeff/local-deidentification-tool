import { describe, expect, it } from "vitest";
import { createAutomaticRedactions, resolvePdfRedactions, type PdfRedaction } from "./pdf-redactions";

describe("PDF 覆核遮罩資料模型", () => {
  const automatic: PdfRedaction = {
    id: "automatic-1-0-100-200",
    pageNumber: 1,
    x: 8,
    y: 54,
    width: 72,
    height: 18,
    label: "隱去",
    origin: "automatic",
  };

  it("會依 PDF 文字項目建立可重現的自動遮罩座標", () => {
    const redactions = createAutomaticRedactions([
      { str: "聯絡信箱 ming.wang@example.com", transform: [1, 0, 0, 12, 10, 120], width: 160, height: 12 },
    ], 1, 200, ["email"], []);

    expect(redactions).toHaveLength(1);
    expect(redactions[0]).toMatchObject({ pageNumber: 1, x: 8, y: 66, width: 165, height: 17, origin: "automatic" });
  });

  it("會用人工調整覆寫同一個自動遮罩，並保留新畫出的遮罩", () => {
    const adjusted = { ...automatic, x: 16, y: 62, width: 86, height: 20 };
    const manual = { id: "manual-1", pageNumber: 1, x: 110, y: 80, width: 44, height: 18, label: "手動遮罩", origin: "manual" as const };

    expect(resolvePdfRedactions([automatic], [adjusted, manual], [])).toEqual([adjusted, manual]);
  });

  it("會在人工刪除自動遮罩後排除該位置", () => {
    expect(resolvePdfRedactions([automatic], [], [automatic.id])).toEqual([]);
  });
});
