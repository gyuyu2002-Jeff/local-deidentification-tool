/* Design philosophy: quiet archival utility — tests protect predictable, auditable transformations. */

import { describe, expect, it } from "vitest";
import { deidentifyText } from "./deidentify";

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
});

