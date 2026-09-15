/* Design philosophy: quiet archival utility — make every transformation explicit, local, and auditable. */

// 設計提醒：規則順序也是介面語言；先處理空間位置，再處理識別與技術欄位，讓檔案校閱從高風險內容開始。

export type RuleId = "email" | "phone" | "taiwanId" | "uniformNumber" | "amount" | "number" | "date" | "ip" | "address" | "placeName" | "region" | "name" | "companyName" | "customerName" | "contactName";

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

export type DeidentificationRange = {
  start: number;
  end: number;
  ruleId: RuleId | "custom";
};

export const DEFAULT_RULES: DeidentifyRule[] = [
  {
    id: "address",
    label: "地址",
    detail: "辨識臺灣縣市、行政區與道路門牌",
    replacement: "[ADDRESS]",
  },
  {
    id: "placeName",
    label: "地名",
    detail: "辨識常見地點與地名欄位內容",
    replacement: "[PLACE_NAME]",
  },
  {
    id: "region",
    label: "區域",
    detail: "辨識縣市、行政區與北中南東區域",
    replacement: "[REGION]",
  },
  {
    id: "companyName",
    label: "公司名稱",
    detail: "辨識公司、企業與機構名稱欄位",
    replacement: "[COMPANY_NAME]",
  },
  {
    id: "customerName",
    label: "客戶名稱",
    detail: "辨識客戶、買方與委託人名稱欄位",
    replacement: "[CUSTOMER_NAME]",
  },
  {
    id: "contactName",
    label: "聯絡人姓名",
    detail: "辨識聯絡人、窗口與承辦人姓名欄位",
    replacement: "[CONTACT_NAME]",
  },
  {
    id: "name",
    label: "一般姓名",
    detail: "辨識姓名、名字與本人欄位",
    replacement: "[NAME]",
  },
  {
    id: "taiwanId",
    label: "身分證字號",
    detail: "辨識台灣身分證字號格式",
    replacement: "[ID_NUMBER]",
  },
  {
    id: "uniformNumber",
    label: "統一編號",
    detail: "辨識通過檢核的 8 碼統一編號",
    replacement: "[UNIFORM_NUMBER]",
  },
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
  {
    id: "amount",
    label: "金額與價格",
    detail: "辨識貨幣符號、新台幣/元與金額欄位數值",
    replacement: "[AMOUNT]",
  },
  {
    id: "number",
    label: "一般數字",
    detail: "辨識 3 位數以上獨立數字（自動保留規格參數）",
    replacement: "[NUMBER]",
  },
];

const CURRENCY_PREFIX = /(?:NT\$|US\$|HK\$|\$|¥|€|£|￥|新台幣|台幣|美金|人民幣|日圓|日幣|歐元)\s*$/i;
const CURRENCY_SUFFIX = /^\s*(?:元|萬|萬元|億|億元|塊|塊錢|NTD|TWD|USD|RMB|EUR|JPY)(?![A-Za-z0-9\u4e00-\u9fff])/i;
const AMOUNT_LABEL_PREFIX = /(?:合約金額|金額|總計|小計|總價|單價|報價|費用|預算|底價|款項|未稅|含稅|實收|應付|實付|月租|租金|押金|訂金|工本費|售價|特價|定價)\s*[:：]?\s*$/;

const SPEC_UNIT_SUFFIX = /^\s*(?:[~～-]\s*\d+(?:\.\d+)?\s*)?(?:吋|寸|"|”|mm|cm|km|m\b|坪|平方公尺|平方米|流明|ANSI(?:\s*lm)?|lm|cd\/m²|nits?|dpi|ppi|px|fps|V\b|v\b|W\b|w\b|Hz|kHz|MHz|GHz|A\b|mA|dB|GB|TB|MB|KB|Kbps|Mbps|Gbps|pin|Pin|組|台|支|顆|度|°C|℃|°F|聲道|代|核心)(?![A-Za-z0-9\u4e00-\u9fff])/i;
const SPEC_RATIO_SUFFIX = /^\s*[:：]\s*(?:1|\d+)(?:\s*(?:含以上|以上|以下))?(?![0-9])/;
const SPEC_MULTIPLY_SUFFIX = /^\s*[xX*×]\s*\d+/;
const SPEC_MULTIPLY_PREFIX = /\d+\s*[xX*×]\s*$/;
const SPEC_RANGE_PREFIX = /(?:\d+(?:\.\d+)?|\d{1,3}(?:,\d{3})+)\s*[~～-]\s*$/;
const SPEC_RANGE_SUFFIX = /^\s*[~～-]\s*(?:\d+(?:\.\d+)?|\d{1,3}(?:,\d{3})+)/;
const SPEC_LABEL_PREFIX = /(?:尺寸|畫面尺寸|投影尺寸|對比度|對比|投射比|放大比|鏡頭放大比|解析度|流明|亮度|頻率|電壓|功率|耗電量|重量|頻寬|輸入訊號|輸出訊號|訊號|規格|型號|版本)\s*(?:[:：*x×~～=-]|\s)\s*$/i;
const TECH_CODE_PREFIX = /(?:HDCP|HDMI|USB|Type-C|Cat\.?|Wi-Fi|Bluetooth|BT|DDR|PCIe|iOS|Android|Windows|macOS)\s*$/i;

export function isSpecificationNumber(text: string, start: number, end: number): boolean {
  const before = text.slice(Math.max(0, start - 50), start);
  const after = text.slice(end, Math.min(text.length, end + 50));

  if (CURRENCY_PREFIX.test(before) || CURRENCY_SUFFIX.test(after) || AMOUNT_LABEL_PREFIX.test(before)) {
    return false;
  }
  if (SPEC_RATIO_SUFFIX.test(after)) {
    return true;
  }
  if (SPEC_UNIT_SUFFIX.test(after)) {
    return true;
  }
  if (SPEC_MULTIPLY_SUFFIX.test(after) || SPEC_MULTIPLY_PREFIX.test(before)) {
    return true;
  }
  if (SPEC_LABEL_PREFIX.test(before)) {
    return true;
  }
  if (TECH_CODE_PREFIX.test(before)) {
    return true;
  }
  if (SPEC_RANGE_PREFIX.test(before) || SPEC_RANGE_SUFFIX.test(after)) {
    const widerContext = text.slice(Math.max(0, start - 60), Math.min(text.length, end + 60));
    if (
      /(?:尺寸|對比|放大比|投射比|解析度|流明|頻率|電壓|重量|規格|吋|寸|mm|cm|m|kg|Hz|V|W|ANSI|lm|組|台)/i.test(
        widerContext,
      )
    ) {
      return true;
    }
  }

  return false;
}

const PATTERNS: Record<RuleId, RegExp> = {
  email: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  phone: /(?:\+?886[-\s]?|0)9\d{2}[-\s]?\d{3}[-\s]?\d{3}|(?:0\d{1,2})[-\s]?\d{6,8}/g,
  taiwanId: /\b[A-Z][12]\d{8}\b/gi,
  uniformNumber: /\b\d{8}\b/g,
  date: /\b(?:19|20)\d{2}[./-]\d{1,2}[./-]\d{1,2}\b/g,
  ip: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
  address: /(?:\d{3,5}[-\s]?)?(?:基隆|新北|桃園|新竹|苗栗|臺中|台中|彰化|南投|雲林|嘉義|臺南|台南|高雄|屏東|宜蘭|花蓮|臺東|台東|澎湖|金門|連江|臺北|台北)(?:縣|市)[\u4e00-\u9fff]{1,6}(?:區|鄉|鎮|市)[\u4e00-\u9fff]{1,12}(?:路|街|大道)(?:[一二三四五六七八九十百]+段)?\d{1,5}(?:巷\d{1,5})?(?:弄\d{1,5})?號(?:\d{1,4}樓)?/g,
  placeName: /(?:地點|地名|所在位置|目的地|會議地點|工作地點|現場|分店|門市)\s*[:：]\s*[^\n,，。；;]{2,30}|(?:台北101|臺北101|桃園國際機場|桃園機場|臺北車站|台北車站|中正紀念堂|國立故宮博物院|故宮博物院|南港展覽館|信義商圈|西門町|九份老街|日月潭|阿里山|太魯閣|墾丁|高雄巨蛋|台中國家歌劇院|台中歌劇院|六合夜市|逢甲夜市)/gi,
  region: /(?:臺北市|台北市|新北市|桃園市|臺中市|台中市|臺南市|台南市|高雄市|基隆市|新竹市|嘉義市|新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義縣|屏東縣|宜蘭縣|花蓮縣|臺東縣|台東縣|澎湖縣|金門縣|連江縣|北部地區|中部地區|南部地區|東部地區|離島地區|北部|中部|南部|東部)/g,
  companyName: /(?:公司名稱|公司名|企業名稱|機構名稱|公司)\s*(?:[:：]|\t)\s*[^\n,，。；;|]{2,40}/g,
  customerName: /(?:客戶名稱|客戶名|客戶|買方名稱|委託人名稱)\s*(?:[:：]|\t)\s*[^\n,，。；;|]{2,30}/g,
  contactName: /(?:聯絡人姓名|聯絡人|聯繫人|窗口|承辦人|申請人|負責人|收件人)\s*(?:[:：]|\t)\s*[\u4e00-\u9fff]{2,6}/g,
  name: /(?:姓名|名字|患者|員工|本人)\s*(?:[:：]|\t)\s*[\u4e00-\u9fff]{2,6}/g,
  amount: /(?:(?<=合約金額[:：\s]|金額[:：\s]|總計[:：\s]|小計[:：\s]|總價[:：\s]|單價[:：\s]|報價[:：\s]|費用[:：\s]|預算[:：\s]|售價[:：\s]|款項[:：\s])\s*(?:NT\$|US\$|\$)?\s*(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?:萬元|億元|元)?|(?:NT\$|US\$|HK\$|\$|¥|€|£|￥)\s*(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?:萬元|億元|元)?|(?:新台幣|台幣|美金|人民幣|日圓|日幣|歐元)\s*(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?:萬元|億元|元)?|(?<![A-Za-z0-9])(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?:萬元|億元|元)(?![A-Za-z0-9\u4e00-\u9fff]))/gi,
  number: /(?<![A-Za-z0-9])(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d{3,}(?:\.\d+)?)(?![A-Za-z0-9])/g,
};

export function isValidTaiwanUniformNumber(value: string) {
  if (!/^\d{8}$/.test(value)) return false;

  const weights = [1, 2, 1, 2, 1, 2, 4, 1];
  const sum = value
    .split("")
    .reduce((total, digit, index) => {
      const product = Number(digit) * weights[index];
      return total + Math.floor(product / 10) + (product % 10);
    }, 0);

  return sum % 10 === 0 || (value[6] === "7" && (sum + 1) % 10 === 0);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findDeidentificationRanges(
  input: string,
  enabledRuleIds: RuleId[],
  customTerms: string[],
): DeidentificationRange[] {
  const ranges: DeidentificationRange[] = [];
  const overlapsExistingRange = (start: number, end: number) => ranges.some((range) => range.start < end && range.end > start);

  for (const rule of DEFAULT_RULES) {
    if (!enabledRuleIds.includes(rule.id)) continue;
    const sourcePattern = PATTERNS[rule.id];
    const pattern = new RegExp(sourcePattern.source, sourcePattern.flags);
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(input)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (rule.id === "uniformNumber" && !isValidTaiwanUniformNumber(match[0])) continue;
      if (rule.id === "number" && isSpecificationNumber(input, start, end)) continue;
      if (!overlapsExistingRange(start, end)) ranges.push({ start, end, ruleId: rule.id });
      if (match[0].length === 0) pattern.lastIndex += 1;
    }
  }

  const normalizedTerms = customTerms
    .map((term) => term.trim())
    .filter((term, index, list) => term.length > 0 && list.indexOf(term) === index)
    .sort((a, b) => b.length - a.length);
  for (const term of normalizedTerms) {
    const pattern = new RegExp(escapeRegExp(term), "gi");
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(input)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (!overlapsExistingRange(start, end)) ranges.push({ start, end, ruleId: "custom" });
      if (match[0].length === 0) pattern.lastIndex += 1;
    }
  }

  return ranges.sort((left, right) => left.start - right.start || right.end - left.end);
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
    text = text.replace(pattern, (match, offset: number) => {
      if (rule.id === "uniformNumber" && !isValidTaiwanUniformNumber(match)) return match;
      if (rule.id === "number" && isSpecificationNumber(text, offset, offset + match.length)) return match;
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

export const REDACTION_TOKEN_REGEX = /\[(?:NAME|PHONE|EMAIL|ID_NUMBER|UNIFORM_NUMBER|AMOUNT|NUMBER|DATE|IP_ADDRESS|ADDRESS|PLACE_NAME|REGION|COMPANY_NAME|CUSTOMER_NAME|CONTACT_NAME|CUSTOM)\]/;

export function hasRedactionTokens(text: string): boolean {
  if (!text) return false;
  return REDACTION_TOKEN_REGEX.test(text);
}

