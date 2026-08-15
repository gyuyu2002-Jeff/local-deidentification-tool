// 設計提醒：此元件延續「安靜的資料保管庫」；保留原始頁面版面，將去識別化差異以克制的琥珀遮罩表達，而不是重新排版成一般文字卡。

import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { deidentifyText, type RuleId } from "@/lib/deidentify";

type PdfVisualCompareProps = {
  file: File;
  pageNumber: number;
  enabledRules: RuleId[];
  customTerms: string[];
};

type TextItemLike = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};

const PREVIEW_SCALE = 1.35;

function isTextItem(item: unknown): item is TextItemLike {
  return typeof item === "object" && item !== null && "str" in item && "transform" in item && "width" in item && "height" in item;
}

function drawRedactionLayer(
  context: CanvasRenderingContext2D,
  items: TextItemLike[],
  viewport: { height: number; scale: number },
  enabledRules: RuleId[],
  customTerms: string[],
) {
  let redactionCount = 0;
  context.save();
  context.textBaseline = "middle";

  for (const item of items) {
    if (!item.str.trim()) continue;
    const revised = deidentifyText(item.str, enabledRules, customTerms);
    if (!revised.total) continue;

    const [,, , , rawX, rawY] = item.transform;
    const x = rawX * viewport.scale;
    const itemHeight = Math.max(10, Math.abs(item.height || item.transform[3] || 10) * viewport.scale);
    const y = viewport.height - rawY * viewport.scale - itemHeight;
    const width = Math.max(28, item.width * viewport.scale + 5);
    const height = Math.max(16, itemHeight + 5);
    const label = revised.text.replace(/\[[A-Z_]+\]/g, "隱去").slice(0, 16);

    context.fillStyle = "rgba(200, 148, 62, 0.93)";
    context.fillRect(x - 2, y - 2, width, height);
    context.fillStyle = "#20332b";
    context.font = `${Math.max(8, Math.min(12, height * 0.56))}px "Noto Sans TC", "Microsoft JhengHei", sans-serif`;
    context.fillText(label || "隱去", x + 3, y + height / 2 + 0.5, Math.max(10, width - 6));
    redactionCount += revised.total;
  }

  context.restore();
  return redactionCount;
}

export default function PdfVisualCompare({ file, pageNumber, enabledRules, customTerms }: PdfVisualCompareProps) {
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const revisedCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [notice, setNotice] = useState("");
  const [redactionCount, setRedactionCount] = useState(0);

  useEffect(() => {
    let disposed = false;
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | null = null;
    let cleanupPdf: (() => void) | null = null;

    const renderPage = async () => {
      setIsRendering(true);
      setNotice("");
      setRedactionCount(0);
      try {
        const [{ getDocument, GlobalWorkerOptions }, workerModule] = await Promise.all([
          import("pdfjs-dist"),
          import("pdfjs-dist/build/pdf.worker.mjs?url"),
        ]);
        GlobalWorkerOptions.workerSrc = workerModule.default;
        const bytes = new Uint8Array(await file.arrayBuffer());
        const loadingTask = getDocument({ data: bytes });
        const pdf = await loadingTask.promise;
        cleanupPdf = () => pdf.cleanup();
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: PREVIEW_SCALE });
        const originalCanvas = originalCanvasRef.current;
        const revisedCanvas = revisedCanvasRef.current;
        if (!originalCanvas || !revisedCanvas || disposed) return;

        const width = Math.ceil(viewport.width);
        const height = Math.ceil(viewport.height);
        for (const canvas of [originalCanvas, revisedCanvas]) {
          canvas.width = width;
          canvas.height = height;
          canvas.style.aspectRatio = `${width} / ${height}`;
        }

        const originalContext = originalCanvas.getContext("2d");
        const revisedContext = revisedCanvas.getContext("2d");
        if (!originalContext || !revisedContext) throw new Error("瀏覽器無法建立 PDF 預覽畫布。");

        const currentRenderTask = page.render({ canvasContext: originalContext, canvas: originalCanvas, viewport });
        renderTask = currentRenderTask;
        await currentRenderTask.promise;
        if (disposed) return;

        revisedContext.drawImage(originalCanvas, 0, 0);
        const content = await page.getTextContent();
        const textItems = content.items.filter(isTextItem) as unknown as TextItemLike[];
        if (!textItems.length) {
          revisedContext.fillStyle = "rgba(32, 51, 43, 0.84)";
          revisedContext.fillRect(0, 0, width, 42);
          revisedContext.fillStyle = "#f7f3eb";
          revisedContext.font = '12px "Noto Sans TC", sans-serif';
          revisedContext.fillText("掃描影像頁：已本機 OCR；請搭配文字差異檢視人工覆核。", 14, 26);
          setNotice("這一頁為掃描影像，原始版面已保留；目前遮罩定位需人工覆核 OCR 文字。 ");
        } else {
          const count = drawRedactionLayer(revisedContext, textItems, viewport, enabledRules, customTerms);
          setRedactionCount(count);
          if (!count) setNotice("本頁未發現可定位的替換內容。可切換其他頁面或查看文字差異。 ");
        }
      } catch (error) {
        if (!disposed) setNotice(error instanceof Error ? error.message : "PDF 預覽載入失敗，請重新開啟視窗後再試一次。 ");
      } finally {
        if (!disposed) setIsRendering(false);
      }
    };

    void renderPage();
    return () => {
      disposed = true;
      renderTask?.cancel();
      cleanupPdf?.();
    };
  }, [customTerms, enabledRules, file, pageNumber]);

  return (
    <section className="pdf-visual-compare" aria-label={`PDF 第 ${pageNumber} 頁原始與去識別化後的視覺比較`}>
      {isRendering && <div className="pdf-visual-compare__loading" role="status" aria-live="polite"><LoaderCircle className="spin" size={17} /> 正在本機渲染第 {pageNumber} 頁…</div>}
      <div className="pdf-visual-compare__grid" aria-busy={isRendering}>
        <figure className="pdf-page-sheet">
          <figcaption><Eye size={14} /> 去識別化前</figcaption>
          <canvas ref={originalCanvasRef} />
        </figure>
        <figure className="pdf-page-sheet pdf-page-sheet--revised">
          <figcaption><EyeOff size={14} /> 去識別化後 {redactionCount > 0 && <span>{redactionCount} 處遮罩</span>}</figcaption>
          <canvas ref={revisedCanvasRef} />
        </figure>
      </div>
      {notice && <p className="pdf-visual-compare__notice">{notice.trim()}</p>}
    </section>
  );
}
