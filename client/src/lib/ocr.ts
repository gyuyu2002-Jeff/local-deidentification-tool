// 設計提醒：OCR 只在瀏覽器 Web Worker 執行；AbortSignal 用於中斷長時間頁面辨識與清理畫布。

import workerPath from "tesseract.js/dist/worker.min.js?url";
import type { PDFPageProxy } from "pdfjs-dist";

const OCR_CACHE_NAME = "deid-ocr-model-cache-v1";

async function loadOcrLanguageData(signal?: AbortSignal): Promise<Uint8Array> {
  throwIfCancelled(signal);

  // 1. 嘗試從瀏覽器 CacheStorage 取得已快取的本機模型
  if (typeof caches !== "undefined") {
    try {
      const cache = await caches.open(OCR_CACHE_NAME);
      const cached = await cache.match("chi_tra.traineddata.gz");
      if (cached && cached.ok) {
        return new Uint8Array(await cached.arrayBuffer());
      }
    } catch {
      // 忽略快取讀取例外，繼續嘗試網路/本機路徑
    }
  }

  // 2. 候選載入路徑（優先順序：本機打包資源 -> 自訂環境變數 -> 既有路徑）
  const baseUrl = import.meta.env.BASE_URL || "/";
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const candidateUrls = [
    `${normalizedBase}models/chi_tra.traineddata.gz`,
    "/models/chi_tra.traineddata.gz",
    import.meta.env.VITE_OCR_LANGUAGE_DATA_URL,
    "/manus-storage/chi_tra.traineddata_2eacdbbf.gz",
  ].filter(Boolean) as string[];

  for (const url of candidateUrls) {
    throwIfCancelled(signal);
    try {
      const res = await fetch(url, { cache: "force-cache", signal });
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        // 儲存至 CacheStorage 供離線使用
        if (typeof caches !== "undefined") {
          try {
            const cache = await caches.open(OCR_CACHE_NAME);
            await cache.put(
              "chi_tra.traineddata.gz",
              new Response(buffer.slice(0), {
                headers: { "Content-Type": "application/gzip" },
              }),
            );
          } catch {
            // 忽略快取寫入失敗
          }
        }
        return new Uint8Array(buffer);
      }
    } catch (err) {
      if (signal?.aborted) throw new DOMException("OCR cancelled", "AbortError");
      // 繼續嘗試下一個候選路徑
    }
  }

  throw new Error("本機繁體中文 OCR 語言模型載入失敗，請確認已載入網站離線資源。");
}

export type PdfPageLike = Pick<PDFPageProxy, "getViewport" | "render">;

export type PdfOcrWorker = Awaited<ReturnType<typeof createPdfOcrWorker>>;

export type PdfOcrLog = {
  status: string;
  progress: number;
};

export type PdfPageProgress = {
  stage: "rendering" | "recognizing";
  progress: number;
  message: string;
};

function throwIfCancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("OCR cancelled", "AbortError");
}

export async function createPdfOcrWorker(onProgress?: (log: PdfOcrLog) => void, signal?: AbortSignal) {
  const [{ createWorker, OEM }, languageData] = await Promise.all([
    import("tesseract.js"),
    loadOcrLanguageData(signal),
  ]);

  throwIfCancelled(signal);
  const worker = await createWorker(
    [{ code: "chi_tra", data: languageData }],
    OEM.LSTM_ONLY,
    {
      workerPath,
      workerBlobURL: false,
      gzip: true,
      cacheMethod: "write",
      logger: (message) => {
        if (message.status) {
          onProgress?.({
            status: message.status,
            progress: typeof message.progress === "number" ? message.progress : 0,
          });
        }
      },
    },
  );

  throwIfCancelled(signal);
  await worker.setParameters({
    preserve_interword_spaces: "1",
    user_defined_dpi: "300",
  });

  return worker;
}

export async function recognizePdfPage(
  worker: PdfOcrWorker,
  page: PdfPageLike,
  onProgress?: (progress: PdfPageProgress) => void,
  signal?: AbortSignal,
) {
  throwIfCancelled(signal);
  const initialViewport = page.getViewport({ scale: 1 });
  const longestSide = Math.max(initialViewport.width, initialViewport.height);
  const scale = Math.min(2.2, Math.max(1.5, 2200 / longestSide));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  let renderTask: ReturnType<PdfPageLike["render"]> | null = null;

  try {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("瀏覽器無法建立 PDF OCR 畫布。");
    onProgress?.({ stage: "rendering", progress: 0, message: "正在將掃描頁轉換為高解析度影像" });
    renderTask = page.render({ canvasContext: context, canvas, viewport });
    const cancelRender = () => renderTask?.cancel();
    signal?.addEventListener("abort", cancelRender, { once: true });
    try {
      await renderTask.promise;
    } finally {
      signal?.removeEventListener("abort", cancelRender);
    }
    throwIfCancelled(signal);
    onProgress?.({ stage: "recognizing", progress: 0, message: "正在辨識掃描頁文字" });
    const { data } = await worker.recognize(canvas, {}, { text: true });
    throwIfCancelled(signal);
    onProgress?.({ stage: "recognizing", progress: 1, message: "本頁 OCR 已完成" });
    return data.text.trim();
  } finally {
    canvas.width = 1;
    canvas.height = 1;
  }
}
