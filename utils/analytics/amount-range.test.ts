import { parseAmountRange } from "./amount-range"

describe("parseAmountRange", () => {
  it("clears both bounds when reset to empty text", () => {
    expect(parseAmountRange("", " ", false)).toEqual({
      minAmount: null,
      maxAmount: null,
      error: null,
    })
  })
  it("allows zero and open-ended ranges", () => {
    expect(parseAmountRange("0", "", false)).toEqual({
      minAmount: 0,
      maxAmount: null,
      error: null,
    })
    expect(parseAmountRange("", "120.50", false)).toEqual({
      minAmount: null,
      maxAmount: 120.5,
      error: null,
    })
  })
  it("validates the latest input without waiting for blur", () => {
    expect(parseAmountRange("50", "100", false).error).toBeNull()
    expect(parseAmountRange("500", "100", false).error).toBe("invalidRange")
    expect(parseAmountRange("100", "100", false).error).toBeNull()
  })
  it.each(["-1", "abc", "12foo", "1+", "Infinity"])(
    "rejects invalid input %s instead of silently clearing the filter",
    (input) => {
      expect(parseAmountRange(input, "", false).error).toBe("invalidAmount")
    }
  )
  it("respects math-entry preferences", () => {
    expect(parseAmountRange("10+20", "100/2", true)).toEqual({
      minAmount: 30,
      maxAmount: 50,
      error: null,
    })
    expect(parseAmountRange("10+20", "", false).error).toBe("invalidAmount")
  })
})
