/* Design philosophy: quiet archival utility — spreadsheets feel tangible with explicit gridlines and clear audit marks. */

import { useMemo, useRef, useState, type UIEvent } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Link2, Sparkles, Unlink2 } from "lucide-react";
import { type RuleId, deidentifyText, hasRedactionTokens } from "@/lib/deidentify";

import { type SpreadsheetSheet } from "@/lib/documents";

type SpreadsheetVisualCompareProps = {
  sheets: SpreadsheetSheet[];
  enabledRules: RuleId[];
  customTerms: string[];
};

function getColumnLetter(colIndex: number): string {
  let letter = "";
  let temp = colIndex;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

export default function SpreadsheetVisualCompare({
  sheets,
  enabledRules,
  customTerms,
}: SpreadsheetVisualCompareProps) {
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [syncScroll, setSyncScroll] = useState(true);

  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const isSyncingLeft = useRef(false);
  const isSyncingRight = useRef(false);

  const activeSheet = sheets[activeSheetIndex] || { name: "Sheet1", rows: [] };
  const originalRows = activeSheet.rows;

  const deidentifiedRows = useMemo(() => {
    return originalRows.map((row) =>
      row.map((cell) => deidentifyText(cell, enabledRules, customTerms).text),
    );
  }, [originalRows, enabledRules, customTerms]);

  const { changedSet, totalChangedCount } = useMemo(() => {
    const set = new Set<string>();
    let count = 0;
    originalRows.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell !== deidentifiedRows[r]?.[c]) {
          set.add(`${r},${c}`);
          count += 1;
        }
      });
    });
    return { changedSet: set, totalChangedCount: count };
  }, [originalRows, deidentifiedRows]);

  const containsExistingTokens = useMemo(() => {
    return originalRows.some((row) => row.some((cell) => hasRedactionTokens(cell)));
  }, [originalRows]);


  const maxCols = useMemo(() => {
    return Math.max(1, originalRows.reduce((max, row) => Math.max(max, row.length), 0));
  }, [originalRows]);

  const handleLeftScroll = (e: UIEvent<HTMLDivElement>) => {
    if (!syncScroll || isSyncingLeft.current) return;
    const left = leftRef.current;
    const right = rightRef.current;
    if (!left || !right) return;

    isSyncingRight.current = true;
    requestAnimationFrame(() => {
      right.scrollTop = left.scrollTop;
      right.scrollLeft = left.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingRight.current = false;
      });
    });
  };

  const handleRightScroll = (e: UIEvent<HTMLDivElement>) => {
    if (!syncScroll || isSyncingRight.current) return;
    const left = leftRef.current;
    const right = rightRef.current;
    if (!left || !right) return;

    isSyncingLeft.current = true;
    requestAnimationFrame(() => {
      left.scrollTop = right.scrollTop;
      left.scrollLeft = right.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingLeft.current = false;
      });
    });
  };

  if (sheets.length === 0 || originalRows.length === 0) {
    return (
      <div className="spreadsheet-compare__empty">
        <FileSpreadsheet size={24} />
        <span>此工作表為空白或未包含可顯示的儲存格資料。</span>
      </div>
    );
  }

  return (
    <div className="spreadsheet-compare rise-in">
      <div className="spreadsheet-compare__header">
        <div className="spreadsheet-compare__sheet-tabs" role="tablist" aria-label="工作表選單">
          {sheets.map((sheet, index) => (
            <button
              key={sheet.name + index}
              type="button"
              role="tab"
              aria-selected={activeSheetIndex === index}
              className={`spreadsheet-compare__sheet-tab ${activeSheetIndex === index ? "is-active" : ""}`}
              onClick={() => setActiveSheetIndex(index)}
            >
              <FileSpreadsheet size={14} />
              <span>{sheet.name || `工作表 ${index + 1}`}</span>
              <small>({sheet.rows.length} 列)</small>
            </button>
          ))}
        </div>

        <div className="spreadsheet-compare__controls">
          <span className="spreadsheet-compare__badge">
            <Sparkles size={13} />
            <span>已保護 <strong>{totalChangedCount}</strong> 處儲存格</span>
          </span>

          <button
            type="button"
            className={`diff-sync-toggle ${syncScroll ? "diff-sync-toggle--active" : ""}`}
            onClick={() => setSyncScroll((prev) => !prev)}
            title={syncScroll ? "已啟用雙欄同步滾動（點擊切換為獨立滾動）" : "已切換為獨立滾動（點擊啟用同步滾動）"}
            aria-pressed={syncScroll}
          >
            {syncScroll ? <Link2 size={13} /> : <Unlink2 size={13} />}
            <span>{syncScroll ? "同步滾動" : "獨立滾動"}</span>
          </button>
        </div>
      </div>

      {containsExistingTokens && (
        <div className="word-compare__warning-banner" role="alert">
          <AlertTriangle size={18} className="word-compare__warning-icon" />
          <div className="word-compare__warning-text">
            <strong>智慧提醒：偵測到此試算表原文已含有去識別化標記！</strong>
            <p>
              原始內容已包含 <code>[REGION]</code>、<code>[CUSTOM]</code> 或 <code>[NUMBER]</code> 等標記，這通常是因為<strong>選取到了先前下載的成果檔案</strong>（例如檔名帶有 <code>-local.xlsx</code>）。
              若要對比真正的處理前後差異，請返回「步驟 1：匯入來源」重新選取最初未遮蔽的原始試算表。
            </p>
          </div>
        </div>
      )}

      <div className="spreadsheet-compare__panes">

        {/* 左欄：原始試算表 */}
        <div className="spreadsheet-pane">
          <div className="spreadsheet-pane__title">
            <span className="diff-pane__marker diff-pane__marker--original" />
            <span>原始試算表</span>
            <small>處理前 · {originalRows.length} 列 × {maxCols} 欄</small>
          </div>
          <div
            className="spreadsheet-pane__table-container"
            ref={leftRef}
            onScroll={handleLeftScroll}
          >
            <table className="spreadsheet-grid">
              <thead>
                <tr>
                  <th className="spreadsheet-grid__corner">#</th>
                  {Array.from({ length: maxCols }).map((_, c) => (
                    <th key={`head-${c}`} className="spreadsheet-grid__col-header">
                      {getColumnLetter(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {originalRows.map((row, r) => (
                  <tr key={`orig-r-${r}`}>
                    <td className="spreadsheet-grid__row-header">{r + 1}</td>
                    {Array.from({ length: maxCols }).map((_, c) => {
                      const value = row[c] ?? "";
                      const isChanged = changedSet.has(`${r},${c}`);
                      return (
                        <td
                          key={`orig-c-${r}-${c}`}
                          className={`spreadsheet-grid__cell ${isChanged ? "is-redacted-origin" : ""}`}
                          title={isChanged ? `原始值：${value}` : undefined}
                        >
                          {value || <span className="spreadsheet-grid__cell--empty" />}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 右欄：去識別化試算表 */}
        <div className="spreadsheet-pane">
          <div className="spreadsheet-pane__title">
            <span className="diff-pane__marker diff-pane__marker--revised" />
            <span>去識別化試算表</span>
            <small>處理後 · 已替換個資</small>
          </div>
          <div
            className="spreadsheet-pane__table-container"
            ref={rightRef}
            onScroll={handleRightScroll}
          >
            <table className="spreadsheet-grid">
              <thead>
                <tr>
                  <th className="spreadsheet-grid__corner">#</th>
                  {Array.from({ length: maxCols }).map((_, c) => (
                    <th key={`head-rev-${c}`} className="spreadsheet-grid__col-header">
                      {getColumnLetter(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deidentifiedRows.map((row, r) => (
                  <tr key={`rev-r-${r}`}>
                    <td className="spreadsheet-grid__row-header">{r + 1}</td>
                    {Array.from({ length: maxCols }).map((_, c) => {
                      const value = row[c] ?? "";
                      const isChanged = changedSet.has(`${r},${c}`);
                      return (
                        <td
                          key={`rev-c-${r}-${c}`}
                          className={`spreadsheet-grid__cell ${isChanged ? "is-redacted-cell" : ""}`}
                          title={isChanged ? `去識別化後：${value}` : undefined}
                        >
                          {isChanged ? (
                            <span className="spreadsheet-redacted-badge">{value}</span>
                          ) : (
                            value || <span className="spreadsheet-grid__cell--empty" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
