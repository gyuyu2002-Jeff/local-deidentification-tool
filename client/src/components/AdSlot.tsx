/* Design philosophy: quiet archival utility — this margin note reinforces local custody and never competes with processing controls. */

import { Info } from "lucide-react";

export type AdSlotProps = {
  placement?: "status-column" | "footer";
};

/**
 * A privacy-first archival margin note. It never loads third-party scripts,
 * iframes, cookies, pixels, or accesses workbench data.
 */
export default function AdSlot({ placement = "status-column" }: AdSlotProps) {
  const adsEnabled = import.meta.env.VITE_ADS_ENABLED === "true";

  return (
    <aside className={`ad-slot ad-slot--${placement}`} aria-label="工作區旁註">
      <div className="ad-slot__label">
        <span>ARCHIVAL NOTE</span>
        <span className="ad-slot__index">MARGIN / 01</span>
      </div>
      {adsEnabled ? (
        <div className="ad-slot__mount" data-ad-network="pending" aria-live="polite">
          <Info size={14} aria-hidden="true" />
          <p>外部內容尚未啟用；目前不會載入第三方服務。</p>
        </div>
      ) : (
        <div className="ad-slot__placeholder">
          <span className="ad-slot__mark" aria-hidden="true">＋</span>
          <div>
            <strong>資料保管旁註</strong>
            <p>此區不載入追蹤腳本，也不接觸工作區資料。</p>
          </div>
        </div>
      )}
    </aside>
  );
}
