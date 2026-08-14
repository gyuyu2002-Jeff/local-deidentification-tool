/* Design philosophy: quiet archival utility — document operations stay local, explicit, and reversible. */

export type SupportedDocumentType = "xlsx" | "docx" | "pdf" | "text";

export type ParsedDocument = {
  text: string;
  fileName: string;
  fileType: SupportedDocumentType;
  pageCount?: number;
  sheetCount?: number;
  warnings: string[];
};

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

async function parsePdf(file: File): Promise<ParsedDocument> {
  const [{ getDocument, GlobalWorkerOptions }, workerModule] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.mjs?url"),
  ]);
  GlobalWorkerOptions.workerSrc = workerModule.default;
  const buffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (lines) pages.push(`【第 ${pageNumber} 頁】\n${lines}`);
  }

  return {
    text: pages.join("\n\n"),
    fileName: file.name,
    fileType: "pdf",
    pageCount: pdf.numPages,
    warnings: ["PDF 僅能擷取可選取的文字；掃描影像或圖片內文字需要另外加入 OCR。"],
  };
}

export async function parseDocument(file: File): Promise<ParsedDocument> {
  const fileType = detectType(file);
  if (!fileType) throw new Error("目前支援 TXT、CSV、JSON、XLSX、XLS、DOCX 與 PDF 檔案。");
  if (file.size > 25 * 1024 * 1024) throw new Error("目前限制單一檔案不超過 25 MB，以維持本機瀏覽器處理穩定性。");

  if (fileType === "xlsx") return parseSpreadsheet(file);
  if (fileType === "docx") return parseWord(file);
  if (fileType === "pdf") return parsePdf(file);

  return {
    text: await file.text(),
    fileName: file.name,
    fileType,
    warnings: [],
  };
}

function safeBaseName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/g, "-") || "deidentified";
}

export function downloadTextResult(text: string, fileName: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeBaseName(fileName)}-local.txt`;
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
  XLSX.writeFile(workbook, `${safeBaseName(fileName)}-local.xlsx`);
}

export async function exportWord(text: string, fileName: string) {
  const { Document, Packer, Paragraph, TextRun } = await import("docx");
  const paragraphs = text.split(/\r?\n/).map((line) => new Paragraph({ children: [new TextRun(line)] }));
  const doc = new Document({ sections: [{ properties: {}, children: paragraphs }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = `${safeBaseName(fileName)}-local.docx`;
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
  pdf.save(`${safeBaseName(fileName)}-local.pdf`);
}
