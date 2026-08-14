/* Design philosophy: quiet archival utility — parsers must be deterministic before any redaction is applied. */

import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildBrandedFileName, DocumentParseCancelledError, parseDocument } from "./documents";

describe("parseDocument", () => {
  it("reads plain text locally", async () => {
    const file = new File(["姓名：王小明\nemail: a@example.com"], "notes.txt", { type: "text/plain" });
    const parsed = await parseDocument(file);

    expect(parsed.fileType).toBe("text");
    expect(parsed.text).toContain("王小明");
    expect(parsed.warnings).toHaveLength(0);
  });

  it("turns workbook sheets into readable local text", async () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([["姓名", "Email"], ["王小明", "a@example.com"]]);
    XLSX.utils.book_append_sheet(workbook, sheet, "客戶資料");
    const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const file = new File([bytes], "customers.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const parsed = await parseDocument(file);

    expect(parsed.fileType).toBe("xlsx");
    expect(parsed.sheetCount).toBe(1);
    expect(parsed.text).toContain("【工作表：客戶資料】");
    expect(parsed.text).toContain("a@example.com");
  });

  it("stops before parsing when a local cancellation signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const file = new File(["姓名：王小明"], "notes.txt", { type: "text/plain" });
    await expect(parseDocument(file, { signal: controller.signal })).rejects.toBeInstanceOf(DocumentParseCancelledError);
  });
});

describe("buildBrandedFileName", () => {
  it("adds the 無意識 brand prefix to local exports", () => {
    expect(buildBrandedFileName("customers.xlsx", "local", "xlsx")).toBe("無意識-去識別化工作站-customers-local.xlsx");
  });

  it("does not duplicate the brand prefix", () => {
    expect(buildBrandedFileName("無意識-去識別化工作站-customers", "local", "txt")).toBe("無意識-去識別化工作站-customers-local.txt");
  });
});
