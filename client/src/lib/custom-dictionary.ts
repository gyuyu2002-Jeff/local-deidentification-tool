// 設計提醒：自訂字典是可檢查、可攜帶的本機檔案；匯入與匯出都不會連線到外部服務。

export type CustomDictionaryPayload = {
  version: 1;
  brand: "無意識-去識別化工作站";
  terms: string[];
  exportedAt: string;
};

const BRAND = "無意識-去識別化工作站" as const;
const MAX_TERMS = 500;
const MAX_TERM_LENGTH = 120;

export function normalizeCustomTerms(values: unknown[]): string[] {
  return Array.from(new Set(
    values
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter((value) => value.length > 0 && value.length <= MAX_TERM_LENGTH),
  )).slice(0, MAX_TERMS);
}

export function serializeCustomDictionary(terms: string[]): string {
  const payload: CustomDictionaryPayload = {
    version: 1,
    brand: BRAND,
    terms: normalizeCustomTerms(terms),
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(payload, null, 2);
}

export function parseCustomDictionary(json: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("字典檔不是有效的 JSON 格式。");
  }

  const values = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && "terms" in parsed && Array.isArray(parsed.terms)
      ? parsed.terms
      : null;

  if (!values) throw new Error("字典檔需要包含 terms 陣列，例如 { \"terms\": [\"專案代號\"] }。");
  if (values.length > 0 && normalizeCustomTerms(values).length === 0) {
    throw new Error("字典檔沒有可使用的關鍵字；每個關鍵字需為 1 至 120 個字元。");
  }
  return normalizeCustomTerms(values);
}

export function downloadCustomDictionary(terms: string[]) {
  const blob = new Blob([serializeCustomDictionary(terms)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${BRAND}-自訂關鍵字字典.json`;
  link.click();
  URL.revokeObjectURL(url);
}
