# GitHub Pages 線上驗證紀錄

GitHub Pages 已使用 GitHub Actions workflow 發布，最新成功 workflow 為 `31796070868`，對應 commit `e02316839ca30ec3ad0174e920e56b94c6127ed8`。Pages 設定為 `build_type: workflow`，HTTPS 強制開啟。

正式預覽網址為：

<https://gyuyu2002-jeff.github.io/local-deidentification-tool/>

首頁 HTTP 回應為 200，HTML 會載入 repository 子路徑下的最新 JavaScript、CSS、favicon 與 manifest。首頁標題為「流動幻彩｜無意識－去識別化工作站」，Open Graph URL 也指向 GitHub Pages 公開網址。

GitHub Pages 的 repository 子路徑已透過 Vite `base` 與 Wouter `Router base={import.meta.env.BASE_URL}` 同步處理；因此正式首頁載入後會顯示工作台，而不是被 fallback route 判定為 404。若瀏覽器在修正前已快取舊 bundle，可先使用以下快取破除網址重新載入一次：

<https://gyuyu2002-jeff.github.io/local-deidentification-tool/?v=e023168>

此站仍是純前端靜態網站；文字、文件解析、去識別化與 OCR 皆在瀏覽器執行。繁體中文 OCR 模型目前由公開 Manus 靜態資產 URL 提供，模型本身不是使用者資料。
