# PDF 預覽與下載互動驗證

驗證網址：<https://gyuyu2002-jeff.github.io/local-deidentification-tool/?v=87deff0>

目前已確認最新 GitHub Pages 版本可以載入工作台、範例資料與本機處理提示；頁面呈現 `LOCAL ONLY`、工作流程狀態與右下角 Sonner 通知。接下來以內建非敏感範例資料執行去識別化，確認 PDF 類型結果卡片是否先開啟預覽，再於確認下載時呈現處理中狀態與完成通知。

範例文字流程已完成去識別化並顯示右下角成功提示；由於它不是 PDF 檔案，結果卡片正確顯示「下載 TXT」，因此 PDF 專屬預覽仍需以 PDF fixture 進行。清除工作區前確認對話框也已在最新線上版本正常出現。

已透過瀏覽器 console 建立非敏感 `privacy-sample.pdf` File 物件並觸發文件 input 的 change 事件，接下來檢查線上頁面是否完成 PDF 文字解析。

第一個測試 fixture 被 PDF.js 判定為 `Invalid PDF structure`，已排除為測試檔案結構問題；第二個 fixture 改由 ReportLab 產生，並重新透過瀏覽器 File input 觸發解析。

第二個 fixture 已成功在 GitHub Pages 完成本機 PDF 解析與去識別化，結果顯示 3 處替換，結果卡片按鈕文字為「預覽並下載 PDF」，符合新增的下載前預覽入口。

預覽視窗成功開啟並顯示去識別化後文字；按下「確認並下載 PDF」後，按鈕切換為「PDF 處理中…」，表示載入狀態與防重複點擊已生效。html2canvas 在擷取含 OKLCH 的樣式時於 console 提示不支援色彩函式，需確認 PDF 是否仍能成功產生，以及必要時將匯出專用樣式改為相容色值。

線上測試在「PDF 處理中…」狀態停留，並出現 html2canvas 的 OKLCH 警告；因此已將 PDF 匯出改為原生 Canvas 逐頁繪製，再交由 jsPDF 輸出，不再使用 `pdf.html()` 或依賴頁面 CSS 解析。這會保留瀏覽器字型對繁體中文的支援，同時避開 OKLCH 相容性問題。
