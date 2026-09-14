/* Design philosophy: quiet archival utility — asymmetrical workbench, restrained ink-green, amber audit marks. */

// 設計提醒：沿用「安靜的資料保管庫」方向；本頁用檔案索引式流程、克制的琥珀狀態色與清楚的本機資料邊界建立信任。

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  Cookie as CookieIcon,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  FileCheck2,
  FileDiff,
  FileOutput,
  FileSpreadsheet,
  FileText,
  FileType2,
  Fingerprint,
  FolderOpen,
  Info,
  LoaderCircle,
  LockKeyhole,
  Menu,
  Maximize2,
  Minimize2,
  Monitor,
  Moon,
  Pencil,
  Redo2,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  Type,
  Trash2,
  Undo2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
  Sun,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import AdSlot from "@/components/AdSlot";
import ConsentBanner from "@/components/ConsentBanner";
import DiffView from "@/components/DiffView";
import PdfVisualCompare from "@/components/PdfVisualCompare";
import { useReadingMode, type ReadingMode } from "@/contexts/ReadingModeContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  downloadTextResult,
  exportPdf,
  exportSpreadsheet,
  exportWord,
  DocumentParseCancelledError,
  parseDocument,
  type DocumentParseProgress,
  type ParsedDocument,
} from "@/lib/documents";
import {
  countCharacters,
  DEFAULT_RULES,
  deidentifyText,
  type RuleId,
} from "@/lib/deidentify";
import { downloadCustomDictionary, parseCustomDictionary } from "@/lib/custom-dictionary";
import {
  createPdfReviewHistory,
  recordPdfReviewState,
  redoPdfReviewHistory,
  undoPdfReviewHistory,
  DEFAULT_PDF_REDACTION_COLOR,
  PDF_REDACTION_COLORS,
  type PdfRedactionColor,
} from "@/lib/pdf-redactions";

const EXAMPLE_TEXT = `客戶聯絡人：王小明
Email：ming.wang@example.com
電話：0912-345-678
身分證字號：A123456789
預約日期：2026-08-14
寄送地址：桃園市桃園區中正路100號5樓
會議地點：台北101
服務區域：北部地區
連線來源：192.168.1.24
公司統一編號：04595257
合約金額：125,000.50`;

const ALL_RULE_IDS = DEFAULT_RULES.map((rule) => rule.id);
const READING_MODE_OPTIONS: { id: ReadingMode; label: string; shortLabel: string }[] = [
  { id: "standard", label: "標準", shortLabel: "標" },
  { id: "comfortable", label: "舒適", shortLabel: "舒" },
  { id: "large", label: "大字", shortLabel: "大" },
];
const PDF_TEXT_SIZE_OPTIONS = [
  { id: "standard", label: "標準", scale: 1 },
  { id: "comfortable", label: "舒適", scale: 1.13 },
  { id: "large", label: "大字", scale: 1.26 },
] as const;

type RuleGroupId = "location" | "identity" | "contact" | "signals";

const RULE_GROUPS: { id: RuleGroupId; label: string; detail: string; ruleIds: RuleId[] }[] = [
  { id: "location", label: "位置資訊", detail: "地址、地名與區域", ruleIds: ["address", "placeName", "region"] },
  { id: "identity", label: "身分識別", detail: "公司、客戶、聯絡人與統編", ruleIds: ["companyName", "customerName", "contactName", "name", "taiwanId", "uniformNumber"] },
  { id: "contact", label: "聯絡資訊", detail: "電子郵件與電話", ruleIds: ["email", "phone"] },
  { id: "signals", label: "時間與技術訊號", detail: "日期、IP 與數字", ruleIds: ["date", "ip", "number"] },
];

const RULE_ICONS: Record<RuleId, string> = {
  address: "⌂",
  placeName: "地",
  region: "區",
  companyName: "司",
  customerName: "客",
  contactName: "聯",
  name: "名",
  taiwanId: "ID",
  uniformNumber: "統",
  email: "@",
  phone: "☎",
  date: "D",
  ip: "IP",
  number: "#",
};

type Step = "source" | "rules" | "review" | "download";

function LocalMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`local-mark ${compact ? "local-mark--compact" : ""}`}>
      <span className="local-mark__glyph" aria-hidden="true">
        <span />
        <span />
      </span>
      <span>
        <strong className="brand-wordmark">無意識</strong>
        {!compact && <small>去識別化工作站</small>}
      </span>
    </div>
  );
}

function StepRail({
  activeStep,
  onSelectStep,
  canNavigateToStep,
  viewMode,
  onToggleViewMode,
}: {
  activeStep: Step;
  onSelectStep: (step: Step) => void;
  canNavigateToStep: (step: Step) => boolean;
  viewMode: "wizard" | "all";
  onToggleViewMode: (mode: "wizard" | "all") => void;
}) {
  const steps: { id: Step; number: string; label: string; hint: string }[] = [
    { id: "source", number: "01", label: "放入資料", hint: "貼上或讀取檔案" },
    { id: "rules", number: "02", label: "選擇規則", hint: "確認要遮蔽的內容" },
    { id: "review", number: "03", label: "檢查遮罩", hint: "確認替換與版面" },
    { id: "download", number: "04", label: "下載輸出", hint: "在本機產生結果檔" },
  ];
  const activeIndex = steps.findIndex((step) => step.id === activeStep);

  return (
    <aside className="step-rail" aria-label="去識別化流程">
      <div className="step-rail__heading">
        <span className="eyebrow">WORKFLOW</span>
        <span className="rail-index">{String(activeIndex + 1).padStart(2, "0")} / 04</span>
      </div>
      <div className="step-rail__line" aria-hidden="true" />
      <nav>
        {steps.map((step, index) => {
          const isActive = activeStep === step.id;
          const isDone = activeIndex > index;
          const isAccessible = canNavigateToStep(step.id);
          return (
            <button
              type="button"
              className={`rail-step ${isActive ? "rail-step--active" : ""} ${isDone ? "rail-step--done" : ""} ${isAccessible ? "rail-step--clickable" : "rail-step--disabled"}`}
              key={step.id}
              onClick={() => onSelectStep(step.id)}
              disabled={!isAccessible}
              aria-current={isActive ? "step" : undefined}
              title={isAccessible ? `跳轉至步驟 ${step.number}：${step.label}` : "請先完成前置步驟以解鎖"}
            >
              <span className="rail-step__number">{isDone ? <Check size={14} /> : step.number}</span>
              <span className="rail-step__copy">
                <strong>{step.label}</strong>
                <small>{step.hint}</small>
              </span>
              {isActive && <ChevronRight className="rail-step__arrow" size={17} />}
            </button>
          );
        })}
      </nav>
      <div className="step-rail__view-mode" style={{ marginTop: "24px" }}>
        <span className="eyebrow">VIEW MODE</span>
        <div className="view-mode-toggle" style={{ marginTop: "8px", width: "100%", display: "flex" }}>
          <button
            type="button"
            className={`view-mode-toggle__btn ${viewMode === "wizard" ? "view-mode-toggle__btn--active" : ""}`}
            onClick={() => onToggleViewMode("wizard")}
            style={{ flex: 1, justifyContent: "center" }}
            title="一步一個頁面，專注目前步驟"
          >
            一步一頁
          </button>
          <button
            type="button"
            className={`view-mode-toggle__btn ${viewMode === "all" ? "view-mode-toggle__btn--active" : ""}`}
            onClick={() => onToggleViewMode("all")}
            style={{ flex: 1, justifyContent: "center" }}
            title="長頁面展開所有面板"
          >
            全部展開
          </button>
        </div>
      </div>
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
      <h2>無意識-去識別化說明</h2>
      <p>這是本工作站的資料邊界承諾：比對、替換與掃描 PDF OCR 都在瀏覽器記憶體中執行，不使用後端 API。關閉頁面或按下清除後，工作區內容就不再保留。</p>
      <div className="privacy-panel__list">
        <span><CheckCircle2 size={15} /> 不使用後端 API</span>
        <span><CheckCircle2 size={15} /> 不儲存原始文字</span>
        <span><CheckCircle2 size={15} /> OCR 在本機 Web Worker 執行</span>
        <span><CheckCircle2 size={15} /> 可隨時清除工作區</span>
      </div>
    </section>
  );
}

export default function Home() {
  const { readingMode, setReadingMode } = useReadingMode();
  const { theme, themePreference, setThemePreference, toggleTheme } = useTheme();
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [activeStep, setActiveStep] = useState<Step>("source");
  const [viewMode, setViewMode] = useState<"wizard" | "all">("wizard");
  const [reviewTab, setReviewTab] = useState<"diff" | "text">("diff");
  const [enabledRules, setEnabledRules] = useState<RuleId[]>(ALL_RULE_IDS);
  const [ruleSearch, setRuleSearch] = useState("");
  const [expandedRuleGroups, setExpandedRuleGroups] = useState<RuleGroupId[]>([]);
  const [customTerms, setCustomTerms] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [fileName, setFileName] = useState("");
  const [parsedDocument, setParsedDocument] = useState<ParsedDocument | null>(null);
  const [sourcePdfFile, setSourcePdfFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [parseProgress, setParseProgress] = useState<DocumentParseProgress | null>(null);
  const [parseError, setParseError] = useState("");
  const [showDiff, setShowDiff] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewPage, setPdfPreviewPage] = useState(1);
  const [pdfPreviewZoom, setPdfPreviewZoom] = useState(100);
  const [pdfPreviewTextSize, setPdfPreviewTextSize] = useState<(typeof PDF_TEXT_SIZE_OPTIONS)[number]["id"]>("standard");
  const [isPdfPreviewFullscreen, setIsPdfPreviewFullscreen] = useState(false);
  const [isPdfFocusReading, setIsPdfFocusReading] = useState(false);
  const [manualReviewMode, setManualReviewMode] = useState(false);
  const [selectedPdfRedactionColor, setSelectedPdfRedactionColor] = useState<PdfRedactionColor>(DEFAULT_PDF_REDACTION_COLOR);
  const [pdfReviewHistory, setPdfReviewHistory] = useState(() => createPdfReviewHistory());
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dictionaryInputRef = useRef<HTMLInputElement>(null);
  const parseControllerRef = useRef<AbortController | null>(null);
  const rulesSectionRef = useRef<HTMLElement>(null);
  const resultSectionRef = useRef<HTMLDivElement>(null);

  const analysis = useMemo(
    () => deidentifyText(input, enabledRules, customTerms),
    [input, enabledRules, customTerms],
  );
  const resultStats = useMemo(
    () => deidentifyText(input, enabledRules, customTerms),
    [input, enabledRules, customTerms],
  );
  const progressTitle = parseProgress?.phase === "preparing"
    ? "正在準備本機解析"
    : parseProgress?.phase === "ocr"
    ? "本機 OCR 辨識中"
    : parseProgress?.phase === "rendering"
      ? "正在準備掃描頁"
      : parseProgress?.phase === "complete"
        ? "PDF 解析完成"
        : "正在讀取 PDF";
  const progressPageLabel = parseProgress && parseProgress.totalPages > 0
    ? `第 ${parseProgress.currentPage} / ${parseProgress.totalPages} 頁`
    : "正在建立 PDF 工作區";
  const pdfPageCount = parsedDocument?.fileType === "pdf" ? Math.max(1, parsedDocument.pageCount ?? 1) : 1;
  const pdfReviewState = pdfReviewHistory.entries[pdfReviewHistory.index];
  const pdfPreviewTextScale = PDF_TEXT_SIZE_OPTIONS.find((option) => option.id === pdfPreviewTextSize)?.scale ?? 1;
  const isPdfImmersiveReading = isPdfPreviewFullscreen || isPdfFocusReading;
  const canUndoPdfReview = pdfReviewHistory.index > 0;
  const canRedoPdfReview = pdfReviewHistory.index < pdfReviewHistory.entries.length - 1;
  const sourcePageCount = Math.max(1, parsedDocument?.pageCount ?? 1);
  const manualRedactionCount = pdfReviewState.redactionEdits.filter((item) => item.origin === "manual").length;
  const sourceTypeLabel = parsedDocument?.fileType === "pdf"
    ? "PDF"
    : parsedDocument?.fileType === "xlsx"
      ? "Excel"
      : parsedDocument?.fileType === "docx"
        ? "Word"
        : input.trim()
          ? "文字內容"
          : "資料";
  const visibleRuleGroups = useMemo(() => {
    const query = ruleSearch.trim().toLocaleLowerCase("zh-TW");
    return RULE_GROUPS.map((group) => ({
      ...group,
      rules: DEFAULT_RULES.filter((rule) => group.ruleIds.includes(rule.id) && (!query || `${rule.label} ${rule.detail}`.toLocaleLowerCase("zh-TW").includes(query))),
    })).filter((group) => group.rules.length > 0);
  }, [ruleSearch]);

  const toggleRuleGroup = (groupId: RuleGroupId) => {
    setExpandedRuleGroups((current) => current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId]);
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreen = document.fullscreenElement?.id === "pdf-preview-dialog";
      setIsPdfPreviewFullscreen(isFullscreen);
      if (isFullscreen) setIsPdfFocusReading(false);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const updateKeyboardInset = () => {
      const keyboardInset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      document.documentElement.style.setProperty("--keyboard-inset", `${keyboardInset}px`);
    };
    updateKeyboardInset();
    viewport.addEventListener("resize", updateKeyboardInset);
    viewport.addEventListener("scroll", updateKeyboardInset);
    return () => {
      viewport.removeEventListener("resize", updateKeyboardInset);
      viewport.removeEventListener("scroll", updateKeyboardInset);
      document.documentElement.style.removeProperty("--keyboard-inset");
    };
  }, []);

  useEffect(() => {
    const handlePdfReviewShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!pdfPreviewOpen || !manualReviewMode || target?.closest("input, textarea, select, [contenteditable='true']") || !(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === "z") {
        event.preventDefault();
        setPdfReviewHistory((history) => event.shiftKey ? redoPdfReviewHistory(history) : undoPdfReviewHistory(history));
      } else if (key === "y") {
        event.preventDefault();
        setPdfReviewHistory((history) => redoPdfReviewHistory(history));
      }
    };
    window.addEventListener("keydown", handlePdfReviewShortcut);
    return () => window.removeEventListener("keydown", handlePdfReviewShortcut);
  }, [manualReviewMode, pdfPreviewOpen]);

  const processText = () => {
    if (!input.trim()) {
      toast.error("請先放入一段文字或讀取檔案。");
      return;
    }
    const next = deidentifyText(input, enabledRules, customTerms);
    setResult(next.text);
    setShowDiff(true);
    setReviewTab("diff");
    setActiveStep("review");
    if (viewMode === "all") {
      window.requestAnimationFrame(() => resultSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    toast.success(`已完成 ${next.total} 處替換，進入步驟 03 檢查遮罩。`);
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    const controller = new AbortController();
    parseControllerRef.current = controller;
    setIsParsing(true);
    setSourcePdfFile(null);
    setPdfReviewHistory(createPdfReviewHistory());
    setManualReviewMode(false);
    setIsCancelling(false);
    setParseError("");
    setParseProgress({ phase: "preparing", currentPage: 0, totalPages: 0, percent: 0, message: "正在準備本機解析", detail: `正在讀取 ${file.name}；掃描 PDF 會逐頁顯示 OCR 進度。` });
    try {
      const parsed = await parseDocument(file, { onProgress: setParseProgress, signal: controller.signal });
      setInput(parsed.text);
      setFileName(file.name);
      setParsedDocument(parsed);
      if (parsed.fileType === "pdf") setSourcePdfFile(file);
      setResult("");
      setShowDiff(false);
      setActiveStep("rules");
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast.success(`已在本機解析 ${file.name}，進入步驟 02 選擇規則。`);
    } catch (error) {
      if (error instanceof DocumentParseCancelledError) {
        const message = "已取消本機解析；原始文字尚未匯入工作區。";
        setParseError(message);
        toast.info(message);
      } else {
        const message = error instanceof Error ? error.message : "檔案解析失敗，請確認檔案格式。";
        setParseError(message);
        toast.error(message);
      }
    } finally {
      if (parseControllerRef.current === controller) parseControllerRef.current = null;
      setIsParsing(false);
      setIsCancelling(false);
      setParseProgress(null);
    }
  };

  const cancelParsing = () => {
    if (!parseControllerRef.current || !isParsing) return;
    setIsCancelling(true);
    parseControllerRef.current.abort();
  };

  const toggleRule = (id: RuleId) => {
    setEnabledRules((current) => current.includes(id) ? current.filter((ruleId) => ruleId !== id) : [...current, id]);
    setResult("");
    setActiveStep(input.trim() ? "rules" : "source");
  };

  const revealMobileInput = (element: HTMLElement) => {
    if (!window.matchMedia("(max-width: 720px)").matches) return;
    window.setTimeout(() => element.scrollIntoView({ block: "center", behavior: "smooth" }), 140);
  };

  const setAllRules = (enabled: boolean) => {
    setEnabledRules(enabled ? [...ALL_RULE_IDS] : []);
    setResult("");
    setActiveStep(input.trim() ? "rules" : "source");
    toast.info(enabled ? `已全選 ${DEFAULT_RULES.length} 項規則。` : "已全不選規則，請確認是否仍要執行去識別化。");
  };

  const addCustomTerm = () => {
    const terms = customInput.split(/[,，\n]/).map((term) => term.trim()).filter(Boolean);
    if (!terms.length) return;
    setCustomTerms((current) => Array.from(new Set([...current, ...terms])));
    setCustomInput("");
    setResult("");
    setActiveStep(input.trim() ? "rules" : "source");
  };

  const clearWorkspace = () => {
    parseControllerRef.current?.abort();
    setClearConfirmOpen(false);
    setInput("");
    setResult("");
    setFileName("");
    setParsedDocument(null);
    setSourcePdfFile(null);
    setParseError("");
    setParseProgress(null);
    setShowDiff(false);
    setPdfPreviewOpen(false);
    setPdfPreviewPage(1);
    setPdfPreviewZoom(100);
    setPdfPreviewTextSize("standard");
    setManualReviewMode(false);
    setPdfReviewHistory(createPdfReviewHistory());
    if (document.fullscreenElement) void document.exitFullscreen();
    setIsPdfExporting(false);
    setCustomInput("");
    setCustomTerms([]);
    setActiveStep("source");
    setCopied(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (dictionaryInputRef.current) dictionaryInputRef.current.value = "";
    toast.success("工作區已清除，未留下原始資料。");
  };

  const exportDictionary = () => {
    downloadCustomDictionary(customTerms);
    toast.success(`已匯出 ${customTerms.length} 個自訂關鍵字。`);
  };

  const importDictionary = async (file?: File) => {
    if (!file) return;
    try {
      const terms = parseCustomDictionary(await file.text());
      setCustomTerms(terms);
      setResult("");
      setActiveStep(input.trim() ? "rules" : "source");
      toast.success(`已在本機匯入 ${terms.length} 個自訂關鍵字，並取代目前字典。`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "字典匯入失敗，請確認 JSON 格式。");
    } finally {
      if (dictionaryInputRef.current) dictionaryInputRef.current.value = "";
    }
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
    const fileType = parsedDocument?.fileType ?? "text";
    if (fileType === "pdf") {
      setPdfPreviewPage(1);
      setPdfPreviewZoom(100);
      setPdfPreviewTextSize("standard");
      setIsPdfFocusReading(false);
      setActiveStep("review");
      setPdfPreviewOpen(true);
      return;
    }
    setActiveStep("download");
    const exportTask = fileType === "xlsx"
      ? exportSpreadsheet(result, fileName)
      : fileType === "docx"
        ? exportWord(result, fileName)
        : downloadTextResult(result, fileName);
    Promise.resolve(exportTask)
      .then(() => toast.success("結果已由本機產生並準備下載。"))
      .catch(() => toast.error("本機匯出失敗，請確認瀏覽器允許下載後再試一次。"));
  };

  const confirmPdfDownload = async () => {
    if (!result || isPdfExporting) return;
    setIsPdfExporting(true);
    try {
      await exportPdf(result, fileName, {
        sourcePdfFile,
        enabledRules,
        customTerms,
        redactionEdits: pdfReviewState.redactionEdits,
        hiddenRedactionIds: pdfReviewState.hiddenRedactionIds,
        selectedRedactionColor: selectedPdfRedactionColor,
      });
      setPdfPreviewOpen(false);
      setActiveStep("download");
      toast.success("PDF 已成功下載。", {
        description: "檔案已由本機產生，請至瀏覽器下載位置查看。",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PDF 匯出失敗，請確認瀏覽器允許下載後再試一次。");
    } finally {
      setIsPdfExporting(false);
    }
  };

  const togglePdfPreviewFullscreen = async () => {
    const dialog = document.getElementById("pdf-preview-dialog");
    if (!dialog) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (isPdfFocusReading) {
        setIsPdfFocusReading(false);
      } else if (document.fullscreenEnabled && dialog.requestFullscreen) {
        await dialog.requestFullscreen();
      } else {
        setIsPdfFocusReading(true);
        toast.info("已開啟專注閱讀模式。此瀏覽器會保留系統列，仍可獲得完整預覽空間。");
      }
    } catch {
      setIsPdfFocusReading(true);
      toast.info("已開啟專注閱讀模式。此瀏覽器不支援完整全螢幕，仍可在不受干擾的版面檢視 PDF。");
    }
  };

  const loadExample = () => {
    setInput(EXAMPLE_TEXT);
    setFileName("");
    setParsedDocument(null);
    setSourcePdfFile(null);
    setPdfReviewHistory(createPdfReviewHistory());
    setManualReviewMode(false);
    setParseError("");
    setParseProgress(null);
    setResult("");
    setShowDiff(false);
    setActiveStep("rules");
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.success("已載入範例資料，已切換至步驟 02 選擇規則。");
  };

  const continueToRules = () => {
    if (!input.trim()) return;
    setActiveStep("rules");
    if (viewMode === "all") {
      window.requestAnimationFrame(() => rulesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const isSourceReady = input.trim().length > 0 || parsedDocument !== null;
  const isReviewReady = result.trim().length > 0;

  const canNavigateToStep = (step: Step) => {
    switch (step) {
      case "source":
        return true;
      case "rules":
        return isSourceReady;
      case "review":
        return isSourceReady && isReviewReady;
      case "download":
        return isSourceReady && isReviewReady;
    }
  };

  const navigateToStep = (step: Step) => {
    if (!canNavigateToStep(step)) {
      if (step === "rules") {
        toast.info("請先在第一步放入文字或上傳文件。");
      } else {
        toast.info("請先執行去識別化，產生結果後再進入此步驟。");
      }
      return;
    }
    setActiveStep(step);
    if (viewMode === "all") {
      if (step === "source") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (step === "rules") {
        rulesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (step === "review") {
        if (sourcePdfFile) {
          setPdfPreviewPage(1);
          setPdfPreviewZoom(100);
          setPdfPreviewOpen(true);
        } else {
          resultSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      } else if (step === "download") {
        resultSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const renderSourceCard = () => (
    <div className="editor-card rise-in" style={{ animationDelay: "70ms" }}>
      <div className="editor-card__header">
        <div className="editor-card__title"><span className="section-index">A</span><span>原始資料</span></div>
        <div className="editor-card__tools">
          <button className="text-button" onClick={loadExample}><Sparkles size={14} /> 載入範例</button>
          <button className="text-button text-button--quiet clear-workspace-button" onClick={() => setClearConfirmOpen(true)} title="清除原文、結果、檔案資訊、OCR 狀態與自訂關鍵字"><Trash2 size={14} /> 清除工作區</button>
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
          onChange={(event) => { setInput(event.target.value); setResult(""); }}
          onFocus={(event) => revealMobileInput(event.currentTarget)}
          placeholder="將需要處理的文字貼到這裡…"
          aria-label="原始資料輸入區"
        />
        {!input && (
          <div className="input-zone__empty">
            <div className="empty-icon"><FileText size={21} /></div>
            <strong>尚未放入資料</strong>
            <span>支援 TXT、CSV、JSON、Excel、Word、PDF 與掃描 PDF</span>
            <button className="upload-button" onClick={() => fileInputRef.current?.click()} disabled={isParsing}>{isParsing ? <LoaderCircle className="spin" size={15} /> : <Upload size={15} />} {isParsing ? "本機解析中" : "選取檔案"}</button>
            <input ref={fileInputRef} type="file" accept=".txt,.csv,.json,.xlsx,.xls,.docx,.pdf,text/plain,text/csv,application/json,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => handleFile(event.target.files?.[0])} hidden />
          </div>
        )}
      </div>
      {isParsing && parseProgress && (
        <div className="ocr-progress" role="status" aria-live="polite">
          <div className="ocr-progress__header">
            <span className="ocr-progress__copy"><LoaderCircle className="spin" size={14} /><span><strong>{progressTitle}</strong><small>{parseProgress.message}</small></span></span>
            <span className="ocr-progress__controls"><span className="ocr-progress__percent">{parseProgress.percent}%</span><button className="text-button ocr-progress__cancel" onClick={cancelParsing} disabled={isCancelling}>{isCancelling ? "正在取消" : "取消處理"} <X size={13} /></button></span>
          </div>
          <div className="ocr-progress__meta"><span>{progressPageLabel}</span><span>{parseProgress.detail}</span></div>
          <div className="ocr-progress__track" role="progressbar" aria-label="PDF 本機 OCR 進度" aria-valuenow={parseProgress.percent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${parseProgress.percent}%` }} /></div>
        </div>
      )}
      <div className="editor-card__footer">
        <span>{fileName ? <><FolderOpen size={14} /> {fileName} {parsedDocument?.fileType === "xlsx" ? <FileSpreadsheet size={13} /> : parsedDocument?.fileType === "docx" ? <FileType2 size={13} /> : parsedDocument?.fileType === "pdf" ? <FileOutput size={13} /> : null}</> : <><LockKeyhole size={14} /> 只在瀏覽器記憶體中處理</>}</span>
        <span>{countCharacters(input)} 字元</span>
      </div>
      <div className="clear-scope-note"><Info size={13} /> 清除會移除工作區記憶體中的原文、結果、檔案資訊、OCR 狀態與自訂關鍵字；不影響已下載的結果檔。</div>
      {parseError && <div className={parseError.startsWith("已取消") ? "parse-warning parse-cancelled" : "parse-error"}><Info size={14} /> {parseError}</div>}
      {parsedDocument?.warnings.map((warning) => <div className={`parse-warning ${warning.includes("本機使用繁體中文 OCR") ? "parse-warning--ocr" : ""}`} key={warning}><Info size={14} /> {warning}</div>)}
    </div>
  );

  const renderRulesSection = () => (
    <section ref={rulesSectionRef} className="rules-section rise-in" style={{ animationDelay: "140ms" }}>
      <div className="section-heading">
        <div><span className="section-index">B</span><h2>去識別化規則</h2></div>
        <div className="section-heading__actions">
          <span className="rule-count">{enabledRules.length} / {DEFAULT_RULES.length} 啟用</span>
          <button className="text-button quick-toggle" onClick={() => setAllRules(true)} disabled={enabledRules.length === DEFAULT_RULES.length}>全選</button>
          <button className="text-button quick-toggle text-button--quiet" onClick={() => setAllRules(false)} disabled={enabledRules.length === 0}>全不選</button>
        </div>
      </div>
      <div className="rule-selector">
        <div className="rule-selector__toolbar">
          <label className="rule-search">
            <Search size={15} aria-hidden="true" />
            <span className="sr-only">搜尋去識別化規則</span>
            <input value={ruleSearch} onChange={(event) => setRuleSearch(event.target.value)} placeholder="搜尋規則，例如：姓名、電話、數字" />
            {ruleSearch && <button type="button" onClick={() => setRuleSearch("")} aria-label="清除規則搜尋"><X size={14} /></button>}
          </label>
          <span className="rule-selector__hint">可收合分組 · {visibleRuleGroups.reduce((total, group) => total + group.rules.length, 0)} 項可見</span>
        </div>
        <div className="rule-groups">
          {visibleRuleGroups.map((group) => {
            const expanded = ruleSearch.trim().length > 0 || expandedRuleGroups.includes(group.id);
            const enabledCount = group.ruleIds.filter((id) => enabledRules.includes(id)).length;
            const allEnabled = group.ruleIds.length > 0 && enabledCount === group.ruleIds.length;
            const partiallyEnabled = enabledCount > 0 && !allEnabled;
            return (
              <section className={`rule-group ${expanded ? "rule-group--expanded" : ""} ${allEnabled ? "rule-group--all-enabled" : ""} ${partiallyEnabled ? "rule-group--partial" : ""}`} key={group.id}>
                <button type="button" className="rule-group__toggle" onClick={() => toggleRuleGroup(group.id)} aria-expanded={expanded}>
                  <span className="rule-group__marker" aria-hidden="true">{allEnabled ? <Check size={8} strokeWidth={3} /> : partiallyEnabled ? <span className="rule-group__marker-dot" /> : null}</span>
                  <span className="rule-group__name"><strong>{group.label}</strong><small>{group.detail}</small></span>
                  <span className="rule-group__count">{enabledCount} / {group.ruleIds.length}</span>
                  <ChevronDown className="rule-group__chevron" size={15} aria-hidden="true" />
                </button>
                <div className={`rule-option-list ${expanded ? "rule-option-list--open" : ""}`} aria-hidden={!expanded}>
                  <div className="rule-option-list__inner">
                   {group.rules.map((rule) => {
                    const enabled = enabledRules.includes(rule.id);
                    return (
                      <button type="button" className={`rule-option ${enabled ? "rule-option--enabled" : ""}`} key={rule.id} onClick={() => toggleRule(rule.id)} aria-pressed={enabled}>
                        <span className="rule-option__icon" aria-hidden="true">{RULE_ICONS[rule.id]}</span>
                        <span className="rule-option__text"><strong>{rule.label}</strong><small>{rule.detail}</small></span>
                        <span className="rule-option__check" aria-hidden="true">{enabled ? <Check size={12} /> : <span />}</span>
                      </button>
                    );
                   })}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
        {visibleRuleGroups.length === 0 && <p className="rule-selector__empty">找不到相符規則，請改用其他關鍵字。</p>}
      </div>
      <div className="custom-rule">
        <div className="custom-rule__topline"><div className="custom-rule__label"><Fingerprint size={17} /><span><strong>自訂關鍵字</strong><small>例如：專案名稱、內部代號、客戶姓名</small></span></div><div className="custom-rule__dictionary-actions"><button className="text-button" onClick={exportDictionary} disabled={!customTerms.length}><ArrowDownToLine size={13} /> 匯出字典</button><button className="text-button text-button--quiet" onClick={() => dictionaryInputRef.current?.click()}><Upload size={13} /> 匯入字典</button><input ref={dictionaryInputRef} type="file" accept="application/json,.json" onChange={(event) => importDictionary(event.target.files?.[0])} hidden /></div></div>
        <div className="custom-rule__input"><input value={customInput} onChange={(event) => setCustomInput(event.target.value)} onFocus={(event) => revealMobileInput(event.currentTarget)} onKeyDown={(event) => { if (event.key === "Enter") addCustomTerm(); }} placeholder="輸入後按 Enter，可用逗號分隔" /><button onClick={addCustomTerm} aria-label="新增自訂關鍵字">新增</button></div>
        {customTerms.length > 0 && <div className="term-list">{customTerms.map((term) => <span key={term}>{term}<button onClick={() => { setCustomTerms((current) => current.filter((item) => item !== term)); setResult(""); }} aria-label={`移除 ${term}`}><X size={12} /></button></span>)}</div>}
      </div>
      <div className="workflow-execution-summary" aria-live="polite"><ShieldCheck size={15} /><span><strong>執行前摘要</strong> 已啟用 {enabledRules.length} 項規則{customTerms.length > 0 ? `，另有 ${customTerms.length} 個自訂關鍵字` : "，尚未加入自訂關鍵字"}。</span></div>
      {viewMode === "all" && (
        <div className="action-row"><span className="action-row__hint"><ScanLine size={16} /> {input ? "規則會在本機即時比對，執行前可隨時調整。" : "放入資料後即可開始設定規則。"}</span><span className="action-row__seal"><LockKeyhole size={13} /> LOCAL ONLY · 執行前確認</span><button className="primary-button" onClick={processText} disabled={!input.trim()}><FileCheck2 size={17} /> 已啟用 {enabledRules.length} 項規則 · 執行去識別化 <ChevronRight size={16} /></button></div>
      )}
    </section>
  );

  const renderReviewSection = () => (
    <div ref={resultSectionRef} className="result-card rise-in">
      <div className="result-card__header"><div className="editor-card__title"><span className="section-index section-index--amber">C</span><span>覆核結果</span><span className="done-label"><CheckCircle2 size={14} /> 已完成</span></div><div className="result-card__actions"><span className="result-seal"><LockKeyhole size={12} /> LOCAL ONLY · 匯出前可預覽</span><button className="text-button" onClick={copyResult}>{copied ? <Check size={14} /> : <Clipboard size={14} />} {copied ? "已複製" : "複製結果"}</button><button className="text-button" onClick={() => setShowDiff((open) => !open)}><FileDiff size={14} /> {showDiff ? "隱藏差異" : "查看差異"}</button></div></div>
      <div className="review-checklist" aria-label="覆核清單">
        <span><CheckCircle2 size={15} /><strong>已遮蔽 {resultStats.total} 處</strong><small>自動規則已套用</small></span>
        <span><Pencil size={15} /><strong>手動遮蔽 {manualRedactionCount} 處</strong><small>{sourcePdfFile ? "可在 PDF 預覽中新增或調整" : "此格式可直接檢查文字差異"}</small></span>
        <span><FileDiff size={15} /><strong>建議：{sourcePdfFile ? "開啟 PDF 預覽確認" : "查看差異確認"}</strong><small>確認無遺漏後再下載</small></span>
      </div>
      <pre className="result-preview">{result}</pre>
      <div className="result-summary"><span><strong>{resultStats.total}</strong> 處內容已替換</span><span>輸入 {countCharacters(input)} 字元</span><span>輸出 {countCharacters(result)} 字元</span></div>
      <section className="workflow-prompt workflow-prompt--review" aria-label={sourcePdfFile ? "下一步：開啟 PDF 預覽" : "下一步：下載結果"}>
        <span className="workflow-prompt__marker" aria-hidden="true">03</span>
        <div className="workflow-prompt__copy">
          <span className="workflow-prompt__eyebrow">覆核摘要</span>
          <strong>已替換 {resultStats.total} 處內容{manualRedactionCount > 0 ? `，含 ${manualRedactionCount} 處手動遮蔽` : ""}。</strong>
          <small>{sourcePdfFile ? "建議先開啟原始版面比對，確認遮罩位置與範圍。" : "確認差異後，即可由本機產生最終結果檔。"}</small>
        </div>
        <button type="button" className="workflow-prompt__action workflow-prompt__action--primary" onClick={downloadResult} aria-haspopup={sourcePdfFile ? "dialog" : undefined}>{sourcePdfFile ? <>開啟 PDF 預覽 <ChevronRight size={16} /></> : <>下載結果 <ArrowDownToLine size={16} /></>}</button>
      </section>
    </div>
  );

  const renderDownloadSection = () => (
    <div className="wizard-download-card rise-in">
      <div className="wizard-download-card__hero">
        <div className="wizard-download-card__icon">
          <CheckCircle2 size={32} />
        </div>
        <h2>去識別化處理完成</h2>
        <p>
          所有個資替換與版面遮罩均在本機端記憶體即時計算完畢，無任何資料外洩風險。請點選下方按鈕下載結果檔。
        </p>
      </div>

      <div className="wizard-download-card__actions">
        <button
          type="button"
          className="wizard-download-card__primary-btn"
          onClick={downloadResult}
          disabled={isPdfExporting}
        >
          {isPdfExporting ? <LoaderCircle className="spin" size={20} /> : <ArrowDownToLine size={20} />}
          <span>
            {sourcePdfFile
              ? (isPdfExporting ? "本機 PDF 產生中…" : "下載去識別化 PDF")
              : parsedDocument?.fileType === "xlsx"
                ? "下載 Excel 試算表 (.xlsx)"
                : parsedDocument?.fileType === "docx"
                  ? "下載 Word 文件 (.docx)"
                  : "下載 TXT 文字檔 (.txt)"}
          </span>
        </button>
        <button
          type="button"
          className="wizard-download-card__copy-btn"
          onClick={copyResult}
        >
          {copied ? <Check size={18} /> : <Clipboard size={18} />}
          <span>{copied ? "結果已複製" : "複製結果文字"}</span>
        </button>
        {sourcePdfFile && (
          <button
            type="button"
            className="wizard-download-card__copy-btn"
            onClick={() => {
              setPdfPreviewPage(1);
              setPdfPreviewZoom(100);
              setPdfPreviewOpen(true);
            }}
          >
            <FileOutput size={18} />
            <span>開啟 PDF 預覽與手動遮罩</span>
          </button>
        )}
      </div>

      <div className="wizard-download-card__stats">
        <div className="wizard-download-card__stat-item">
          <span>替換項目</span>
          <strong>{resultStats.total} 處</strong>
        </div>
        <div className="wizard-download-card__stat-item">
          <span>輸入字數</span>
          <strong>{countCharacters(input)} 字</strong>
        </div>
        <div className="wizard-download-card__stat-item">
          <span>輸出字數</span>
          <strong>{countCharacters(result)} 字</strong>
        </div>
        <div className="wizard-download-card__stat-item">
          <span>檔案格式</span>
          <strong>{sourceTypeLabel}</strong>
        </div>
        <div className="wizard-download-card__stat-item">
          <span>資安模式</span>
          <strong style={{ color: "var(--amber)" }}>LOCAL ONLY</strong>
        </div>
      </div>

      <div className="wizard-download-card__preview">
        <div className="wizard-download-card__preview-header">
          <span>結果預覽（已遮蔽完成）</span>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setActiveStep("review");
              setReviewTab("diff");
            }}
          >
            <FileDiff size={13} /> 回步驟 3 檢視差異
          </button>
        </div>
        <pre className="result-preview" style={{ maxHeight: "180px", overflow: "auto" }}>
          {result}
        </pre>
      </div>
    </div>
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar__brand"><LocalMark /></div>
        <div className="topbar__context">
          <span className="topbar__rule" />
          <span>無意識 / 去識別化工作站</span>
        </div>
        <div className="topbar__actions">
          <div className="reading-mode-switch" role="group" aria-label="閱讀模式">
            <Type size={14} aria-hidden="true" />
            {READING_MODE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={readingMode === option.id ? "reading-mode-switch__option reading-mode-switch__option--active" : "reading-mode-switch__option"}
                onClick={() => setReadingMode(option.id)}
                aria-pressed={readingMode === option.id}
                aria-label={`切換為${option.label}閱讀模式`}
                title={`${option.label}閱讀模式`}
              >
                <span className="reading-mode-switch__label">{option.label}</span>
                <span className="reading-mode-switch__short-label">{option.shortLabel}</span>
              </button>
            ))}
            <span className="reading-mode-switch__divider" aria-hidden="true" />
            <button
              type="button"
              className={theme === "dark" ? "reading-mode-switch__theme reading-mode-switch__theme--active" : "reading-mode-switch__theme"}
              onClick={() => toggleTheme?.()}
              aria-pressed={theme === "dark"}
              aria-label={theme === "dark" ? "切換為淺色模式" : "切換為深色模式"}
              title={theme === "dark" ? "切換為淺色模式" : "切換為深色模式"}
            >
              {theme === "dark" ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
              <span className="reading-mode-switch__theme-label">{theme === "dark" ? "淺色" : "深色"}</span>
            </button>
            <button
              type="button"
              className={themePreference === "system" ? "reading-mode-switch__theme reading-mode-switch__theme--active" : "reading-mode-switch__theme"}
              onClick={() => setThemePreference?.("system")}
              aria-pressed={themePreference === "system"}
              aria-label={`跟隨系統，目前依裝置使用${theme === "dark" ? "深色" : "淺色"}模式`}
              title="跟隨系統主題"
            >
              <Monitor size={14} aria-hidden="true" />
              <span className="reading-mode-switch__theme-label">系統</span>
            </button>
          </div>
          <div className="secure-pill"><ShieldCheck size={15} /> <span>LOCAL ONLY</span></div>
          <button className="icon-button menu-trigger" onClick={() => setMenuOpen((open) => !open)} aria-label="開啟選單" aria-expanded={menuOpen}>
            <Menu size={20} />
          </button>
          {menuOpen && (
            <div className="menu-popover">
              <button onClick={() => toast.info("目前版本不會將資料寫入瀏覽器儲存空間。試算完成後可直接關閉頁面。")}><Info size={15} /> 儲存說明</button>
              <Link href="/privacy" onClick={() => setMenuOpen(false)}><ShieldCheck size={15} /> 隱私權政策</Link>
              <Link href="/cookies" onClick={() => setMenuOpen(false)}><CookieIcon size={15} /> Cookie／廣告宣告</Link>
            </div>
          )}
        </div>
      </header>

      <main className="workspace">
        <StepRail
          activeStep={activeStep}
          onSelectStep={navigateToStep}
          canNavigateToStep={canNavigateToStep}
          viewMode={viewMode}
          onToggleViewMode={setViewMode}
        />

        <section className="workbench">
          {/* 行動版精簡工作流程指示列 */}
          <div className="mobile-workflow-bar" role="navigation" aria-label="行動版流程指示">
            <span className="mobile-workflow-bar__step">
              步驟 0{["source", "rules", "review", "download"].indexOf(activeStep) + 1} / 04
            </span>
            <span className="mobile-workflow-bar__label">
              {activeStep === "source" ? "放入資料" : activeStep === "rules" ? "選擇規則" : activeStep === "review" ? "檢查遮罩" : "下載輸出"}
            </span>
            <div className="mobile-workflow-bar__actions">
              {activeStep !== "source" && (
                <button
                  type="button"
                  className="mobile-workflow-bar__btn"
                  onClick={() => {
                    const prevStep: Step = activeStep === "download" ? "review" : activeStep === "review" ? "rules" : "source";
                    navigateToStep(prevStep);
                  }}
                >
                  <ChevronLeft size={13} /> 上一步
                </button>
              )}
              {activeStep === "source" && isSourceReady && (
                <button type="button" className="mobile-workflow-bar__btn mobile-workflow-bar__btn--primary" onClick={() => navigateToStep("rules")}>
                  選規則 <ChevronRight size={13} />
                </button>
              )}
              {activeStep === "rules" && (
                <button type="button" className="mobile-workflow-bar__btn mobile-workflow-bar__btn--primary" disabled={!input.trim()} onClick={processText}>
                  去識別化 <ChevronRight size={13} />
                </button>
              )}
              {activeStep === "review" && (
                <button type="button" className="mobile-workflow-bar__btn mobile-workflow-bar__btn--primary" onClick={() => navigateToStep("download")}>
                  去下載 <ArrowDownToLine size={13} />
                </button>
              )}
            </div>
          </div>

          <div className="workbench__view-mode-bar">
            <div className="view-mode-toggle" role="group" aria-label="工作視圖模式">
              <button
                type="button"
                className={`view-mode-toggle__btn ${viewMode === "wizard" ? "view-mode-toggle__btn--active" : ""}`}
                onClick={() => setViewMode("wizard")}
                title="一步一個頁面，專注於當前步驟與下一步操作"
              >
                <span className="view-mode-toggle__dot" />
                一步一頁 (引導)
              </button>
              <button
                type="button"
                className={`view-mode-toggle__btn ${viewMode === "all" ? "view-mode-toggle__btn--active" : ""}`}
                onClick={() => setViewMode("all")}
                title="單頁展開全部區塊"
              >
                全部展開
              </button>
            </div>
            <span className="workbench__view-mode-hint">
              {viewMode === "wizard" ? "目前為專注視圖：完成當前步驟後按「下一步」繼續" : "目前為長頁面視圖：所有面板皆可上下滾動檢視"}
            </span>
          </div>

          <div className="workbench__intro rise-in">
            <div>
              <span className="eyebrow">01 / DATA BOUNDARY · LOCAL ONLY</span>
              <h1 className="workbench__brand-title"><span>無意識</span><br /><span>去識別化</span><br /><em>工作站</em></h1>
            </div>
            <p className="intro-note">文字、Excel、Word、PDF 與掃描 PDF 會先在瀏覽器端解析，再依選定規則替換；您可在下載前檢視差異與 PDF 版面。</p>
          </div>

          {viewMode === "wizard" ? (
            <div className="wizard-step-container">
              {activeStep === "source" && (
                <>
                  <div className="wizard-step-header">
                    <div className="wizard-step-header__title">
                      <span className="wizard-step-header__index">01 / 04</span>
                      <span className="wizard-step-header__label">步驟一：放入原始資料</span>
                    </div>
                    <span className="wizard-step-header__hint">支援直接貼上文字或上傳 TXT、CSV、Excel、Word、PDF（含繁中 OCR）</span>
                  </div>

                  {renderSourceCard()}

                  <div className="wizard-action-bar">
                    <div className="wizard-action-bar__info">
                      {isSourceReady ? (
                        <span><CheckCircle2 size={15} /> 已載入 {countCharacters(input)} 字元 {fileName ? `（${fileName}）` : ""}</span>
                      ) : (
                        <span><Info size={15} /> 請先貼上文字或選取檔案以開始處理</span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="wizard-btn wizard-btn--primary"
                      disabled={!isSourceReady || isParsing}
                      onClick={() => navigateToStep("rules")}
                    >
                      <span>下一步：選擇規則</span>
                      <ChevronRight size={17} />
                    </button>
                  </div>
                </>
              )}

              {activeStep === "rules" && (
                <>
                  <div className="wizard-step-header">
                    <div className="wizard-step-header__title">
                      <span className="wizard-step-header__index">02 / 04</span>
                      <span className="wizard-step-header__label">步驟二：選擇去識別化規則與關鍵字</span>
                    </div>
                    <span className="wizard-step-header__hint">勾選欲遮蔽的個資項目，或新增自訂字典關鍵字</span>
                  </div>

                  <div className="wizard-source-summary">
                    <div className="wizard-source-summary__text">
                      <FolderOpen size={16} />
                      <span><strong>目前資料來源：</strong>{fileName || "純文字"}（{countCharacters(input)} 字元 · {sourcePageCount} 頁 {sourceTypeLabel}）</span>
                    </div>
                    <button type="button" className="text-button" onClick={() => navigateToStep("source")}>
                      <Pencil size={13} /> 修改或更換原文
                    </button>
                  </div>

                  {renderRulesSection()}

                  <div className="wizard-action-bar wizard-action-bar--between">
                    <button
                      type="button"
                      className="wizard-btn wizard-btn--secondary"
                      onClick={() => navigateToStep("source")}
                    >
                      <ChevronLeft size={16} /> 上一步：修改原文
                    </button>
                    <button
                      type="button"
                      className="wizard-btn wizard-btn--execute"
                      disabled={!input.trim()}
                      onClick={processText}
                    >
                      <FileCheck2 size={17} />
                      <span>執行去識別化並進入步驟 3 檢查遮罩 ({enabledRules.length} 項規則)</span>
                      <ChevronRight size={17} />
                    </button>
                  </div>
                </>
              )}

              {activeStep === "review" && (
                <>
                  <div className="wizard-step-header">
                    <div className="wizard-step-header__title">
                      <span className="wizard-step-header__index">03 / 04</span>
                      <span className="wizard-step-header__label">步驟三：檢查遮罩與差異比對</span>
                    </div>
                    <span className="wizard-step-header__hint">雙欄滾輪同步滾動，精準比對處理前與處理後內容</span>
                  </div>

                  {sourcePdfFile && (
                    <div className="wizard-pdf-banner">
                      <div className="wizard-pdf-banner__copy">
                        <strong><FileOutput size={16} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: "6px" }} />檢測到 PDF 文件（共 {pdfPageCount} 頁{parsedDocument?.ocrPageCount ? `，含 ${parsedDocument.ocrPageCount} 頁 OCR` : ""}）</strong>
                        <small>建議開啟視覺版面預覽，可直接在原頁面雙頁對比並自由手動框選遮蔽。</small>
                      </div>
                      <button
                        type="button"
                        className="wizard-btn wizard-btn--primary"
                        onClick={() => {
                          setPdfPreviewPage(1);
                          setPdfPreviewZoom(100);
                          setPdfPreviewOpen(true);
                        }}
                      >
                        開啟 PDF 視覺版面對照 <ChevronRight size={15} />
                      </button>
                    </div>
                  )}

                  <div className="wizard-review-toolbar">
                    <div className="wizard-review-tabs" role="tablist" aria-label="檢視模式切換">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={reviewTab === "diff"}
                        className={`wizard-review-tab ${reviewTab === "diff" ? "wizard-review-tab--active" : ""}`}
                        onClick={() => setReviewTab("diff")}
                      >
                        <FileDiff size={14} /> 雙欄差異比對（同步滾動）
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={reviewTab === "text"}
                        className={`wizard-review-tab ${reviewTab === "text" ? "wizard-review-tab--active" : ""}`}
                        onClick={() => setReviewTab("text")}
                      >
                        <FileText size={14} /> 去識別化純文字
                      </button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "12px", color: "var(--ink-soft)" }}>已替換 <strong>{resultStats.total}</strong> 處</span>
                      <button type="button" className="text-button" onClick={copyResult}>
                        {copied ? <Check size={14} /> : <Clipboard size={14} />} {copied ? "已複製" : "複製結果"}
                      </button>
                    </div>
                  </div>

                  {reviewTab === "diff" ? (
                    <DiffView original={input} revised={result} onClose={() => setReviewTab("text")} />
                  ) : (
                    <div className="result-card" style={{ marginTop: 0 }}>
                      <pre className="result-preview">{result}</pre>
                    </div>
                  )}

                  <div className="wizard-action-bar wizard-action-bar--between">
                    <button
                      type="button"
                      className="wizard-btn wizard-btn--secondary"
                      onClick={() => navigateToStep("rules")}
                    >
                      <ChevronLeft size={16} /> 上一步：調整規則
                    </button>
                    <button
                      type="button"
                      className="wizard-btn wizard-btn--primary"
                      onClick={() => navigateToStep("download")}
                    >
                      <span>下一步：前往步驟 4 下載輸出</span>
                      <ArrowDownToLine size={17} />
                    </button>
                  </div>
                </>
              )}

              {activeStep === "download" && (
                <>
                  <div className="wizard-step-header">
                    <div className="wizard-step-header__title">
                      <span className="wizard-step-header__index">04 / 04</span>
                      <span className="wizard-step-header__label">步驟四：下載輸出與完成摘要</span>
                    </div>
                    <span className="wizard-step-header__hint">100% 瀏覽器本機端產生，保護您的機敏資料不外流</span>
                  </div>

                  {renderDownloadSection()}

                  <div className="wizard-action-bar wizard-action-bar--between">
                    <button
                      type="button"
                      className="wizard-btn wizard-btn--secondary"
                      onClick={() => navigateToStep("review")}
                    >
                      <ChevronLeft size={16} /> 返回步驟 3 檢查遮罩
                    </button>
                    <button
                      type="button"
                      className="wizard-btn wizard-btn--quiet"
                      onClick={() => setClearConfirmOpen(true)}
                      title="清除工作區並回到步驟 1 處理下一份資料"
                    >
                      <Trash2 size={15} /> 處理下一份資料（清除工作區）
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="all-sections-container" style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
              {renderSourceCard()}
              {input.trim() && !isParsing && (
                <section className="workflow-prompt workflow-prompt--source" aria-label="下一步：選擇規則">
                  <span className="workflow-prompt__marker" aria-hidden="true">01</span>
                  <div className="workflow-prompt__copy">
                    <span className="workflow-prompt__eyebrow">資料已就緒</span>
                    <strong>已解析 {sourcePageCount} 頁 {sourceTypeLabel}，接著確認要套用的遮蔽規則。</strong>
                    {parsedDocument?.ocrPageCount ? <small>其中 {parsedDocument.ocrPageCount} 頁已在本機完成 OCR 辨識。</small> : <small>原始內容仍只存在目前瀏覽器工作區。</small>}
                  </div>
                  <button type="button" className="workflow-prompt__action" onClick={continueToRules}>前往選擇規則 <ChevronRight size={16} /></button>
                </section>
              )}
              {renderRulesSection()}
              {result && renderReviewSection()}
              {result && showDiff && <DiffView original={input} revised={result} onClose={() => setShowDiff(false)} />}
            </div>
          )}
        </section>

        <aside className="status-column">
          <PrivacyPanel />
          <AdSlot placement="status-column" />
          <section className="stats-panel">
            <div className="stats-panel__label"><span className="eyebrow">SESSION NOTES</span><span className="status-line" /></div>
            <div className="stat-row"><span>目前工作區</span><strong>{input ? "已載入" : "空白"}</strong></div>
            <div className="stat-row"><span>啟用規則</span><strong>{enabledRules.length} 項</strong></div>
            <div className="stat-row"><span>已找到項目</span><strong className="amber-text">{analysis.total}</strong></div>
              <div className="stat-row"><span>本機 OCR 頁數</span><strong className="amber-text">{parsedDocument?.ocrPageCount ?? 0}</strong></div>
              <div className="stat-row"><span>原文上傳</span><strong className="green-text">否</strong></div>
          </section>
          <section className="tip-panel"><div className="tip-panel__mark">/ / /</div><p>去識別化是降低風險，不是取代人工判斷。匯出前請檢查結果，確認沒有遺漏需要遮蔽的內容。</p><span>使用提醒 · 0001</span></section>
        </aside>
      </main>
      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent className="clear-confirm-dialog">
          <AlertDialogHeader>
            <span className="clear-confirm-dialog__kicker">WORKSPACE / CONFIRM</span>
            <AlertDialogTitle>確定要清除目前工作區？</AlertDialogTitle>
            <AlertDialogDescription>
              這項操作會移除目前工作區記憶體中的資料，且無法復原。已下載到裝置的結果檔案不會受到影響。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="clear-confirm-dialog__scope">
            <strong>將被清除</strong>
            <span>原文與去識別化結果</span>
            <span>檔案資訊與 PDF OCR 狀態</span>
            <span>自訂關鍵字與差異檢視狀態</span>
          </div>
          <AlertDialogFooter className="clear-confirm-dialog__footer">
            <AlertDialogCancel className="clear-confirm-dialog__cancel">保留目前資料</AlertDialogCancel>
            <AlertDialogAction className="clear-confirm-dialog__confirm" onClick={clearWorkspace}>清除工作區</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={pdfPreviewOpen} onOpenChange={(open) => { if (!isPdfExporting) { if (!open && document.fullscreenElement) void document.exitFullscreen(); if (!open) setIsPdfFocusReading(false); setPdfPreviewOpen(open); } }}>
        <DialogContent id="pdf-preview-dialog" className={`pdf-preview-dialog ${isPdfImmersiveReading ? "pdf-preview-dialog--fullscreen" : ""} ${isPdfFocusReading ? "pdf-preview-dialog--focus-reading" : ""}`} aria-busy={isPdfExporting} onEscapeKeyDown={(event) => { if (document.fullscreenElement || isPdfFocusReading) { event.preventDefault(); if (document.fullscreenElement) void document.exitFullscreen(); setIsPdfFocusReading(false); } }}>
          <DialogHeader className="pdf-preview-dialog__header">
            <span className="pdf-preview-dialog__kicker">PDF / LOCAL PREVIEW</span>
            <DialogTitle>下載前檢查原始版面</DialogTitle>
            <DialogDescription>左側保留原始 PDF 的版面、圖片與字型；右側在相同頁面上標示去識別化後的遮罩。請逐頁確認後再下載。</DialogDescription>
          </DialogHeader>
          <div className="pdf-preview-dialog__meta"><span><FileOutput size={14} /> {fileName || "文字工作區"}</span><span>{sourcePdfFile ? `第 ${pdfPreviewPage} / ${pdfPageCount} 頁 · ` : ""}{resultStats.total} 處自動替換{pdfReviewState.redactionEdits.filter((item) => item.origin === "manual").length > 0 ? ` · ${pdfReviewState.redactionEdits.filter((item) => item.origin === "manual").length} 處手動遮蔽` : ""}</span></div>
          {sourcePdfFile ? (
            <>
              <div className="pdf-preview-dialog__page-controls" aria-label="PDF 頁面切換與手動遮蔽工具">
                <div className="pdf-preview-dialog__page-navigation">
                  <button type="button" onClick={() => setPdfPreviewPage((page) => Math.max(1, page - 1))} disabled={pdfPreviewPage <= 1 || isPdfExporting}><ChevronLeft size={15} /> 上一頁</button>
                  <label>頁碼 <input type="number" min={1} max={pdfPageCount} value={pdfPreviewPage} onChange={(event) => setPdfPreviewPage(Math.min(pdfPageCount, Math.max(1, Number(event.target.value) || 1)))} disabled={isPdfExporting} aria-label="前往 PDF 頁碼" /> <span>/ {pdfPageCount}</span></label>
                  <button type="button" onClick={() => setPdfPreviewPage((page) => Math.min(pdfPageCount, page + 1))} disabled={pdfPreviewPage >= pdfPageCount || isPdfExporting}>下一頁 <ChevronRight size={15} /></button>
                </div>
                <div className="pdf-preview-dialog__page-actions">
                  <div className="pdf-preview-dialog__view-controls" role="group" aria-label="PDF 閱讀控制">
                    <span className="pdf-preview-dialog__view-label">縮放</span>
                    <button type="button" onClick={() => setPdfPreviewZoom((zoom) => Math.max(80, zoom - 10))} disabled={isPdfExporting || pdfPreviewZoom <= 80} aria-label="縮小 PDF 預覽" title="縮小 PDF 預覽"><ZoomOut size={14} /></button>
                    <output aria-live="polite">{pdfPreviewZoom}%</output>
                    <button type="button" onClick={() => setPdfPreviewZoom((zoom) => Math.min(150, zoom + 10))} disabled={isPdfExporting || pdfPreviewZoom >= 150} aria-label="放大 PDF 預覽" title="放大 PDF 預覽"><ZoomIn size={14} /></button>
                    <label>字體
                      <select value={pdfPreviewTextSize} onChange={(event) => setPdfPreviewTextSize(event.target.value as (typeof PDF_TEXT_SIZE_OPTIONS)[number]["id"])} disabled={isPdfExporting} aria-label="PDF 預覽介面字體大小">
                        {PDF_TEXT_SIZE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                      </select>
                    </label>
                  </div>
                  <button type="button" className="pdf-preview-dialog__download pdf-preview-dialog__download--toolbar" onClick={confirmPdfDownload} disabled={isPdfExporting} aria-label="下載已去識別化的 PDF" title="下載去識別化 PDF">{isPdfExporting ? <LoaderCircle className="spin" size={15} /> : <ArrowDownToLine size={15} />} {isPdfExporting ? "PDF 處理中…" : "下載去識別化 PDF"}</button>
                  <button type="button" className={`pdf-preview-dialog__mode ${manualReviewMode ? "pdf-preview-dialog__mode--active" : ""}`} onClick={() => setManualReviewMode((enabled) => !enabled)} disabled={isPdfExporting} aria-pressed={manualReviewMode} aria-label={manualReviewMode ? "結束添加手動遮蔽" : "添加手動遮蔽"}><Pencil size={14} /> {manualReviewMode ? "手動遮蔽編輯中" : "添加手動遮蔽"}</button>
                  {manualReviewMode && <div className="pdf-preview-dialog__color-picker" role="group" aria-label="新增手動遮蔽顏色">
                    <span>遮罩色</span>
                    {(Object.keys(PDF_REDACTION_COLORS) as PdfRedactionColor[]).map((color) => <button type="button" key={color} className={`pdf-preview-dialog__color-swatch pdf-preview-dialog__color-swatch--${color} ${selectedPdfRedactionColor === color ? "pdf-preview-dialog__color-swatch--selected" : ""}`} onClick={() => setSelectedPdfRedactionColor(color)} disabled={isPdfExporting} aria-label={`${color === "blue" ? "藍色" : color === "red" ? "紅色" : "黑色"}遮罩`} aria-pressed={selectedPdfRedactionColor === color} title={`${color === "blue" ? "藍色" : color === "red" ? "紅色" : "黑色"}遮罩`} />)}
                  </div>}
                  <button type="button" className="pdf-preview-dialog__history-action" onClick={() => setPdfReviewHistory((history) => undoPdfReviewHistory(history))} disabled={isPdfExporting || !canUndoPdfReview} aria-label="復原上一個遮罩編輯" title="復原（Ctrl 或 Command + Z）"><Undo2 size={15} /><span>復原</span></button>
                  <button type="button" className="pdf-preview-dialog__history-action" onClick={() => setPdfReviewHistory((history) => redoPdfReviewHistory(history))} disabled={isPdfExporting || !canRedoPdfReview} aria-label="重做下一個遮罩編輯" title="重做（Ctrl 或 Command + Shift + Z）"><Redo2 size={15} /><span>重做</span></button>
                  <button type="button" className="pdf-preview-dialog__fullscreen pdf-preview-dialog__fullscreen--reading" onClick={togglePdfPreviewFullscreen} disabled={isPdfExporting} aria-label={isPdfImmersiveReading ? "結束全螢幕閱讀" : "開啟全螢幕閱讀"} title={isPdfImmersiveReading ? "結束全螢幕閱讀（Esc）" : "開啟全螢幕閱讀"}>{isPdfImmersiveReading ? <Minimize2 size={15} /> : <Maximize2 size={15} />}<span>{isPdfImmersiveReading ? "結束閱讀" : "全螢幕閱讀"}</span></button>
                </div>
              </div>
              <PdfVisualCompare file={sourcePdfFile} pageNumber={pdfPreviewPage} enabledRules={enabledRules} customTerms={customTerms} zoomPercent={pdfPreviewZoom} textScale={pdfPreviewTextScale} manualReviewMode={manualReviewMode} selectedRedactionColor={selectedPdfRedactionColor} reviewState={pdfReviewState} onReviewStateChange={(state) => setPdfReviewHistory((history) => recordPdfReviewState(history, state))} />
            </>
          ) : <pre className="pdf-preview-dialog__document" style={{ "--pdf-preview-text-scale": pdfPreviewTextScale } as React.CSSProperties} aria-label="去識別化 PDF 內容預覽">{result}</pre>}
          {isPdfExporting && <div className="pdf-preview-dialog__status" role="status" aria-live="polite"><LoaderCircle className="spin" size={16} /><span><strong>正在產生 PDF…</strong><small>檔案完全在瀏覽器本機處理，請稍候。</small></span></div>}
          <DialogFooter className="pdf-preview-dialog__footer">
            <DialogClose asChild><button className="pdf-preview-dialog__back" disabled={isPdfExporting}>返回結果</button></DialogClose>
            <button className="download-button pdf-preview-dialog__download" onClick={confirmPdfDownload} disabled={isPdfExporting}>{isPdfExporting ? <LoaderCircle className="spin" size={15} /> : <ArrowDownToLine size={15} />} {isPdfExporting ? "PDF 處理中…" : "下載去識別化 PDF"}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <footer className="site-footer"><span className="site-footer__brand">無意識 · 去識別化工作站</span><span>本機處理 · 無雲端副本 · 可檢查的替換</span><span className="site-footer__links"><Link href="/privacy">隱私權政策</Link><Link href="/cookies">Cookie 宣告</Link><button type="button" onClick={() => window.dispatchEvent(new CustomEvent("open-cookie-settings"))}>Cookie 設定</button></span><span>v0.1 / 2026</span></footer>
      <ConsentBanner />
    </div>
  );
}
