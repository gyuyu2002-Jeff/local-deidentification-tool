# Google AdSense／Cookie 政策研究筆記

研究日期：2026-08-17

## 官方來源

1. Google Publisher Policies：<https://support.google.com/adsense/answer/10502938?hl=en>
2. AdSense Program policies：<https://support.google.com/adsense/answer/48182?hl=en>
3. Google EU User Consent Policy：<https://www.google.com/about/company/user-consent-policy/>
4. How Google uses cookies：<https://policies.google.com/technologies/cookies?hl=en-US>

## 可用於草稿的關鍵要求

Google Publisher Policies 頁面指出，使用 Google 廣告程式碼的發布者必須遵守 Google Publisher Policies；政策頁面的隱私相關部分要求隱私權政策向使用者說明第三方可能在瀏覽器上放置與讀取 Cookie，或使用 Web beacon／IP 位址等技術。

Google EU User Consent Policy 指出，若網站使用受該政策涵蓋的 Google 產品，對歐洲經濟區、英國與瑞士使用者，發布者需要在法律要求時取得對 Cookie／其他本機儲存的同意，以及對個人化廣告所涉及個人資料蒐集、分享與使用的同意；同時要清楚指出可能蒐集、接收或使用個人資料的各方，並提供撤回同意的清楚方式。政策也要求保留同意紀錄。

Google Cookie 說明頁指出，Cookie 及類似技術可能包含 local storage、pixel tags 與裝置／瀏覽器識別碼；廣告用途包括提供與呈現廣告、依設定個人化廣告、限制重複曝光、停止顯示特定廣告，以及衡量廣告成效。Google 也列出非 Google 網站廣告可能使用的 Cookie，例如 IDE、id、_gads；實際使用項目會依整合方式、地區與使用者設定而異，因此草稿不應宣稱固定 Cookie 名單或期限，應以實際部署掃描結果更新。

AdSense Program policies 頁面指出，不得鼓勵使用者點擊或觀看廣告、不得以人為方式增加曝光／點擊，也不得以誤導方式讓廣告看起來像選單、導覽或下載連結。這些要求應以網站管理者上線前檢核項目呈現，而非在隱私權政策中過度延伸。

## 與本網站的資料流對照

目前應以實際部署為準：文件文字、Excel、Word、PDF、OCR 與去識別化結果在瀏覽器端處理，不應上傳至本網站後端；若加入 AdSense，廣告程式碼仍可能向 Google 或其合作夥伴請求廣告與相關測量資源，因此對外宣稱應使用「文件內容不會上傳／傳送至本網站伺服器」，而不是「網站完全不會產生任何網路請求」。若網站保留既有分析端點或其他第三方資源，也必須逐項列出並依實際狀態更新政策。

## 草稿限制

本筆記是政策草稿的研究依據，不是法律意見。正式上線前應由網站營運者確認實際 AdSense 設定、分析工具、Cookie／localStorage 行為、網站所在地與目標使用者地區，並請熟悉台灣個資法及相關跨境規範的專業人士審閱。
