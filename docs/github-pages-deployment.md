# GitHub Pages 部署說明

本專案使用 GitHub Actions 建置 Vite 靜態輸出，再透過 GitHub Pages artifact 發布。由於 repository URL 使用 `/local-deidentification-tool/` 子路徑，Pages 建置會設定 `GITHUB_PAGES=true`，讓 Vite 產生正確的 `/local-deidentification-tool/` base 路徑；Manus 本機預覽則維持根路徑 `/`。

GitHub 官方文件建議使用 `actions/configure-pages`、`actions/upload-pages-artifact` 與 `actions/deploy-pages` 完成自訂 workflow，並給予 workflow `pages: write` 與 `id-token: write` 權限。[1] Vite 官方文件也指出，部署到 `https://<USERNAME>.github.io/<REPO>/` 時，`base` 應設定為 `/<REPO>/`。[2]

GitHub Pages 版本的繁體中文 OCR 模型使用已部署的 Manus 公開資產 URL，避免將約 27 MB 的模型檔納入 repository；去識別化本身仍在使用者瀏覽器執行，GitHub Pages 只提供前端程式與靜態資源。若未來要完全移除對 Manus 資產主機的依賴，應將模型改放到使用者可控的公開靜態資產主機，並同步更新 `VITE_OCR_LANGUAGE_DATA_URL`。

## 參考資料

1. [GitHub Docs：Using custom workflows with GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
2. [Vite：Deploying a Static Site](https://vite.dev/guide/static-deploy)
3. [GitHub REST API：Pages](https://docs.github.com/en/rest/pages/pages)
