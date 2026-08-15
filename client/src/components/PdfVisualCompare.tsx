// 設計提醒：覆核畫面維持「安靜的資料保管庫」——琥珀遮罩表示已保護內容，藍色細框只在人工編輯時提示目前焦點。

import { type PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, LoaderCircle, Pencil, Trash2 } from "lucide-react";
import { type RuleId } from "@/lib/deidentify";
import {
  createAutomaticRedactions,
  drawPdfRedactions,
  isTextItem,
  resolvePdfRedactions,
  type PdfRedaction,
} from "@/lib/pdf-redactions";

type PdfVisualCompareProps = {
  file: File;
  pageNumber: number;
  enabledRules: RuleId[];
  customTerms: string[];
  manualReviewMode: boolean;
  redactionEdits: PdfRedaction[];
  hiddenRedactionIds: string[];
  onRedactionEditsChange: (redactions: PdfRedaction[]) => void;
  onHiddenRedactionIdsChange: (ids: string[]) => void;
};

type CanvasPageState = {
  width: number;
  height: number;
  scale: number;
  automaticRedactions: PdfRedaction[];
};

type PointerSession = {
  mode: "drawing" | "moving";
  startX: number;
  startY: number;
  offsetX?: number;
  offsetY?: number;
  target?: PdfRedaction;
};

const PREVIEW_SCALE = 1.35;
const MIN_REDACTION_SIZE = 5;

function createManualId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `manual-${crypto.randomUUID()}`
    : `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function PdfVisualCompare({
  file,
  pageNumber,
  enabledRules,
  customTerms,
  manualReviewMode,
  redactionEdits,
  hiddenRedactionIds,
  onRedactionEditsChange,
  onHiddenRedactionIdsChange,
}: PdfVisualCompareProps) {
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const revisedCanvasRef = useRef<HTMLCanvasElement>(null);
  const pageStateRef = useRef<CanvasPageState | null>(null);
  const pointerSessionRef = useRef<PointerSession | null>(null);
  const redactionEditsRef = useRef(redactionEdits);
  const hiddenRedactionIdsRef = useRef(hiddenRedactionIds);
  const selectedIdRef = useRef<string | null>(null);
  const draftRef = useRef<PdfRedaction | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [notice, setNotice] = useState("");
  const [redactionCount, setRedactionCount] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PdfRedaction | null>(null);

  redactionEditsRef.current = redactionEdits;
  hiddenRedactionIdsRef.current = hiddenRedactionIds;
  selectedIdRef.current = selectedId;
  draftRef.current = draft;

  const refreshRevisedCanvas = useCallback(() => {
    const originalCanvas = originalCanvasRef.current;
    const revisedCanvas = revisedCanvasRef.current;
    const pageState = pageStateRef.current;
    if (!originalCanvas || !revisedCanvas || !pageState) return;
    const context = revisedCanvas.getContext("2d");
    if (!context) return;
    const pageEdits = redactionEditsRef.current.filter((item) => item.pageNumber === pageNumber);
    const resolved = resolvePdfRedactions(pageState.automaticRedactions, pageEdits, hiddenRedactionIdsRef.current);
    context.clearRect(0, 0, revisedCanvas.width, revisedCanvas.height);
    context.drawImage(originalCanvas, 0, 0);
    drawPdfRedactions(context, resolved, pageState.scale, selectedIdRef.current, draftRef.current);
    setRedactionCount(resolved.length);
  }, [pageNumber]);

  useEffect(() => {
    let disposed = false;
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | null = null;
    let cleanupPdf: (() => void) | null = null;

    const renderPage = async () => {
      setIsRendering(true);
      setNotice("");
      setRedactionCount(0);
      setSelectedId(null);
      setDraft(null);
      pointerSessionRef.current = null;
      pageStateRef.current = null;
      try {
        const [{ getDocument, GlobalWorkerOptions }, workerModule] = await Promise.all([
          import("pdfjs-dist"),
          import("pdfjs-dist/build/pdf.worker.mjs?url"),
        ]);
        GlobalWorkerOptions.workerSrc = workerModule.default;
        const loadingTask = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
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
        if (!originalContext) throw new Error("瀏覽器無法建立 PDF 預覽畫布。");
        const currentRenderTask = page.render({ canvasContext: originalContext, canvas: originalCanvas, viewport });
        renderTask = currentRenderTask;
        await currentRenderTask.promise;
        if (disposed) return;

        const textItems = (await page.getTextContent()).items.filter(isTextItem) as unknown as import("@/lib/pdf-redactions").TextItemLike[];
        const automaticRedactions = createAutomaticRedactions(textItems, pageNumber, viewport.height / viewport.scale, enabledRules, customTerms);
        pageStateRef.current = { width, height, scale: viewport.scale, automaticRedactions };
        if (!textItems.length) {
          setNotice("這一頁為掃描影像，原始版面已保留；請以人工覆核模式拖曳新增遮罩。 ");
        } else if (!automaticRedactions.length) {
          setNotice("本頁未發現可定位的替換內容；如有需要，可用人工覆核模式新增遮罩。 ");
        }
        refreshRevisedCanvas();
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
  }, [customTerms, enabledRules, file, pageNumber, refreshRevisedCanvas]);

  useEffect(() => {
    refreshRevisedCanvas();
  }, [draft, hiddenRedactionIds, redactionEdits, selectedId, refreshRevisedCanvas]);

  const getCurrentRedactions = () => {
    const pageState = pageStateRef.current;
    const pageEdits = redactionEditsRef.current.filter((item) => item.pageNumber === pageNumber);
    return pageState ? resolvePdfRedactions(pageState.automaticRedactions, pageEdits, hiddenRedactionIdsRef.current) : [];
  };

  const pointFromEvent = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = revisedCanvasRef.current;
    const pageState = pageStateRef.current;
    if (!canvas || !pageState) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * pageState.width) / rect.width / pageState.scale,
      y: ((event.clientY - rect.top) * pageState.height) / rect.height / pageState.scale,
    };
  };

  const clampRedaction = (redaction: PdfRedaction) => {
    const pageState = pageStateRef.current;
    if (!pageState) return redaction;
    const pageWidth = pageState.width / pageState.scale;
    const pageHeight = pageState.height / pageState.scale;
    return {
      ...redaction,
      x: Math.max(0, Math.min(redaction.x, Math.max(0, pageWidth - redaction.width))),
      y: Math.max(0, Math.min(redaction.y, Math.max(0, pageHeight - redaction.height))),
    };
  };

  const deleteSelectedRedaction = () => {
    const selected = getCurrentRedactions().find((item) => item.id === selectedIdRef.current);
    if (!selected) return;
    if (selected.origin === "automatic") {
      onHiddenRedactionIdsChange(Array.from(new Set([...hiddenRedactionIdsRef.current, selected.id])));
      onRedactionEditsChange(redactionEditsRef.current.filter((item) => item.id !== selected.id));
    } else {
      onRedactionEditsChange(redactionEditsRef.current.filter((item) => item.id !== selected.id));
    }
    setSelectedId(null);
    setDraft(null);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!manualReviewMode || !selectedIdRef.current || target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelectedRedaction();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!manualReviewMode || isRendering) return;
    const point = pointFromEvent(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const hit = [...getCurrentRedactions()].reverse().find((item) => point.x >= item.x && point.x <= item.x + item.width && point.y >= item.y && point.y <= item.y + item.height);
    if (hit) {
      setSelectedId(hit.id);
      pointerSessionRef.current = { mode: "moving", startX: point.x, startY: point.y, offsetX: point.x - hit.x, offsetY: point.y - hit.y, target: hit };
      return;
    }
    setSelectedId(null);
    pointerSessionRef.current = { mode: "drawing", startX: point.x, startY: point.y };
    setDraft({ id: "draft", pageNumber, x: point.x, y: point.y, width: 0, height: 0, label: "手動遮罩", origin: "manual" });
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const session = pointerSessionRef.current;
    if (!manualReviewMode || !session) return;
    const point = pointFromEvent(event);
    if (!point) return;
    if (session.mode === "drawing") {
      setDraft({ id: "draft", pageNumber, x: Math.min(session.startX, point.x), y: Math.min(session.startY, point.y), width: Math.abs(point.x - session.startX), height: Math.abs(point.y - session.startY), label: "手動遮罩", origin: "manual" });
    } else if (session.target) {
      setDraft(clampRedaction({ ...session.target, x: point.x - (session.offsetX ?? 0), y: point.y - (session.offsetY ?? 0) }));
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    const session = pointerSessionRef.current;
    if (!manualReviewMode || !session) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const nextDraft = draftRef.current;
    if (session.mode === "drawing" && nextDraft && nextDraft.width >= MIN_REDACTION_SIZE && nextDraft.height >= MIN_REDACTION_SIZE) {
      const next = { ...nextDraft, id: createManualId() };
      onRedactionEditsChange([...redactionEditsRef.current, next]);
      setSelectedId(next.id);
    }
    if (session.mode === "moving" && nextDraft && session.target) {
      onRedactionEditsChange([...redactionEditsRef.current.filter((item) => item.id !== session.target?.id), nextDraft]);
      setSelectedId(nextDraft.id);
    }
    pointerSessionRef.current = null;
    setDraft(null);
  };

  const selectedRedaction = getCurrentRedactions().find((item) => item.id === selectedId);

  return (
    <section className={`pdf-visual-compare ${manualReviewMode ? "pdf-visual-compare--editing" : ""}`} aria-label={`PDF 第 ${pageNumber} 頁原始與去識別化後的視覺比較`}>
      {isRendering && <div className="pdf-visual-compare__loading" role="status" aria-live="polite"><LoaderCircle className="spin" size={17} /> 正在本機渲染第 {pageNumber} 頁…</div>}
      {manualReviewMode && <div className="pdf-visual-compare__review-hint" role="status"><span><Pencil size={14} /> 人工覆核：在右側頁面拖曳可新增遮罩；拖曳既有遮罩可移動。</span>{selectedRedaction && <button type="button" onClick={deleteSelectedRedaction}><Trash2 size={13} /> 刪除選取遮罩</button>}</div>}
      <div className="pdf-visual-compare__grid" aria-busy={isRendering}>
        <figure className="pdf-page-sheet">
          <figcaption><Eye size={14} /> 去識別化前</figcaption>
          <canvas ref={originalCanvasRef} />
        </figure>
        <figure className="pdf-page-sheet pdf-page-sheet--revised">
          <figcaption><EyeOff size={14} /> 去識別化後 {redactionCount > 0 && <span>{redactionCount} 處遮罩</span>}</figcaption>
          <canvas ref={revisedCanvasRef} tabIndex={manualReviewMode ? 0 : -1} role="img" aria-label={manualReviewMode ? "可人工覆核的去識別化 PDF 頁面" : "去識別化 PDF 頁面"} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} />
        </figure>
      </div>
      {notice && <p className="pdf-visual-compare__notice">{notice.trim()}</p>}
    </section>
  );
}
