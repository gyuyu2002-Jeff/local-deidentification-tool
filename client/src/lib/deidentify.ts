/* Design philosophy: quiet archival utility — make every transformation explicit, local, and auditable. */

// 設計提醒：規則順序也是介面語言；先處理空間位置，再處理識別與技術欄位，讓檔案校閱從高風險內容開始。

export type RuleId = "email" | "phone" | "taiwanId" | "uniformNumber" | "number" | "date" | "ip" | "address" | "placeName" | "region" | "name";

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
    id: "name",
    label: "姓名",
    detail: "辨識姓名、聯絡人與申請人欄位",
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
    id: "number",
    label: "數字",
    detail: "辨識 3 位數以上的獨立數字",
    replacement: "[NUMBER]",
  },
];

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
  name: /(?:姓名|名字|聯絡人|申請人|負責人|收件人|患者|員工|客戶|本人)\s*[:：]\s*[\u4e00-\u9fff]{2,4}(?=$|[\s，,。；;])/g,
  number: /\b\d{3,}(?:,\d{3})*(?:\.\d+)?\b/g,
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
    text = text.replace(pattern, (match) => {
      if (rule.id === "uniformNumber" && !isValidTaiwanUniformNumber(match)) return match;
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
