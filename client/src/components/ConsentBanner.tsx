// 設計提醒：沿用「安靜的資料保管庫」方向；以資料分類與明確開關呈現同意，不使用壓迫式全屏彈窗或模糊 CTA。

import { useEffect, useState } from "react";
import { Check, Cookie, Settings2, X } from "lucide-react";
import {
  CONSENT_UPDATED_EVENT,
  getStoredConsent,
  saveConsent,
  type ConsentPreferences,
} from "@/lib/consent";

type ConsentDraft = Omit<ConsentPreferences, "decidedAt">;

const DEFAULT_DRAFT: ConsentDraft = {
  necessary: true,
  analytics: false,
  advertising: false,
  personalizedAdvertising: false,
};

function toDraft(preferences: ConsentPreferences | null): ConsentDraft {
  if (!preferences) return DEFAULT_DRAFT;
  return {
    necessary: true,
    analytics: preferences.analytics,
    advertising: preferences.advertising,
    personalizedAdvertising: preferences.personalizedAdvertising,
  };
}

export default function ConsentBanner() {
  const [preferences, setPreferences] = useState<ConsentPreferences | null>(() => getStoredConsent());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState<ConsentDraft>(() => toDraft(getStoredConsent()));

  useEffect(() => {
    const handleConsentUpdate = (event: Event) => {
      const next = (event as CustomEvent<ConsentPreferences | null>).detail ?? getStoredConsent();
      setPreferences(next);
      setDraft(toDraft(next));
    };
    const handleOpenSettings = () => {
      setDraft(toDraft(getStoredConsent()));
      setSettingsOpen(true);
    };
    window.addEventListener(CONSENT_UPDATED_EVENT, handleConsentUpdate);
    window.addEventListener("open-cookie-settings", handleOpenSettings);
    return () => {
      window.removeEventListener(CONSENT_UPDATED_EVENT, handleConsentUpdate);
      window.removeEventListener("open-cookie-settings", handleOpenSettings);
    };
  }, []);

  const commit = (next: ConsentDraft) => {
    const saved = saveConsent(next);
    setPreferences(saved);
    setDraft(toDraft(saved));
    setSettingsOpen(false);
  };

  const openSettings = () => {
    setDraft(toDraft(preferences));
    setSettingsOpen(true);
  };

  if (preferences && !settingsOpen) {
    return (
      <button type="button" className="consent-settings-trigger" onClick={openSettings}>
        <Settings2 size={14} /> Cookie 設定
      </button>
    );
  }

  return (
    <>
      {!preferences && !settingsOpen && (
        <section className="consent-banner" role="region" aria-label="Cookie 與廣告設定">
          <div className="consent-banner__icon" aria-hidden="true"><Cookie size={20} /></div>
          <div className="consent-banner__copy">
            <span className="eyebrow">COOKIE / CONTROL</span>
            <h2>先決定哪些額外服務可以啟用</h2>
            <p>文件仍會在本機瀏覽器處理。本站目前不載入 AdSense 或分析腳本；若日後啟用，會依你的選擇管理非必要服務。</p>
            <div className="consent-banner__links"><a href="/cookies">查看 Cookie／廣告宣告</a><a href="/privacy">查看隱私權政策</a></div>
          </div>
          <div className="consent-banner__actions">
            <button type="button" className="quiet-button" onClick={() => commit(DEFAULT_DRAFT)}>僅必要功能</button>
            <button type="button" className="primary-button" onClick={() => commit({ ...DEFAULT_DRAFT, analytics: true, advertising: true, personalizedAdvertising: false })}><Check size={15} /> 同意非個人化廣告</button>
            <button type="button" className="icon-button consent-banner__settings" onClick={openSettings} aria-label="開啟 Cookie 詳細設定"><Settings2 size={17} /></button>
          </div>
        </section>
      )}
      {settingsOpen && (
        <section className="consent-panel" role="dialog" aria-modal="false" aria-label="Cookie 詳細設定">
          <div className="consent-panel__header"><div><span className="eyebrow">COOKIE / SETTINGS</span><h2>Cookie 與廣告偏好</h2></div><button type="button" className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="關閉 Cookie 設定"><X size={18} /></button></div>
          <p className="consent-panel__intro">必要功能永遠維持開啟；其餘選項只會在網站實際整合相應服務後才產生第三方請求。</p>
          <div className="consent-option consent-option--locked"><div><strong>必要功能</strong><small>頁面載入、同意偏好與安全性所需。</small></div><span className="consent-option__state">永遠開啟</span></div>
          <label className="consent-option"><span><strong>分析與效能</strong><small>協助了解載入錯誤與網站使用情形；目前未啟用。</small></span><input type="checkbox" checked={draft.analytics} onChange={(event) => setDraft((current) => ({ ...current, analytics: event.target.checked }))} /></label>
          <label className="consent-option"><span><strong>非個人化廣告</strong><small>載入與衡量廣告；目前尚未連接 AdSense。</small></span><input type="checkbox" checked={draft.advertising} onChange={(event) => setDraft((current) => ({ ...current, advertising: event.target.checked, personalizedAdvertising: event.target.checked && current.personalizedAdvertising }))} /></label>
          <label className={`consent-option ${!draft.advertising ? "consent-option--disabled" : ""}`}><span><strong>個人化廣告</strong><small>僅在廣告服務實際啟用且法律要求的同意流程完成後才會考慮。</small></span><input type="checkbox" checked={draft.personalizedAdvertising} disabled={!draft.advertising} onChange={(event) => setDraft((current) => ({ ...current, personalizedAdvertising: event.target.checked }))} /></label>
          <div className="consent-panel__footer"><a href="/cookies">閱讀完整宣告</a><button type="button" className="primary-button" onClick={() => commit(draft)}>儲存偏好</button></div>
        </section>
      )}
    </>
  );
}
