import { describe, expect, it } from "vitest";
import { parseCustomDictionary, serializeCustomDictionary } from "./custom-dictionary";

describe("custom dictionary", () => {
  it("serializes and restores a de-duplicated local dictionary", () => {
    const json = serializeCustomDictionary(["專案代號", " 客戶姓名 ", "專案代號"]);
    expect(parseCustomDictionary(json)).toEqual(["專案代號", "客戶姓名"]);
  });

  it("accepts a simple terms array for portable imports", () => {
    expect(parseCustomDictionary(JSON.stringify(["內部代號", "客戶姓名"]))).toEqual(["內部代號", "客戶姓名"]);
  });

  it("rejects malformed dictionary files", () => {
    expect(() => parseCustomDictionary("{\"items\": []}")).toThrow("需要包含 terms 陣列");
  });
});
