# GitHub Pages PDF 下載問題重現紀錄

測試網址：<https://gyuyu2002-jeff.github.io/local-deidentification-tool/?v=e023168>

以內建範例資料測試時，網站可在瀏覽器端完成 8 處去識別化替換，並進入「處理結果」區。結果區目前可見 `下載 TXT` 與差異檢視控制項；PDF、XLSX、DOCX 的完整格式按鈕位於結果卡片的下方／右側，需要以頁面捲動或較寬視窗檢查。

雖然自動化檔案上傳工具未能完成 PDF fixture 上傳，靜態檢查已確認 `exportPdf()` 使用 jsPDF `html()`；jsPDF 會在執行時動態載入 `html2canvas`。原專案未將 `html2canvas` 列為直接依賴，GitHub Pages production bundle 因而無法穩定提供這個動態 chunk，會在按下 PDF 按鈕後失敗。

已清除內建範例後，空白工作區正常恢復「選取檔案」控制項；測試使用 `/home/ubuntu/pdf-download-fixture.pdf`，內容為非敏感的 Email、電話與 IPv4 範例。

DOM 檢查確認文件上傳欄位為第一個 `<input type="file">`（accept 包含 `.pdf`），字典欄位為第二個 file input；自動化上傳工具未能定位隱藏欄位，因此需要改用瀏覽器的檔案選取互動或其他測試方式。

曾暫時將文件 input 設為可見，但自動化上傳仍回報找不到欄位；頁面本身保持正常，欄位顯示 `Choose File / No file chosen`。因此目前需要改以程式化單元測試、靜態分析與直接檢查匯出實作來定位問題。

修正方式是在 `package.json` 加入 `html2canvas@^1.4.1`，並更新 lockfile。`pnpm run build:pages` 已成功產生 `html2canvas.esm-*.js` chunk，表示 GitHub Pages workflow 會將所需模組一併發布；`pnpm check` 與 14 項既有測試也已通過。

修正後 commit `300ce742` 的 GitHub Pages workflow 已成功完成。線上首頁 HTTP 200，主 bundle 為 `index-wVXcphtV.js`，公開的 `html2canvas.esm-B0tyYwQk.js` chunk 回應 HTTP 200；因此 jsPDF `html()` 所需的動態模組已確實部署到 Pages。
