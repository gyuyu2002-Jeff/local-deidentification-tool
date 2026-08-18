import { describe, expect, it } from "vitest";
import {
  createAutomaticRedactions,
  createPdfReviewHistory,
  recordPdfReviewState,
  redoPdfReviewHistory,
  resizePdfRedaction,
  resolvePdfRedactions,
  undoPdfReviewHistory,
  type PdfRedaction,
} from "./pdf-redactions";

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
    expect(redactions[0]).toMatchObject({ pageNumber: 1, x: 8, y: 66, width: 165, height: 17, origin: "automatic", color: "blue", label: "" });
  });

  it("會將被拆成欄位標籤與欄位值的公司及聯絡人文字完整遮罩", () => {
    const redactions = createAutomaticRedactions([
      { str: "分公司名稱", transform: [1, 0, 0, 12, 10, 120], width: 48, height: 12 },
      { str: "互盛股份有限公司 桃園通訊", transform: [1, 0, 0, 12, 70, 120], width: 132, height: 12 },
      { str: "聯絡人", transform: [1, 0, 0, 12, 10, 96], width: 36, height: 12 },
      { str: "吳美麗", transform: [1, 0, 0, 12, 70, 96], width: 36, height: 12 },
    ], 1, 200, ["companyName", "contactName"], []);

    expect(redactions).toHaveLength(2);
    expect(redactions[0]).toMatchObject({ x: 8, y: 66, width: 197, height: 17, origin: "automatic" });
    expect(redactions[1]).toMatchObject({ x: 8, y: 90, width: 101, height: 17, origin: "automatic" });
  });

  it("會用人工調整覆寫同一個自動遮罩，並保留新畫出的遮罩", () => {
    const adjusted = { ...automatic, x: 16, y: 62, width: 86, height: 20 };
    const manual = { id: "manual-1", pageNumber: 1, x: 110, y: 80, width: 44, height: 18, label: "", origin: "manual" as const, color: "red" as const };

    expect(resolvePdfRedactions([automatic], [adjusted, manual], [])).toEqual([adjusted, manual]);
  });

  it("會在人工刪除自動遮罩後排除該位置", () => {
    expect(resolvePdfRedactions([automatic], [], [automatic.id])).toEqual([]);
  });

  it("會由縮放控制點限制遮罩在頁面內，且保留最小尺寸", () => {
    const resized = resizePdfRedaction(automatic, "nw", { x: 76, y: 70 }, { width: 120, height: 160 }, 8);
    expect(resized).toMatchObject({ x: 72, y: 64, width: 8, height: 8 });
  });

  it("會保存遮罩工作階段歷程，並可復原、重做與在復原後截斷舊分支", () => {
    const initial = { redactionEdits: [], hiddenRedactionIds: [] };
    const moved = { redactionEdits: [{ ...automatic, x: 20 }], hiddenRedactionIds: [] };
    const hidden = { redactionEdits: [{ ...automatic, x: 20 }], hiddenRedactionIds: [automatic.id] };
    const history = recordPdfReviewState(recordPdfReviewState(createPdfReviewHistory(initial), moved), hidden);
    expect(undoPdfReviewHistory(history).entries[1]).toEqual(moved);
    expect(redoPdfReviewHistory(undoPdfReviewHistory(history)).entries[2]).toEqual(hidden);
    const forked = recordPdfReviewState(undoPdfReviewHistory(history), initial);
    expect(forked).toMatchObject({ index: 2 });
    expect(forked.entries).toHaveLength(3);
    expect(forked.entries[2]).toEqual(initial);
  });
});
