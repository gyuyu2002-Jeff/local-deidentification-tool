// 設計提醒：沿用「安靜的資料保管庫」方向；法律頁面以文件索引、資料邊界與可掃讀表格呈現，不使用行銷式堆疊。

import type { ReactNode } from "react";
import { ArrowLeft, ExternalLink, FileText, LockKeyhole, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import ConsentBanner from "@/components/ConsentBanner";

type LegalPageKind = "privacy" | "cookies";

const sharedNotes = (
  <div className="legal-page__notice">
    <strong>草稿狀態</strong>
    <p>這是依目前網站功能與 Google 官方發布商政策整理的工作草稿，不是法律意見。正式發布前，請補上營運者資料、正式網址與實際第三方服務清單，並由合格專業人士審閱。</p>
  </div>
);

function PrivacyPage() {
  return (
    <LegalShell kind="privacy" eyebrow="POLICY / 01" title="隱私權政策" intro="說明本機去識別化工具如何處理文件、網站技術資訊與日後可能啟用的廣告服務。">
      {sharedNotes}
      <LegalSection title="資料不離開裝置的處理原則">
        <p>文字、Excel、Word、PDF、OCR 影像內容、去識別化結果、人工遮罩與工作區狀態，依目前產品設計在你的瀏覽器記憶體中處理。本網站不應將這些文件內容上傳至本網站後端，也不會由本網站伺服器保存原始或去識別化文件。</p>
        <blockquote>文件內容不會上傳至本網站伺服器，不等於使用本網站時完全沒有任何網路請求。若載入主機、分析、廣告或其他第三方資源，瀏覽器仍可能向這些服務提出技術請求。</blockquote>
      </LegalSection>
      <LegalSection title="可能處理的資訊">
        <div className="legal-table-wrap"><table className="legal-table"><thead><tr><th>資訊類型</th><th>處理方式</th><th>本網站是否保存</th></tr></thead><tbody><tr><td>文字與文件</td><td>在瀏覽器中解析、替換、OCR、預覽與匯出</td><td>不由本網站伺服器保存</td></tr><tr><td>自訂字典與遮罩</td><td>依使用者操作在目前工作階段使用</td><td>不由本網站伺服器保存</td></tr><tr><td>技術資訊</td><td>可能由主機、CDN、分析或廣告服務產生</td><td>依實際部署設定</td></tr><tr><td>Cookie／類似技術</td><td>管理必要功能、同意偏好及日後第三方服務</td><td>依實際啟用服務</td></tr></tbody></table></div>
      </LegalSection>
      <LegalSection title="Google AdSense 與第三方廣告">
        <p>目前網站不載入 Google AdSense 或其他第三方廣告腳本。若日後啟用，Google 及其合作夥伴可能使用 Cookie、Web beacon、IP 位址、裝置或瀏覽器資訊及類似技術提供、呈現、衡量或個人化廣告。廣告技術不得讀取本工作站的文件內容、OCR 文字或人工遮罩。</p>
        <p>對於歐洲經濟區、英國與瑞士使用者，若 Google 的同意政策適用，網站應在法律要求時先取得對 Cookie／本機儲存及個人化廣告相關資料處理的有效同意，並提供撤回或修改方式。</p>
      </LegalSection>
      <LegalSection title="保存、安全與使用者權利">
        <p>工作區資料可由使用者按下「清除工作區」移除；關閉分頁、重新整理或瀏覽器記憶體回收也可能使尚未下載的資料消失。依適用法律，你可能享有查詢、更正、刪除、停止處理、撤回同意及提出申訴等權利。</p>
        <div className="legal-contact"><span>營運者</span><strong>[請填入個人／公司／組織名稱]</strong><span>隱私權信箱</span><strong>gyuyu20002@gmail.com</strong><span>正式網址</span><strong>[請填入 HTTPS 網址]</strong></div>
      </LegalSection>
      <LegalSection title="官方參考資料">
        <p className="legal-links"><a href="https://support.google.com/adsense/answer/10502938?hl=en" target="_blank" rel="noreferrer">Google Publisher Policies <ExternalLink size={13} /></a><a href="https://www.google.com/about/company/user-consent-policy/" target="_blank" rel="noreferrer">Google EU User Consent Policy <ExternalLink size={13} /></a><a href="https://policies.google.com/technologies/cookies?hl=en-US" target="_blank" rel="noreferrer">How Google uses cookies <ExternalLink size={13} /></a></p>
      </LegalSection>
    </LegalShell>
  );
}

function CookiesPage() {
  return (
    <LegalShell kind="cookies" eyebrow="POLICY / 02" title="Cookie／廣告宣告" intro="說明本站目前的同意偏好、Cookie 分類，以及未來啟用廣告時的資料邊界。">
      {sharedNotes}
      <LegalSection title="目前狀態">
        <div className="legal-status-grid"><div><span className="status-dot" /><strong>目前未載入 AdSense</strong><small>本站只顯示隱私優先的保留版位，不載入第三方廣告腳本、像素或 iframe。</small></div><div><span className="status-dot status-dot--amber" /><strong>文件處理維持本機</strong><small>文件、OCR 文字與去識別化結果不應送往廣告或分析服務。</small></div></div>
      </LegalSection>
      <LegalSection title="Cookie 與類似技術分類">
        <div className="legal-table-wrap"><table className="legal-table"><thead><tr><th>類別</th><th>目的</th><th>目前狀態</th></tr></thead><tbody><tr><td>必要功能</td><td>頁面載入、同意偏好與安全性</td><td>維持開啟</td></tr><tr><td>本機工作區</td><td>在瀏覽器中處理文件與目前工作狀態</td><td>不由伺服器保存</td></tr><tr><td>分析與效能</td><td>了解錯誤與載入效能</td><td>目前未啟用</td></tr><tr><td>非個人化廣告</td><td>載入、限制重複曝光與衡量廣告</td><td>目前未啟用</td></tr><tr><td>個人化廣告</td><td>依同意與地區設定提供個人化廣告</td><td>目前未啟用</td></tr></tbody></table></div>
      </LegalSection>
      <LegalSection title="你的偏好與撤回方式">
        <p>你可以在頁面右下角開啟「Cookie 設定」，分別管理分析、非個人化廣告與個人化廣告偏好。必要功能無法關閉。若瀏覽器限制 localStorage，偏好可能只在目前頁面有效。</p>
        <p>在法律或 Google 政策要求事前同意的地區，正式接入 AdSense 前應完成符合要求的同意管理平台，讓使用者能分項選擇、拒絕、撤回並再次開啟設定。本站目前的偏好介面是產品層的預備控制，不代表已完成 Google 認證 CMP 審核。</p>
        <div className="legal-action-row"><a className="primary-button" href="#cookie-settings" onClick={(event) => { event.preventDefault(); window.dispatchEvent(new CustomEvent("open-cookie-settings")); }}>開啟 Cookie 設定</a><span>也可以透過瀏覽器設定刪除或阻擋網站資料。</span></div>
      </LegalSection>
      <LegalSection title="Google AdSense 參考資料">
        <p className="legal-links"><a href="https://support.google.com/adsense/answer/48182?hl=en" target="_blank" rel="noreferrer">AdSense Program policies <ExternalLink size={13} /></a><a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google 隱私權政策 <ExternalLink size={13} /></a><a href="https://adssettings.google.com/" target="_blank" rel="noreferrer">Google 廣告設定 <ExternalLink size={13} /></a></p>
        <p className="legal-contact-line">政策、Cookie 或資料處理問題：<a href="mailto:gyuyu20002@gmail.com">gyuyu20002@gmail.com</a></p>
      </LegalSection>
    </LegalShell>
  );
}

function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="legal-section"><h2>{title}</h2>{children}</section>;
}

function LegalShell({ kind, eyebrow, title, intro, children }: { kind: LegalPageKind; eyebrow: string; title: string; intro: string; children: ReactNode }) {
  return (
    <div className="app-shell legal-shell">
      <header className="topbar legal-topbar"><div className="topbar__brand"><Link href="/"><span className="local-mark local-mark--compact"><span className="local-mark__glyph" aria-hidden="true"><span /><span /></span><span><strong className="brand-wordmark">無意識</strong></span></span></Link></div><div className="topbar__context"><span className="topbar__rule" /><span>政策與資料邊界</span></div><nav className="legal-nav" aria-label="政策導覽"><Link href="/">工作站</Link><Link href="/privacy" className={kind === "privacy" ? "legal-nav__active" : ""}>隱私權政策</Link><Link href="/cookies" className={kind === "cookies" ? "legal-nav__active" : ""}>Cookie 宣告</Link></nav></header>
      <main className="legal-layout"><aside className="legal-aside"><span className="eyebrow">ARCHIVE / {kind === "privacy" ? "01" : "02"}</span><div className="legal-aside__mark"><FileText size={22} /><span>POLICY<br />INDEX</span></div><p>這裡整理網站如何處理資料，以及日後啟用第三方服務時的界線。</p><div className="legal-aside__seal"><LockKeyhole size={15} />文件處理維持本機</div></aside><article className="legal-document"><div className="legal-document__intro"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{intro}</p></div>{children}<div className="legal-document__back"><Link href="/"><ArrowLeft size={15} /> 回到去識別化工作站</Link><span><ShieldCheck size={14} /> LOCAL ONLY · 文件內容不送出</span></div></article></main>
      <footer className="site-footer"><span className="site-footer__brand">無意識 · 去識別化工作站</span><span>政策文件 · 2026</span><span><Link href="/privacy">隱私權</Link> · <Link href="/cookies">Cookie 宣告</Link></span></footer>
      <ConsentBanner />
    </div>
  );
}

export default function LegalPage({ kind }: { kind: LegalPageKind }) {
  return kind === "privacy" ? <PrivacyPage /> : <CookiesPage />;
}
