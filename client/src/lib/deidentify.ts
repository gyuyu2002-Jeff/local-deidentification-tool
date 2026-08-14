/* Design philosophy: quiet archival utility — make every transformation explicit, local, and auditable. */

export type RuleId = "email" | "phone" | "taiwanId" | "date" | "ip";

export type DeidentifyRule = {
  id: RuleId;
  label: string;
  detail: string;
  replacement: string;
};

export type DeidentifyResult = {
  text: string;
  counts: Record<string, number>;
  total: number;
};

export const DEFAULT_RULES: DeidentifyRule[] = [
  {
    id: "email",
    label: "電子郵件",
    detail: "辨識常見 Email 格式",
    replacement: "[EMAIL]",
  },
  {
    id: "phone",
    label: "電話號碼",
    detail: "辨識台灣手機與市話格式",
    replacement: "[PHONE]",
  },
  {
    id: "taiwanId",
    label: "身分證字號",
    detail: "辨識台灣身分證字號格式",
    replacement: "[ID_NUMBER]",
  },
  {
    id: "date",
    label: "日期",
    detail: "辨識西元年月日與常見分隔符",
    replacement: "[DATE]",
  },
  {
    id: "ip",
    label: "IP 位址",
    detail: "辨識 IPv4 位址格式",
    replacement: "[IP_ADDRESS]",
  },
];

const PATTERNS: Record<RuleId, RegExp> = {
  email: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  phone: /(?:\+?886[-\s]?|0)9\d{2}[-\s]?\d{3}[-\s]?\d{3}|(?:0\d{1,2})[-\s]?\d{6,8}/g,
  taiwanId: /\b[A-Z][12]\d{8}\b/gi,
  date: /\b(?:19|20)\d{2}[./-]\d{1,2}[./-]\d{1,2}\b/g,
  ip: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function deidentifyText(
  input: string,
  enabledRuleIds: RuleId[],
  customTerms: string[],
): DeidentifyResult {
  let text = input;
  const counts: Record<string, number> = {};

  for (const rule of DEFAULT_RULES) {
    if (!enabledRuleIds.includes(rule.id)) continue;
    const pattern = PATTERNS[rule.id];
    let count = 0;
    text = text.replace(pattern, () => {
      count += 1;
      return rule.replacement;
    });
    counts[rule.id] = count;
  }

  const normalizedTerms = customTerms
    .map((term) => term.trim())
    .filter((term, index, list) => term.length > 0 && list.indexOf(term) === index)
    .sort((a, b) => b.length - a.length);

  for (const term of normalizedTerms) {
    const pattern = new RegExp(escapeRegExp(term), "gi");
    let count = 0;
    text = text.replace(pattern, () => {
      count += 1;
      return "[CUSTOM]";
    });
    counts[`custom:${term}`] = count;
  }

  return {
    text,
    counts,
    total: Object.values(counts).reduce((sum, count) => sum + count, 0),
  };
}

export function countCharacters(value: string) {
  return value.length.toLocaleString("zh-TW");
}

