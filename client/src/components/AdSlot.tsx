/* Design philosophy: quiet archival utility — the ad surface is a restrained, clearly labelled optional margin and never competes with local processing controls. */

import { Info } from "lucide-react";

export type AdSlotProps = {
  placement?: "status-column" | "footer";
};

/**
 * A privacy-first ad boundary. It intentionally renders a local placeholder
 * until an approved network and consent flow are configured. No third-party
 * script, iframe, cookie, pixel, or user data is loaded by default.
 */
export default function AdSlot({ placement = "status-column" }: AdSlotProps) {
  const adsEnabled = import.meta.env.VITE_ADS_ENABLED === "true";

  return (
    <aside className={`ad-slot ad-slot--${placement}`} aria-label="廣告版位">
      <div className="ad-slot__label">
        <span>ADVERTISEMENT</span>
        <span className="ad-slot__index">MARGIN / 01</span>
      </div>
      {adsEnabled ? (
        <div className="ad-slot__mount" data-ad-network="pending" aria-live="polite">
          <Info size={14} aria-hidden="true" />
          <p>廣告服務尚未設定同意管理與來源。</p>
        </div>
      ) : (
        <div className="ad-slot__placeholder">
          <span className="ad-slot__mark" aria-hidden="true">＋</span>
          <div>
            <strong>保留版位</strong>
            <p>此區不載入追蹤腳本，也不接觸工作區資料。</p>
          </div>
        </div>
      )}
    </aside>
  );
}
