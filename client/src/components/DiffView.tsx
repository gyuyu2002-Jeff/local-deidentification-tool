/* Design philosophy: quiet archival utility — make every replacement visible without overwhelming the source text. */

import { diffWordsWithSpace, type Change } from "diff";
import { ArrowRight, Eye, FileDiff, Link2, Unlink2, X } from "lucide-react";
import { useRef, useState, type UIEvent } from "react";

type DiffViewProps = {
  original: string;
  revised: string;
  onClose: () => void;
};

function OriginalPane({
  changes,
  contentRef,
  onScroll,
}: {
  changes: Change[];
  contentRef: React.RefObject<HTMLParagraphElement | null>;
  onScroll: (e: UIEvent<HTMLParagraphElement>) => void;
}) {
  return (
    <div className="diff-pane">
      <div className="diff-pane__heading">
        <span className="diff-pane__marker diff-pane__marker--original" />
        <span>原始文字</span>
        <small>處理前</small>
      </div>
      <p className="diff-pane__content" ref={contentRef} onScroll={onScroll}>
        {changes.map((change, index) =>
          change.added ? null : (
            <span
              className={change.removed ? "diff-token diff-token--removed" : "diff-token diff-token--unchanged"}
              title={change.removed ? "原文中被移除或遮蔽的內容" : undefined}
              key={`original-${index}`}
            >
              {change.value}
            </span>
          ),
        )}
      </p>
    </div>
  );
}

function RevisedPane({
  changes,
  contentRef,
  onScroll,
}: {
  changes: Change[];
  contentRef: React.RefObject<HTMLParagraphElement | null>;
  onScroll: (e: UIEvent<HTMLParagraphElement>) => void;
}) {
  return (
    <div className="diff-pane">
      <div className="diff-pane__heading">
        <span className="diff-pane__marker diff-pane__marker--revised" />
        <span>去識別化結果</span>
        <small>處理後</small>
      </div>
      <p className="diff-pane__content" ref={contentRef} onScroll={onScroll}>
        {changes.map((change, index) =>
          change.removed ? null : (
            <span
              className={change.added ? "diff-token diff-token--added" : "diff-token diff-token--unchanged"}
              title={change.added ? "結果中新增的替換標記" : undefined}
              key={`revised-${index}`}
            >
              {change.value}
            </span>
          ),
        )}
      </p>
    </div>
  );
}

export default function DiffView({ original, revised, onClose }: DiffViewProps) {
  const changes = diffWordsWithSpace(original, revised);
  const removedSegments = changes.filter((change) => change.removed).length;
  const addedSegments = changes.filter((change) => change.added).length;
  const replacementSegments = changes.reduce((count, change, index) => {
    const next = changes[index + 1];
    return count + (change.removed && next?.added ? 1 : 0);
  }, 0);
  const changedSegments = removedSegments + addedSegments;

  const [syncScroll, setSyncScroll] = useState(true);
  const leftRef = useRef<HTMLParagraphElement | null>(null);
  const rightRef = useRef<HTMLParagraphElement | null>(null);
  const isSyncingLeft = useRef(false);
  const isSyncingRight = useRef(false);

  const handleLeftScroll = () => {
    if (!syncScroll || isSyncingLeft.current) return;
    const left = leftRef.current;
    const right = rightRef.current;
    if (!left || !right) return;

    isSyncingRight.current = true;
    const maxLeftY = left.scrollHeight - left.clientHeight;
    const maxRightY = right.scrollHeight - right.clientHeight;
    if (maxLeftY > 0 && maxRightY > 0) {
      right.scrollTop = (left.scrollTop / maxLeftY) * maxRightY;
    } else {
      right.scrollTop = left.scrollTop;
    }

    const maxLeftX = left.scrollWidth - left.clientWidth;
    const maxRightX = right.scrollWidth - right.clientWidth;
    if (maxLeftX > 0 && maxRightX > 0) {
      right.scrollLeft = (left.scrollLeft / maxLeftX) * maxRightX;
    }

    window.requestAnimationFrame(() => {
      isSyncingRight.current = false;
    });
  };

  const handleRightScroll = () => {
    if (!syncScroll || isSyncingRight.current) return;
    const left = leftRef.current;
    const right = rightRef.current;
    if (!left || !right) return;

    isSyncingLeft.current = true;
    const maxLeftY = left.scrollHeight - left.clientHeight;
    const maxRightY = right.scrollHeight - right.clientHeight;
    if (maxLeftY > 0 && maxRightY > 0) {
      left.scrollTop = (right.scrollTop / maxRightY) * maxLeftY;
    } else {
      left.scrollTop = right.scrollTop;
    }

    const maxLeftX = left.scrollWidth - left.clientWidth;
    const maxRightX = right.scrollWidth - right.clientWidth;
    if (maxLeftX > 0 && maxRightX > 0) {
      left.scrollLeft = (right.scrollLeft / maxRightX) * maxLeftX;
    }

    window.requestAnimationFrame(() => {
      isSyncingLeft.current = false;
    });
  };

  return (
    <section className="diff-card rise-in" aria-label="原文與結果差異檢視">
      <div className="diff-card__toolbar">
        <div className="diff-card__title">
          <span className="section-index section-index--amber">
            <FileDiff size={13} />
          </span>
          <span>差異檢視</span>
          <span className="diff-card__meta">
            <Eye size={13} /> {changedSegments} 個變更片段 · {replacementSegments} 組替換
          </span>
        </div>
        <div className="diff-card__toolbar-actions">
          <button
            type="button"
            className={`text-button ${syncScroll ? "" : "text-button--quiet"}`}
            onClick={() => setSyncScroll((s) => !s)}
            title={syncScroll ? "點擊切換為獨立滾動" : "點擊切換為同步滾動"}
            aria-pressed={syncScroll}
          >
            {syncScroll ? <Link2 size={13} /> : <Unlink2 size={13} />}
            <span>{syncScroll ? "雙欄同步滾動中" : "獨立滾動"}</span>
          </button>
          <button className="text-button text-button--quiet" onClick={onClose}>
            <X size={14} /> 關閉檢視
          </button>
        </div>
      </div>
      <div className="diff-card__legend">
        <span>
          <i className="legend-swatch legend-swatch--unchanged" /> 保留內容
        </span>
        <span>
          <i className="legend-swatch legend-swatch--removed" /> 原文中被移除或遮蔽
        </span>
        <ArrowRight size={14} />
        <span>
          <i className="legend-swatch legend-swatch--added" /> 結果中新增的替換標記
        </span>
      </div>
      <div className="diff-grid">
        <OriginalPane changes={changes} contentRef={leftRef} onScroll={handleLeftScroll} />
        <RevisedPane changes={changes} contentRef={rightRef} onScroll={handleRightScroll} />
      </div>
    </section>
  );
}
