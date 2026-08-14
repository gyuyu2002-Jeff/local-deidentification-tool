// 設計提醒：文件處理、OCR 與匯出均在瀏覽器記憶體完成；取消訊號會終止目前的 PDF 工作並釋放資源。

import { createPdfOcrWorker, recognizePdfPage, type PdfOcrWorker } from "./ocr";

export type SupportedDocumentType = "xlsx" | "docx" | "pdf" | "text";

export type DocumentParseProgress = {
  phase: "preparing" | "reading" | "rendering" | "ocr" | "complete" | "cancelled";
  currentPage: number;
  totalPages: number;
  percent: number;
  message: string;
  detail: string;
};

export type ParsedDocument = {
  text: string;
  fileName: string;
  fileType: SupportedDocumentType;
  pageCount?: number;
  ocrPageCount?: number;
  sheetCount?: number;
  warnings: string[];
};

export type DocumentParseOptions = {
  onProgress?: (progress: DocumentParseProgress) => void;
  signal?: AbortSignal;
};

export class DocumentParseCancelledError extends Error {
  constructor() {
    super("已取消本機文件解析。");
    this.name = "DocumentParseCancelledError";
  }
}

function ensureNotCancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new DocumentParseCancelledError();
}

function detectType(file: File): SupportedDocumentType | null {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "xlsx" || extension === "xls" || file.type.includes("spreadsheet")) return "xlsx";
  if (extension === "docx" || file.type.includes("wordprocessingml")) return "docx";
  if (extension === "pdf" || file.type === "application/pdf") return "pdf";
  if (extension === "txt" || extension === "csv" || extension === "json" || file.type.startsWith("text/")) return "text";
  return null;
}

function joinRows(rows: unknown[][]) {
  return rows
    .map((row) => row.map((cell) => String(cell ?? "").trim()).join("\t").trimEnd())
    .filter((row) => row.length > 0)
    .join("\n");
}

async function parseSpreadsheet(file: File): Promise<ParsedDocument> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sections = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });
    const body = joinRows(rows);
    return `【工作表：${sheetName}】${body ? `\n${body}` : ""}`;
  });

  return {
    text: sections.join("\n\n"),
    fileName: file.name,
    fileType: "xlsx",
    sheetCount: workbook.SheetNames.length,
    warnings: ["Excel 將以純文字方式解析儲存格內容；公式會以目前儲存值呈現。"],
  };
}

async function parseWord(file: File): Promise<ParsedDocument> {
  const mammothModule = await import("mammoth");
  const mammoth = mammothModule.default ?? mammothModule;
  const buffer = await file.arrayBuffer();
  const extracted = await mammoth.extractRawText({ arrayBuffer: buffer });
  const warnings = extracted.messages.length > 0
    ? ["Word 中有部分版面或物件未轉換為純文字，請在差異檢視中確認結果。"]
    : [];

  return {
    text: extracted.value.trim(),
    fileName: file.name,
    fileType: "docx",
    warnings,
  };
}

async function parsePdf(file: File, options: DocumentParseOptions = {}): Promise<ParsedDocument> {
  const [{ getDocument, GlobalWorkerOptions }, workerModule] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.mjs?url"),
  ]);
  GlobalWorkerOptions.workerSrc = workerModule.default;
  const buffer = await file.arrayBuffer();
  const loadingTask = getDocument({ data: new Uint8Array(buffer) });
  const abortLoading = () => { void loadingTask.destroy(); };
  options.signal?.addEventListener("abort", abortLoading, { once: true });

  const pages: string[] = [];
  const pagesWithoutText: number[] = [];
  let ocrPageCount = 0;
  let ocrWorker: PdfOcrWorker | null = null;
  let ocrTerminated = false;
  let pdf: Awaited<typeof loadingTask.promise> | null = null;
  let totalPages = 0;
  let activeOcrPage = 0;
  const report = (progress: Omit<DocumentParseProgress, "totalPages">) => options.onProgress?.({ ...progress, totalPages });
  const terminateOcrWorker = async () => {
    if (ocrWorker && !ocrTerminated) {
      ocrTerminated = true;
      await ocrWorker.terminate();
    }
  };
  const abortOcr = () => { void terminateOcrWorker(); };

  try {
    ensureNotCancelled(options.signal);
    pdf = await loadingTask.promise;
    totalPages = pdf.numPages;
    report({ phase: "reading", currentPage: 0, percent: 0, message: "PDF 已載入，正在檢查文字層", detail: `共 ${totalPages} 頁；有文字的頁面會直接解析，掃描頁才會啟用 OCR。` });
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      ensureNotCancelled(options.signal);
      report({ phase: "reading", currentPage: pageNumber, percent: Math.round(((pageNumber - 1) / totalPages) * 100), message: "正在讀取 PDF 文字層", detail: `正在檢查第 ${pageNumber} / ${totalPages} 頁是否包含可選取文字。` });
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      if (lines) {
        pages.push(`【第 ${pageNumber} 頁】\n${lines}`);
        continue;
      }

      pagesWithoutText.push(pageNumber);
      activeOcrPage = pageNumber;
      report({ phase: "rendering", currentPage: pageNumber, percent: Math.round(((pageNumber - 1) / totalPages) * 100), message: "正在準備掃描頁", detail: `第 ${pageNumber} / ${totalPages} 頁沒有可選取文字，準備轉成影像。` });
      if (!ocrWorker) {
        report({ phase: "ocr", currentPage: pageNumber, percent: Math.round(((pageNumber - 1) / totalPages) * 100), message: "正在啟動本機繁體中文 OCR", detail: "首次使用會載入本機 Web Worker 與語言模型，檔案內容不會離開瀏覽器。" });
        ocrWorker = await createPdfOcrWorker(({ status, progress }) => {
          const normalized = Math.min(Math.max(progress, 0), 1);
          const percent = Math.round(((activeOcrPage - 1 + normalized) / totalPages) * 100);
          const message = status === "loading language traineddata"
            ? "正在載入本機繁體中文模型"
            : status === "recognizing text"
              ? "正在辨識掃描頁面文字"
              : status === "initializing api"
                ? "正在初始化本機 OCR 引擎"
                : "本機 OCR 引擎準備中";
          report({ phase: "ocr", currentPage: activeOcrPage, percent, message, detail: `第 ${activeOcrPage} / ${totalPages} 頁 · 本頁 ${Math.round(normalized * 100)}%` });
        }, options.signal);
        ensureNotCancelled(options.signal);
        options.signal?.addEventListener("abort", abortOcr, { once: true });
      }
      const ocrText = await recognizePdfPage(ocrWorker, page, ({ stage, progress, message }) => {
        const normalized = Math.min(Math.max(progress, 0), 1);
        const percent = Math.round(((pageNumber - 1 + normalized) / totalPages) * 100);
        report({ phase: stage === "rendering" ? "rendering" : "ocr", currentPage: pageNumber, percent, message, detail: `第 ${pageNumber} / ${totalPages} 頁 · 本頁 ${Math.round(normalized * 100)}%` });
      }, options.signal);
      ocrPageCount += 1;
      if (ocrText) pages.push(`【第 ${pageNumber} 頁】\n${ocrText}`);
      report({ phase: "ocr", currentPage: pageNumber, percent: Math.round((pageNumber / totalPages) * 100), message: ocrText ? "已完成本機 OCR" : "此頁未辨識到文字", detail: `第 ${pageNumber} / ${totalPages} 頁已完成；${ocrText ? "結果已加入待處理文字。" : "請在完成後人工檢查此頁。"}` });
    }
  } catch (error) {
    if (options.signal?.aborted || error instanceof DocumentParseCancelledError || (error instanceof DOMException && error.name === "AbortError")) {
      throw new DocumentParseCancelledError();
    }
    throw error;
  } finally {
    options.signal?.removeEventListener("abort", abortLoading);
    options.signal?.removeEventListener("abort", abortOcr);
    await terminateOcrWorker();
    pdf?.cleanup();
  }

  const warnings: string[] = [];
  if (ocrPageCount > 0) {
    warnings.push(`PDF 有 ${ocrPageCount} 頁沒有可選取的文字，已在瀏覽器本機使用繁體中文 OCR 辨識；OCR 結果仍建議人工複核。`);
  }
  const unreadablePages = pagesWithoutText.filter((pageNumber) => !pages.some((page) => page.startsWith(`【第 ${pageNumber} 頁】`)));
  if (unreadablePages.length > 0) {
    warnings.push(`第 ${unreadablePages.join("、")} 頁未辨識到文字，請確認影像清晰度或改用人工檢查。`);
  }

  report({ phase: "complete", currentPage: totalPages, percent: 100, message: "PDF 本機解析完成", detail: `文字層 ${totalPages - ocrPageCount} 頁 · OCR ${ocrPageCount} 頁 · 可進入規則設定。` });

  return {
    text: pages.join("\n\n"),
    fileName: file.name,
    fileType: "pdf",
    pageCount: totalPages,
    ocrPageCount,
    warnings,
  };
}

export async function parseDocument(file: File, options: DocumentParseOptions = {}): Promise<ParsedDocument> {
  ensureNotCancelled(options.signal);
  const fileType = detectType(file);
  if (!fileType) throw new Error("目前支援 TXT、CSV、JSON、XLSX、XLS、DOCX 與 PDF 檔案。");
  if (file.size > 25 * 1024 * 1024) throw new Error("目前限制單一檔案不超過 25 MB，以維持本機瀏覽器處理穩定性。");

  if (fileType === "xlsx") return parseSpreadsheet(file);
  if (fileType === "docx") return parseWord(file);
  if (fileType === "pdf") return parsePdf(file, options);

  const text = await file.text();
  ensureNotCancelled(options.signal);
  return { text, fileName: file.name, fileType, warnings: [] };
}

function safeBaseName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/g, "-") || "deidentified";
}

const BRAND_FILE_PREFIX = "無意識-去識別化工作站";

export function buildBrandedFileName(fileName: string, suffix: string, extension: string) {
  const base = safeBaseName(fileName);
  const brandedBase = base.startsWith(`${BRAND_FILE_PREFIX}-`) ? base : `${BRAND_FILE_PREFIX}-${base}`;
  return `${brandedBase}-${suffix}.${extension}`;
}

export function downloadTextResult(text: string, fileName: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = buildBrandedFileName(fileName, "local", "txt");
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportSpreadsheet(text: string, fileName: string) {
  const XLSX = await import("xlsx");
  const rows = text.split(/\r?\n/).map((line) => line.split("\t"));
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = rows[0]?.map(() => ({ wch: 24 })) ?? [];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "去識別化結果");
  XLSX.writeFile(workbook, buildBrandedFileName(fileName, "local", "xlsx"));
}

export async function exportWord(text: string, fileName: string) {
  const { Document, Packer, Paragraph, TextRun } = await import("docx");
  const paragraphs = text.split(/\r?\n/).map((line) => new Paragraph({ children: [new TextRun(line)] }));
  const doc = new Document({ sections: [{ properties: {}, children: paragraphs }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = buildBrandedFileName(fileName, "local", "docx");
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportPdf(text: string, fileName: string) {
  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.left = "-10000px";
  wrapper.style.top = "0";
  wrapper.style.width = "720px";
  wrapper.style.padding = "40px";
  wrapper.style.background = "#f7f3eb";
  wrapper.style.color = "#20332b";
  wrapper.style.fontFamily = "Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif";
  wrapper.style.fontSize = "14px";
  wrapper.style.lineHeight = "1.8";
  wrapper.style.whiteSpace = "pre-wrap";
  wrapper.textContent = text;
  document.body.appendChild(wrapper);

  try {
    await pdf.html(wrapper, {
      x: 40,
      y: 40,
      width: 515,
      windowWidth: 800,
      margin: [40, 40, 40, 40],
      autoPaging: "text",
      html2canvas: { scale: 1.4, backgroundColor: "#f7f3eb" },
    });
  } finally {
    wrapper.remove();
  }
  pdf.save(buildBrandedFileName(fileName, "local", "pdf"));
}
