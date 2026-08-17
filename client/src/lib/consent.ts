// 設計提醒：沿用「安靜的資料保管庫」方向；同意狀態以克制、可檢查的本機偏好呈現，不讓非必要服務默默啟動。

export const CONSENT_STORAGE_KEY = "unconscious-cookie-preferences";
export const CONSENT_UPDATED_EVENT = "unconscious-consent-updated";

export type ConsentPreferences = {
  necessary: true;
  analytics: boolean;
  advertising: boolean;
  personalizedAdvertising: boolean;
  decidedAt: string;
};

export function getStoredConsent(): ConsentPreferences | null {
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentPreferences>;
    if (parsed.necessary !== true || typeof parsed.decidedAt !== "string") return null;
    return {
      necessary: true,
      analytics: parsed.analytics === true,
      advertising: parsed.advertising === true,
      personalizedAdvertising: parsed.personalizedAdvertising === true && parsed.advertising === true,
      decidedAt: parsed.decidedAt,
    };
  } catch {
    return null;
  }
}

export function saveConsent(preferences: Omit<ConsentPreferences, "decidedAt">): ConsentPreferences {
  const next: ConsentPreferences = {
    ...preferences,
    necessary: true,
    personalizedAdvertising: preferences.personalizedAdvertising && preferences.advertising,
    decidedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(CONSENT_UPDATED_EVENT, { detail: next }));
  } catch {
    // 私密瀏覽或儲存空間受限時，偏好仍會在目前畫面生效。
  }
  return next;
}

export function clearConsent(): void {
  try {
    window.localStorage.removeItem(CONSENT_STORAGE_KEY);
  } catch {
    // 不阻斷使用者繼續使用本機工具。
  }
  window.dispatchEvent(new CustomEvent(CONSENT_UPDATED_EVENT, { detail: null }));
}
