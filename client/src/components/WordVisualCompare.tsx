import { useMemo, useRef, useState, type UIEvent } from "react";
import { AlertTriangle, FileText, Link2, Sparkles, Unlink2 } from "lucide-react";
import { type RuleId, deidentifyText, hasRedactionTokens } from "@/lib/deidentify";

type WordVisualCompareProps = {
  html: string;
  enabledRules: RuleId[];
  customTerms: string[];
};

const TOKEN_REGEX = /(\[(?:NAME|PHONE|EMAIL|ID_NUMBER|UNIFORM_NUMBER|AMOUNT|NUMBER|DATE|IP_ADDRESS|ADDRESS|PLACE_NAME|REGION|COMPANY_NAME|CUSTOMER_NAME|CONTACT_NAME|CUSTOM)\])/g;


function transformHtmlToDeidentified(
  rawHtml: string,
  enabledRules: RuleId[],
  customTerms: string[],
): { html: string; totalChanges: number } {
  if (typeof window === "undefined" || !rawHtml) {
    return { html: rawHtml || "", totalChanges: 0 };
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, "text/html");
    let totalChanges = 0;

    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let current: Node | null;
    while ((current = walker.nextNode())) {
      if (current.nodeType === Node.TEXT_NODE && current.nodeValue?.trim()) {
        textNodes.push(current as Text);
      }
    }

    for (const textNode of textNodes) {
      const originalText = textNode.nodeValue || "";
      const result = deidentifyText(originalText, enabledRules, customTerms);
      if (result.text !== originalText) {
        totalChanges += result.total;
        const fragment = doc.createDocumentFragment();
        const parts = result.text.split(TOKEN_REGEX);
        for (const part of parts) {
          if (TOKEN_REGEX.test(part)) {
            const mark = doc.createElement("mark");
            mark.className = "diff-token diff-token--added word-redacted-mark";
            mark.textContent = part;
            fragment.appendChild(mark);
          } else if (part) {
            fragment.appendChild(doc.createTextNode(part));
          }
        }
        textNode.replaceWith(fragment);
      }
    }

    return { html: doc.body.innerHTML, totalChanges };
  } catch {
    return { html: rawHtml, totalChanges: 0 };
  }
}

export default function WordVisualCompare({
  html,
  enabledRules,
  customTerms,
}: WordVisualCompareProps) {
  const [syncScroll, setSyncScroll] = useState(true);

  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const isSyncingLeft = useRef(false);
  const isSyncingRight = useRef(false);

  const containsExistingTokens = useMemo(() => hasRedactionTokens(html), [html]);

  const { deidentifiedHtml, changeCount } = useMemo(() => {
    const { html: revised, totalChanges } = transformHtmlToDeidentified(html, enabledRules, customTerms);
    return { deidentifiedHtml: revised, changeCount: totalChanges };
  }, [html, enabledRules, customTerms]);


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

  if (!html) {
    return (
      <div className="spreadsheet-compare__empty">
        <FileText size={24} />
        <span>此 Word 文件為空白或未包含可解析的排版內容。</span>
      </div>
    );
  }

  return (
    <div className="word-compare rise-in">
      <div className="word-compare__header">
        <div className="word-compare__info">
          <FileText size={15} />
          <span>Word 文件排版原樣對照</span>
          <small>（保留表格、格線、粗體與標題結構）</small>
        </div>

        <div className="word-compare__controls">
          <span className="spreadsheet-compare__badge">
            <Sparkles size={13} />
            <span>已保護 <strong>{changeCount}</strong> 處內容</span>
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
            <strong>智慧提醒：偵測到此文件原文已含有去識別化標記！</strong>
            <p>
              原始文件內已包含 <code>[REGION]</code>、<code>[CUSTOM]</code> 或 <code>[NUMBER]</code> 等標記，這通常是因為<strong>選取到了先前下載的去識別化成果檔案</strong>（例如檔名帶有 <code>-local.docx</code>）。
              若要對比真正的處理前後差異，請返回「步驟 1：匯入來源」重新選取最初未遮蔽的原始文件。
            </p>
          </div>
        </div>
      )}

      <div className="word-compare__panes">

        {/* 左欄：原始 Word 文件排版 */}
        <div className="word-pane">
          <div className="word-pane__title">
            <span className="diff-pane__marker diff-pane__marker--original" />
            <span>原始 Word 排版</span>
            <small>處理前 · 完整文件結構</small>
          </div>
          <div
            className="word-pane__content"
            ref={leftRef}
            onScroll={handleLeftScroll}
          >
            <div
              className="word-document-sheet"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        </div>

        {/* 右欄：去識別化 Word 文件排版 */}
        <div className="word-pane">
          <div className="word-pane__title">
            <span className="diff-pane__marker diff-pane__marker--revised" />
            <span>去識別化 Word 排版</span>
            <small>處理後 · 已高亮標示遮蔽項目</small>
          </div>
          <div
            className="word-pane__content"
            ref={rightRef}
            onScroll={handleRightScroll}
          >
            <div
              className="word-document-sheet word-document-sheet--revised"
              dangerouslySetInnerHTML={{ __html: deidentifiedHtml }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
