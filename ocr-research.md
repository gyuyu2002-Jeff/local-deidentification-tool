# PDF 本機 OCR 技術備忘

## 官方資料

Tesseract.js 官方網站：https://tesseract.projectnaptha.com/

Tesseract.js 官方 API 文件：https://github.com/naptha/tesseract.js/blob/master/docs/api.md

## 已確認的整合要點

Tesseract.js 是可在瀏覽器執行的 JavaScript OCR 引擎，使用 Web Worker 管理 OCR 工作。官方 API 以 `createWorker` 建立 worker，再以 `worker.recognize(image)` 取得 `data.text`；多語言可透過語言代碼載入。OCR 的輸入應使用足夠解析度的影像，且 `worker.terminate()` 可在工作完成後釋放資源。

本專案會先以 PDF.js 在本機把沒有可選取文字的 PDF 頁面渲染成 Canvas，再交給 Tesseract.js 在瀏覽器端辨識；既有 PDF 文字層則直接擷取，避免不必要的 OCR。OCR 文字會回到既有去識別化流程，原始 PDF 不上傳後端。

## 隱私與使用提示

OCR 引擎需要載入 WebAssembly、worker 與語言模型資源。文件影像與 OCR 內容仍在瀏覽器端處理；介面會明確提示這是本機 OCR，並對掃描頁面顯示辨識狀態與可能需要人工複核的警告。
