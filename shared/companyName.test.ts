import { describe, expect, it } from "vitest";
import { displayCompanyName } from "./companyName";

describe("displayCompanyName", () => {
  it("strips common legal suffixes", () => {
    expect(displayCompanyName("Apple Inc.")).toBe("Apple");
    expect(displayCompanyName("Tesla, Inc.")).toBe("Tesla");
    expect(displayCompanyName("Intel Corporation")).toBe("Intel");
    expect(displayCompanyName("Exxon Mobil Corp.")).toBe("Exxon Mobil");
    expect(displayCompanyName("Johnson Controls Ltd")).toBe("Johnson Controls");
  });
  it("strips combined suffixes", () => {
    expect(displayCompanyName("Seagate Technology Holdings plc")).toBe("Seagate Technology");
    expect(displayCompanyName("Eli Lilly & Co.")).toBe("Eli Lilly");
  });
  it("leaves other names alone and never returns empty", () => {
    expect(displayCompanyName("The Walt Disney Company")).toBe("The Walt Disney Company");
    expect(displayCompanyName("  Inc.  ")).toBe("Inc.");
    expect(displayCompanyName("")).toBe("");
  });
});
