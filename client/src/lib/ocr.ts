// 設計提醒：OCR 是「安靜的資料保管庫」工作流中的本機延伸；只回傳文字與進度，不建立伺服器連線，也不保存原始影像。

import workerPath from "tesseract.js/dist/worker.min.js?url";
import type { PDFPageProxy } from "pdfjs-dist";

const CHINESE_LANGUAGE_DATA_URL = "/manus-storage/chi_tra.traineddata_2eacdbbf.gz";

export type PdfPageLike = Pick<PDFPageProxy, "getViewport" | "render">;

export type PdfOcrWorker = Awaited<ReturnType<typeof createPdfOcrWorker>>;

export async function createPdfOcrWorker() {
  const [{ createWorker, OEM }, languageResponse] = await Promise.all([
    import("tesseract.js"),
    fetch(CHINESE_LANGUAGE_DATA_URL, { cache: "force-cache" }),
  ]);

  if (!languageResponse.ok) {
    throw new Error("本機 OCR 語言模型載入失敗，請確認網路可暫時取得網站資源後再試一次。");
  }

  const languageData = new Uint8Array(await languageResponse.arrayBuffer());
  const worker = await createWorker(
    [{ code: "chi_tra", data: languageData }],
    OEM.LSTM_ONLY,
    {
      workerPath,
      workerBlobURL: false,
      gzip: true,
      cacheMethod: "write",
    },
  );

  await worker.setParameters({
    preserve_interword_spaces: "1",
    user_defined_dpi: "300",
  });

  return worker;
}

export async function recognizePdfPage(worker: PdfOcrWorker, page: PdfPageLike) {
  const initialViewport = page.getViewport({ scale: 1 });
  const longestSide = Math.max(initialViewport.width, initialViewport.height);
  const scale = Math.min(2.2, Math.max(1.5, 2200 / longestSide));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  try {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("瀏覽器無法建立 PDF OCR 畫布。");
    await page.render({ canvasContext: context, canvas, viewport }).promise;
    const { data } = await worker.recognize(canvas, {}, { text: true });
    return data.text.trim();
  } finally {
    canvas.width = 1;
    canvas.height = 1;
  }
}
