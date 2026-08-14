/* Design philosophy: quiet archival utility — asymmetrical workbench, restrained ink-green, amber audit marks. */

import { useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  Check,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  FileCheck2,
  FileText,
  Fingerprint,
  FolderOpen,
  Info,
  LockKeyhole,
  Menu,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  countCharacters,
  DEFAULT_RULES,
  deidentifyText,
  type RuleId,
} from "@/lib/deidentify";

const EXAMPLE_TEXT = `客戶聯絡人：王小明
Email：ming.wang@example.com
電話：0912-345-678
身分證字號：A123456789
預約日期：2026-08-14
連線來源：192.168.1.24`;

type Step = "source" | "rules" | "result";

function LocalMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`local-mark ${compact ? "local-mark--compact" : ""}`}>
      <span className="local-mark__glyph" aria-hidden="true">
        <span />
        <span />
      </span>
      <span>
        <strong>LOCAL</strong>
        {!compact && <small>資料只在本機處理</small>}
      </span>
    </div>
  );
}

function StepRail({ activeStep }: { activeStep: Step }) {
  const steps: { id: Step; number: string; label: string; hint: string }[] = [
    { id: "source", number: "01", label: "放入資料", hint: "貼上或讀取檔案" },
    { id: "rules", number: "02", label: "選擇規則", hint: "確認要遮蔽的內容" },
    { id: "result", number: "03", label: "檢查結果", hint: "下載去識別化檔案" },
  ];
  const activeIndex = steps.findIndex((step) => step.id === activeStep);

  return (
    <aside className="step-rail" aria-label="去識別化流程">
      <div className="step-rail__heading">
        <span className="eyebrow">WORKFLOW</span>
        <span className="rail-index">{String(activeIndex + 1).padStart(2, "0")} / 03</span>
      </div>
      <div className="step-rail__line" aria-hidden="true" />
      <nav>
        {steps.map((step, index) => {
          const isActive = activeStep === step.id;
          const isDone = activeIndex > index;
          return (
            <div className={`rail-step ${isActive ? "rail-step--active" : ""} ${isDone ? "rail-step--done" : ""}`} key={step.id}>
              <span className="rail-step__number">{isDone ? <Check size={14} /> : step.number}</span>
              <span className="rail-step__copy">
                <strong>{step.label}</strong>
                <small>{step.hint}</small>
              </span>
              {isActive && <ChevronRight className="rail-step__arrow" size={17} />}
            </div>
          );
        })}
      </nav>
      <div className="step-rail__footer">
        <LockKeyhole size={16} />
        <p><strong>本機模式</strong><br />不建立雲端副本，不傳送原文。</p>
      </div>
    </aside>
  );
}

function PrivacyPanel() {
  return (
    <section className="privacy-panel" aria-label="隱私狀態">
      <div className="privacy-panel__topline">
        <span className="status-dot" />
        <span>PRIVATE BY DEFAULT</span>
      </div>
      <h2>資料不離開這台裝置。</h2>
      <p>所有比對與替換都在瀏覽器記憶體中執行。關閉頁面或按下清除後，工作區內容就不再保留。</p>
      <div className="privacy-panel__list">
        <span><CheckCircle2 size={15} /> 不使用後端 API</span>
        <span><CheckCircle2 size={15} /> 不儲存原始文字</span>
        <span><CheckCircle2 size={15} /> 可隨時清除工作區</span>
      </div>
    </section>
  );
}

export default function Home() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [activeStep, setActiveStep] = useState<Step>("source");
  const [enabledRules, setEnabledRules] = useState<RuleId[]>(DEFAULT_RULES.map((rule) => rule.id));
  const [customTerms, setCustomTerms] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [fileName, setFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const analysis = useMemo(
    () => deidentifyText(input, enabledRules, customTerms),
    [input, enabledRules, customTerms],
  );
  const resultStats = useMemo(
    () => deidentifyText(input, enabledRules, customTerms),
    [input, enabledRules, customTerms],
  );

  const processText = () => {
    if (!input.trim()) {
      toast.error("請先放入一段文字或讀取檔案。");
      return;
    }
    const next = deidentifyText(input, enabledRules, customTerms);
    setResult(next.text);
    setActiveStep("result");
    toast.success(`已完成 ${next.total} 處替換，原文仍只存在本機。`);
  };

  const handleFile = (file?: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("目前限制單一檔案不超過 10 MB。");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setInput(String(reader.result ?? ""));
      setFileName(file.name);
      setResult("");
      setActiveStep("rules");
      toast.success(`已在本機讀取 ${file.name}。`);
    };
    reader.onerror = () => toast.error("檔案讀取失敗，請改用文字貼上或重新選取。");
    reader.readAsText(file);
  };

  const toggleRule = (id: RuleId) => {
    setEnabledRules((current) => current.includes(id) ? current.filter((ruleId) => ruleId !== id) : [...current, id]);
    setResult("");
  };

  const addCustomTerm = () => {
    const terms = customInput.split(/[,，\n]/).map((term) => term.trim()).filter(Boolean);
    if (!terms.length) return;
    setCustomTerms((current) => Array.from(new Set([...current, ...terms])));
    setCustomInput("");
    setResult("");
  };

  const clearWorkspace = () => {
    setInput("");
    setResult("");
    setFileName("");
    setCustomInput("");
    setCustomTerms([]);
    setActiveStep("source");
    setCopied(false);
    toast.success("工作區已清除，未留下原始資料。");
  };

  const copyResult = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
    toast.success("去識別化結果已複製到剪貼簿。");
  };

  const downloadResult = () => {
    if (!result) return;
    const blob = new Blob([result], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName.replace(/\.[^.]+$/, "") || "deidentified"}-local.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("檔案已由本機產生並準備下載。");
  };

  const loadExample = () => {
    setInput(EXAMPLE_TEXT);
    setFileName("");
    setResult("");
    setActiveStep("rules");
    toast.success("已載入範例資料；這段內容只用於展示介面。");
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar__brand"><LocalMark /></div>
        <div className="topbar__context">
          <span className="topbar__rule" />
          <span>DE-IDENTIFICATION WORKBENCH</span>
        </div>
        <div className="topbar__actions">
          <div className="secure-pill"><ShieldCheck size={15} /> <span>LOCAL ONLY</span></div>
          <button className="icon-button menu-trigger" onClick={() => setMenuOpen((open) => !open)} aria-label="開啟選單" aria-expanded={menuOpen}>
            <Menu size={20} />
          </button>
          {menuOpen && (
            <div className="menu-popover">
              <button onClick={clearWorkspace}><Trash2 size={15} /> 清除工作區</button>
              <button onClick={() => toast.info("目前版本不會將資料寫入瀏覽器儲存空間。試算完成後可直接關閉頁面。")}><Info size={15} /> 儲存說明</button>
            </div>
          )}
        </div>
      </header>

      <main className="workspace">
        <StepRail activeStep={activeStep} />

        <section className="workbench">
          <div className="workbench__intro rise-in">
            <div>
              <span className="eyebrow">01 / LOCAL REDACTION</span>
              <h1>讓敏感內容<br /><em>留在原地。</em></h1>
            </div>
            <p className="intro-note">貼上文字或讀取檔案，選定規則後在此裝置完成去識別化。<br />不需要登入，也不需要將資料交給第三方服務。</p>
          </div>

          <div className="editor-card rise-in" style={{ animationDelay: "70ms" }}>
            <div className="editor-card__header">
              <div className="editor-card__title"><span className="section-index">A</span><span>原始資料</span></div>
              <div className="editor-card__tools">
                <button className="text-button" onClick={loadExample}><Sparkles size={14} /> 載入範例</button>
                <button className="text-button text-button--quiet" onClick={clearWorkspace}><RotateCcw size={14} /> 重設</button>
              </div>
            </div>
            <div
              className={`input-zone ${isDragging ? "input-zone--dragging" : ""}`}
              onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => { event.preventDefault(); setIsDragging(false); handleFile(event.dataTransfer.files?.[0]); }}
            >
              <textarea
                value={input}
                onChange={(event) => { setInput(event.target.value); setResult(""); setActiveStep(event.target.value ? "rules" : "source"); }}
                placeholder="將需要處理的文字貼到這裡…"
                aria-label="原始資料輸入區"
              />
              {!input && (
                <div className="input-zone__empty">
                  <div className="empty-icon"><FileText size={21} /></div>
                  <strong>尚未放入資料</strong>
                  <span>支援貼上文字，或拖曳 TXT / CSV / JSON 檔案到此處</span>
                  <button className="upload-button" onClick={() => fileInputRef.current?.click()}><Upload size={15} /> 選取檔案</button>
                  <input ref={fileInputRef} type="file" accept=".txt,.csv,.json,text/plain,text/csv,application/json" onChange={(event) => handleFile(event.target.files?.[0])} hidden />
                </div>
              )}
            </div>
            <div className="editor-card__footer">
              <span>{fileName ? <><FolderOpen size={14} /> {fileName}</> : <><LockKeyhole size={14} /> 只在瀏覽器記憶體中處理</>}</span>
              <span>{countCharacters(input)} 字元</span>
            </div>
          </div>

          <div className="rules-section rise-in" style={{ animationDelay: "140ms" }}>
            <div className="section-heading">
              <div><span className="section-index">B</span><h2>去識別化規則</h2></div>
              <span className="rule-count">{enabledRules.length} / {DEFAULT_RULES.length} 啟用</span>
            </div>
            <div className="rule-grid">
              {DEFAULT_RULES.map((rule) => {
                const enabled = enabledRules.includes(rule.id);
                return (
                  <button className={`rule-card ${enabled ? "rule-card--enabled" : ""}`} key={rule.id} onClick={() => toggleRule(rule.id)} aria-pressed={enabled}>
                    <span className="rule-card__icon">{rule.id === "email" ? "@" : rule.id === "phone" ? "☎" : rule.id === "taiwanId" ? "ID" : rule.id === "date" ? "D" : "IP"}</span>
                    <span className="rule-card__text"><strong>{rule.label}</strong><small>{rule.detail}</small></span>
                    <span className="rule-card__check">{enabled ? <Check size={13} /> : <span />}</span>
                  </button>
                );
              })}
            </div>
            <div className="custom-rule">
              <div className="custom-rule__label"><Fingerprint size={17} /><span><strong>自訂關鍵字</strong><small>例如：專案名稱、內部代號、客戶姓名</small></span></div>
              <div className="custom-rule__input"><input value={customInput} onChange={(event) => setCustomInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addCustomTerm(); }} placeholder="輸入後按 Enter，可用逗號分隔" /><button onClick={addCustomTerm} aria-label="新增自訂關鍵字">新增</button></div>
              {customTerms.length > 0 && <div className="term-list">{customTerms.map((term) => <span key={term}>{term}<button onClick={() => setCustomTerms((current) => current.filter((item) => item !== term))} aria-label={`移除 ${term}`}><X size={12} /></button></span>)}</div>}
            </div>
            <div className="action-row"><span className="action-row__hint"><ScanLine size={16} /> {input ? "規則會在本機即時比對，執行前可隨時調整。" : "放入資料後即可開始設定規則。"}</span><button className="primary-button" onClick={processText} disabled={!input.trim()}><FileCheck2 size={17} /> 執行去識別化 <ChevronRight size={16} /></button></div>
          </div>

          {result && (
            <div className="result-card rise-in">
              <div className="result-card__header"><div className="editor-card__title"><span className="section-index section-index--amber">C</span><span>處理結果</span><span className="done-label"><CheckCircle2 size={14} /> 已完成</span></div><div className="result-card__actions"><button className="text-button" onClick={copyResult}>{copied ? <Check size={14} /> : <Clipboard size={14} />} {copied ? "已複製" : "複製結果"}</button><button className="download-button" onClick={downloadResult}><ArrowDownToLine size={15} /> 下載 TXT</button></div></div>
              <pre className="result-preview">{result}</pre>
              <div className="result-summary"><span><strong>{resultStats.total}</strong> 處內容已替換</span><span>輸入 {countCharacters(input)} 字元</span><span>輸出 {countCharacters(result)} 字元</span></div>
            </div>
          )}
        </section>

        <aside className="status-column">
          <PrivacyPanel />
          <section className="stats-panel">
            <div className="stats-panel__label"><span className="eyebrow">SESSION NOTES</span><span className="status-line" /></div>
            <div className="stat-row"><span>目前工作區</span><strong>{input ? "已載入" : "空白"}</strong></div>
            <div className="stat-row"><span>啟用規則</span><strong>{enabledRules.length} 項</strong></div>
            <div className="stat-row"><span>已找到項目</span><strong className="amber-text">{analysis.total}</strong></div>
            <div className="stat-row"><span>原文上傳</span><strong className="green-text">否</strong></div>
          </section>
          <section className="tip-panel"><div className="tip-panel__mark">/ / /</div><p>去識別化是降低風險，不是取代人工判斷。匯出前請檢查結果，確認沒有遺漏需要遮蔽的內容。</p><span>使用提醒 · 0001</span></section>
        </aside>
      </main>
      <footer className="site-footer"><span>LOCAL DE-ID WORKBENCH</span><span>本機處理 · 無雲端副本 · 可檢查的替換</span><span>v0.1 / 2026</span></footer>
    </div>
  );
}

