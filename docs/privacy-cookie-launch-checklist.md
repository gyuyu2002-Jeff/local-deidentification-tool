# 隱私權政策與 Cookie／AdSense 上線前檢核

> 這份檢核表是草稿發布前的操作清單，不是法律意見。請先完成實際部署確認，再把兩份政策草稿中的方括號欄位替換掉。

## 必填的營運者資料

| 欄位 | 必須填入的內容 |
|---|---|
| 正式網站網址 | GitHub Pages 或自訂網域的完整 HTTPS 網址 |
| 營運者名稱 | 個人、公司或組織的法定／對外名稱 |
| 隱私權聯絡信箱 | `gyuyu20002@gmail.com`（已設定） |
| 營運者所在地與地址 | 依實際營運模式及適用法律填寫 |
| 生效／更新日期 | 正式發布政策的日期 |
| 資料主體請求流程 | 身分確認、回覆期限與承辦方式 |

## 技術確認

| 檢核項目 | 結果欄 |
|---|---|
| 使用瀏覽器 Network 面板確認文件內容沒有送往本網站或第三方端點 | `[待確認]` |
| 確認 Excel、Word、PDF、OCR 與人工遮罩都在瀏覽器本機處理 | `[待確認]` |
| 確認自訂字典是否使用 localStorage、sessionStorage 或僅留在記憶體 | `[待確認]` |
| 列出 GitHub Pages、CDN、字型、分析、錯誤監測與廣告服務 | `[待確認]` |
| 使用瀏覽器 Application 面板記錄實際 Cookie、localStorage 與 sessionStorage | `[待確認]` |
| 確認廣告程式碼不讀取工作區文件、OCR 文字或下載內容 | `[待確認]` |
| 確認廣告未放在下載、清除工作區、規則選擇或導覽按鈕旁而造成誤認 | `[待確認]` |
| 若使用 EEA／英國／瑞士流量，確認同意管理平台先於非必要廣告／分析技術載入 | `[待確認]` |
| 確認同意可分項選擇、可撤回、可再次開啟，且同意紀錄依實際平台保存 | `[待確認]` |
| 確認 `ads.txt` 是否由 AdSense 帳戶要求，以及是否已放置於正式網域根目錄 | `[待確認]` |

## 草稿整合方式

隱私權政策應放在網站固定且容易找到的頁面，例如 `/privacy`；Cookie／廣告宣告可放在 `/cookies` 或 `/cookie-advertising-notice`。頁尾應同時放置「隱私權政策」、「Cookie／廣告設定」與「聯絡方式」連結。若本網站尚未啟用 AdSense，請從正式頁面移除「已使用」語氣，並保留「目前未啟用」或暫不發布 AdSense 章節。

在廣告程式碼上線前，應先完成政策、同意介面、拒絕／撤回流程與實際網路請求測試。若網站只使用直接贊助的靜態 Banner，則可以移除 Google AdSense、Google Cookie 及個人化廣告段落，改為列出實際贊助商與圖片載入方式。

## 發布後維護

每次新增或移除第三方服務、分析工具、廣告格式、Cookie、localStorage 或主機供應商時，都應重新掃描實際資料流並同步更新兩份政策。至少每季檢查一次 Google Publisher Policies 與 Google EU User Consent Policy，因為 Google 明確要求發布者自行掌握政策更新。[1] [2]

## 來源

[1]: https://support.google.com/adsense/answer/48182?hl=en "AdSense Program policies"  
[2]: https://www.google.com/about/company/user-consent-policy/ "Google EU User Consent Policy"
