/* Design philosophy: quiet archival utility — tests protect predictable, auditable transformations. */

import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, deidentifyText, isValidTaiwanUniformNumber } from "./deidentify";

describe("deidentifyText", () => {
  it("replaces enabled sensitive patterns and reports counts", () => {
    const output = deidentifyText(
      "Email a@example.com；電話 0912-345-678；身分證 A123456789；日期 2026-08-14；IP 192.168.1.24",
      ["email", "phone", "taiwanId", "date", "ip"],
      [],
    );

    expect(output.text).toContain("[EMAIL]");
    expect(output.text).toContain("[PHONE]");
    expect(output.text).toContain("[ID_NUMBER]");
    expect(output.text).toContain("[DATE]");
    expect(output.text).toContain("[IP_ADDRESS]");
    expect(output.total).toBe(5);
  });

  it("does not replace disabled rules", () => {
    const output = deidentifyText("a@example.com and 0912-345-678", ["email"], []);

    expect(output.text).toBe("[EMAIL] and 0912-345-678");
    expect(output.total).toBe(1);
  });

  it("replaces custom terms case-insensitively and avoids duplicate terms", () => {
    const output = deidentifyText("Project Atlas / project atlas", [], ["Project Atlas", "Project Atlas"]);

    expect(output.text).toBe("[CUSTOM] / [CUSTOM]");
    expect(output.counts["custom:Project Atlas"]).toBe(2);
    expect(output.total).toBe(2);
  });

  it("replaces Taiwan addresses before their region names", () => {
    const output = deidentifyText("寄送地址：桃園市桃園區中正路100號5樓", ["address", "region"], []);

    expect(output.text).toBe("寄送地址：[ADDRESS]");
    expect(output.counts.address).toBe(1);
    expect(output.counts.region).toBe(0);
    expect(output.total).toBe(1);
  });

  it("replaces place names and regional descriptors independently", () => {
    const output = deidentifyText("會議地點：台北101；服務區域：北部地區", ["placeName", "region"], []);

    expect(output.text).toBe("[PLACE_NAME]；服務區域：[REGION]");
    expect(output.counts.placeName).toBe(1);
    expect(output.counts.region).toBe(1);
    expect(output.total).toBe(2);
  });

  it("replaces general names and contact names independently", () => {
    const output = deidentifyText("姓名：王小明；聯絡人：李小美。這是一段普通文字。", ["name", "contactName"], []);

    expect(output.text).toBe("[NAME]；[CONTACT_NAME]。這是一段普通文字。");
    expect(output.counts.name).toBe(1);
    expect(output.counts.contactName).toBe(1);
    expect(output.total).toBe(2);
  });

  it("replaces company and customer names in label-based table text", () => {
    const output = deidentifyText(
      "公司名稱\t互盛桃園通訊；客戶名稱：王小明商行；聯絡人姓名：李小美",
      ["companyName", "customerName", "contactName"],
      [],
    );

    expect(output.text).toBe("[COMPANY_NAME]；[CUSTOMER_NAME]；[CONTACT_NAME]");
    expect(output.counts.companyName).toBe(1);
    expect(output.counts.customerName).toBe(1);
    expect(output.counts.contactName).toBe(1);
    expect(output.total).toBe(3);
  });

  it("does not mask named fields when their dedicated rules are disabled", () => {
    const output = deidentifyText("公司名稱：互盛桃園通訊；客戶名稱：王小明商行；聯絡人：李小美", ["name"], []);

    expect(output.text).toBe("公司名稱：互盛桃園通訊；客戶名稱：王小明商行；聯絡人：李小美");
    expect(output.total).toBe(0);
  });

  it("leaves labeled names untouched when the name rule is disabled", () => {
    const output = deidentifyText("申請人：陳大文", ["email"], []);

    expect(output.text).toBe("申請人：陳大文");
    expect(output.total).toBe(0);
  });

  it("replaces a valid uniform number but ignores an invalid eight-digit value", () => {
    const output = deidentifyText("公司統編：04595257；無效數字：12345678", ["uniformNumber"], []);

    expect(output.text).toBe("公司統編：[UNIFORM_NUMBER]；無效數字：12345678");
    expect(output.counts.uniformNumber).toBe(1);
    expect(output.total).toBe(1);
    expect(isValidTaiwanUniformNumber("04595257")).toBe(true);
    expect(isValidTaiwanUniformNumber("12345678")).toBe(false);
  });

  it("replaces standalone numbers without overriding more specific enabled rules", () => {
    const output = deidentifyText(
      "合約金額 125,000.50；頁碼 12；統編 04595257；電話 0912-345-678",
      ["uniformNumber", "phone", "number"],
      [],
    );

    expect(output.text).toBe("合約金額 [NUMBER]；頁碼 12；統編 [UNIFORM_NUMBER]；電話 [PHONE]");
    expect(output.counts.number).toBe(1);
    expect(output.counts.uniformNumber).toBe(1);
    expect(output.counts.phone).toBe(1);
  });

  it("keeps the fourteen default rules in location-first and number-last order", () => {
    expect(DEFAULT_RULES.map((rule) => rule.id)).toEqual([
      "address",
      "placeName",
      "region",
      "companyName",
      "customerName",
      "contactName",
      "name",
      "taiwanId",
      "uniformNumber",
      "email",
      "phone",
      "date",
      "ip",
      "number",
    ]);
  });
});
