/**
 * Property-based tests for Expression Parser
 */

import fc from "fast-check";
import { parseExpression, formatAmount } from "./expression-parser";

describe("Expression Parser Properties", () => {
  /**
   * Property 1: Plain Number Identity
   * For any valid positive number (integer or decimal), parsing its string
   * representation should return that exact number (within floating-point tolerance).
   */
  describe("Property 1: Plain Number Identity", () => {
    it("should return the same value for plain positive numbers", () => {
      fc.assert(
        fc.property(
          fc.float({
            min: Math.fround(0.01),
            max: Math.fround(999999),
            noNaN: true,
          }),
          (num) => {
            // Round to 2 decimal places to avoid floating point precision issues
            const roundedNum = Math.round(num * 100) / 100;
            if (roundedNum <= 0) return true; // Skip non-positive numbers

            const result = parseExpression(roundedNum.toString());
            return (
              result.success === true &&
              result.value !== undefined &&
              Math.abs(result.value - roundedNum) < 0.001
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should return the same value for plain positive integers", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 999999 }), (num) => {
          const result = parseExpression(num.toString());
          return (
            result.success === true &&
            result.value !== undefined &&
            result.value === num
          );
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 2: Binary Operation Correctness
   * For any two valid positive numbers a and b, and any operator op in {+, -, *, /}
   * (where b ≠ 0 for division), parsing "a op b" should return a value equal to
   * the corresponding arithmetic operation.
   */
  describe("Property 2: Binary Operation Correctness", () => {
    // Addition
    it("should correctly evaluate addition of two positive numbers", () => {
      fc.assert(
        fc.property(
          fc.float({
            min: Math.fround(0.01),
            max: Math.fround(10000),
            noNaN: true,
          }),
          fc.float({
            min: Math.fround(0.01),
            max: Math.fround(10000),
            noNaN: true,
          }),
          (a, b) => {
            const roundedA = Math.round(a * 100) / 100;
            const roundedB = Math.round(b * 100) / 100;
            if (roundedA <= 0 || roundedB <= 0) return true;

            const expression = `${roundedA}+${roundedB}`;
            const result = parseExpression(expression);
            const expected = roundedA + roundedB;

            return (
              result.success === true &&
              result.value !== undefined &&
              Math.abs(result.value - expected) < 0.01
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    // Subtraction (only when result is positive)
    it("should correctly evaluate subtraction when result is positive", () => {
      fc.assert(
        fc.property(
          fc.float({
            min: Math.fround(1),
            max: Math.fround(10000),
            noNaN: true,
          }),
          fc.float({
            min: Math.fround(0.01),
            max: Math.fround(10000),
            noNaN: true,
          }),
          (a, b) => {
            const roundedA = Math.round(a * 100) / 100;
            const roundedB = Math.round(b * 100) / 100;

            // Only test when result would be positive
            if (roundedA <= roundedB) return true;

            const expression = `${roundedA}-${roundedB}`;
            const result = parseExpression(expression);
            const expected = roundedA - roundedB;

            return (
              result.success === true &&
              result.value !== undefined &&
              Math.abs(result.value - expected) < 0.01
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    // Multiplication
    it("should correctly evaluate multiplication of two positive numbers", () => {
      fc.assert(
        fc.property(
          fc.float({
            min: Math.fround(0.01),
            max: Math.fround(100),
            noNaN: true,
          }),
          fc.float({
            min: Math.fround(0.01),
            max: Math.fround(100),
            noNaN: true,
          }),
          (a, b) => {
            const roundedA = Math.round(a * 100) / 100;
            const roundedB = Math.round(b * 100) / 100;
            if (roundedA <= 0 || roundedB <= 0) return true;

            const expression = `${roundedA}*${roundedB}`;
            const result = parseExpression(expression);
            const expected = roundedA * roundedB;

            return (
              result.success === true &&
              result.value !== undefined &&
              Math.abs(result.value - expected) < 0.01
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    // Division (b ≠ 0)
    it("should correctly evaluate division when divisor is non-zero", () => {
      fc.assert(
        fc.property(
          fc.float({
            min: Math.fround(1),
            max: Math.fround(10000),
            noNaN: true,
          }),
          fc.float({
            min: Math.fround(0.01),
            max: Math.fround(100),
            noNaN: true,
          }),
          (a, b) => {
            const roundedA = Math.round(a * 100) / 100;
            const roundedB = Math.round(b * 100) / 100;
            if (roundedA <= 0 || roundedB <= 0) return true;

            const expected = roundedA / roundedB;
            // Skip if result would be non-positive
            if (expected <= 0) return true;

            const expression = `${roundedA}/${roundedB}`;
            const result = parseExpression(expression);

            return (
              result.success === true &&
              result.value !== undefined &&
              Math.abs(result.value - expected) < 0.01
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 3: Operator Precedence
   * For any expression of the form "a + b * c" or "a - b / c" where all values
   * are valid positive numbers (and divisor ≠ 0), the parser should evaluate
   * multiplication/division before addition/subtraction.
   */
  describe("Property 3: Operator Precedence", () => {
    it("should evaluate multiplication before addition (a + b * c)", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          (a, b, c) => {
            const expression = `${a}+${b}*${c}`;
            const result = parseExpression(expression);
            // Correct precedence: a + (b * c), not (a + b) * c
            const expected = a + b * c;

            return (
              result.success === true &&
              result.value !== undefined &&
              result.value === expected
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should evaluate division before addition (a + b / c)", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          (a, b, c) => {
            if (c === 0) return true; // Skip division by zero

            const expression = `${a}+${b}/${c}`;
            const result = parseExpression(expression);
            // Correct precedence: a + (b / c), not (a + b) / c
            const expected = a + b / c;

            return (
              result.success === true &&
              result.value !== undefined &&
              Math.abs(result.value - expected) < 0.01
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should evaluate multiplication before subtraction (a - b * c) when result is positive", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1, max: 10 }),
          (a, b, c) => {
            const expected = a - b * c;
            // Skip if result would be non-positive
            if (expected <= 0) return true;

            const expression = `${a}-${b}*${c}`;
            const result = parseExpression(expression);

            return (
              result.success === true &&
              result.value !== undefined &&
              result.value === expected
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should evaluate division before subtraction (a - b / c) when result is positive", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 1000 }),
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          (a, b, c) => {
            if (c === 0) return true; // Skip division by zero

            const expected = a - b / c;
            // Skip if result would be non-positive
            if (expected <= 0) return true;

            const expression = `${a}-${b}/${c}`;
            const result = parseExpression(expression);

            return (
              result.success === true &&
              result.value !== undefined &&
              Math.abs(result.value - expected) < 0.01
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 4: Invalid Character Rejection
   * For any string containing characters other than digits, decimal points,
   * operators (+, -, *, /), and whitespace, parsing should return an error.
   */
  describe("Property 4: Invalid Character Rejection", () => {
    it("should reject expressions containing alphabetic characters", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          fc.constantFrom(
            "a",
            "b",
            "c",
            "d",
            "e",
            "f",
            "g",
            "h",
            "i",
            "j",
            "k",
            "l",
            "m",
            "n",
            "o",
            "p",
            "q",
            "r",
            "s",
            "t",
            "u",
            "v",
            "w",
            "x",
            "y",
            "z",
            "A",
            "B",
            "C",
            "X",
            "Y",
            "Z"
          ),
          fc.integer({ min: 1, max: 1000 }),
          (a, invalidChar, b) => {
            const expression = `${a}${invalidChar}${b}`;
            const result = parseExpression(expression);
            return result.success === false && result.error !== undefined;
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should reject expressions containing special characters", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          fc.constantFrom(
            "@",
            "#",
            "$",
            "%",
            "^",
            "&",
            "(",
            ")",
            "=",
            "!",
            "?",
            "<",
            ">",
            "[",
            "]",
            "{",
            "}",
            "|",
            "\\",
            "~",
            "`",
            ";",
            ":",
            "'",
            '"',
            ","
          ),
          fc.integer({ min: 1, max: 1000 }),
          (a, invalidChar, b) => {
            const expression = `${a}${invalidChar}${b}`;
            const result = parseExpression(expression);
            return result.success === false && result.error !== undefined;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5: Invalid Syntax Rejection
   * For any expression with consecutive non-minus operators, leading operators (except minus),
   * or trailing operators, parsing should return an error.
   * Note: Minus after an operator is valid as it indicates a negative number (e.g., "5+-3" = "5 + (-3)")
   */
  describe("Property 5: Invalid Syntax Rejection", () => {
    it("should reject expressions with consecutive non-minus operators", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          fc.constantFrom("+", "*", "/"),
          fc.constantFrom("+", "*", "/"),
          fc.integer({ min: 1, max: 1000 }),
          (a, op1, op2, b) => {
            const expression = `${a}${op1}${op2}${b}`;
            const result = parseExpression(expression);
            return result.success === false && result.error !== undefined;
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should reject expressions starting with non-minus operators", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("+", "*", "/"),
          fc.integer({ min: 1, max: 1000 }),
          (op, num) => {
            const expression = `${op}${num}`;
            const result = parseExpression(expression);
            return result.success === false && result.error !== undefined;
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should reject expressions ending with operators", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          fc.constantFrom("+", "-", "*", "/"),
          (num, op) => {
            const expression = `${num}${op}`;
            const result = parseExpression(expression);
            return result.success === false && result.error !== undefined;
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should reject expressions with multiple consecutive operators", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          fc.constantFrom("++", "**", "//", "+-+", "*-*", "/-/"),
          fc.integer({ min: 1, max: 1000 }),
          (a, ops, b) => {
            const expression = `${a}${ops}${b}`;
            const result = parseExpression(expression);
            return result.success === false && result.error !== undefined;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 6: Division by Zero Handling
   * For any expression containing division by zero (e.g., "a/0"),
   * parsing should return an error.
   */
  describe("Property 6: Division by Zero Handling", () => {
    it("should reject expressions with division by zero", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000 }), (a) => {
          const expression = `${a}/0`;
          const result = parseExpression(expression);
          return result.success === false && result.error !== undefined;
        }),
        { numRuns: 100 }
      );
    });

    it("should reject complex expressions with division by zero", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          (a, b) => {
            const expression = `${a}+${b}/0`;
            const result = parseExpression(expression);
            return result.success === false && result.error !== undefined;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 7: Non-Positive Result Rejection
   * For any expression that evaluates to zero or a negative number,
   * parsing should return an error.
   */
  describe("Property 7: Non-Positive Result Rejection", () => {
    it("should reject expressions that evaluate to zero", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000 }), (num) => {
          const expression = `${num}-${num}`;
          const result = parseExpression(expression);
          return (
            result.success === false &&
            result.error === "Amount must be greater than zero"
          );
        }),
        { numRuns: 100 }
      );
    });

    it("should reject expressions that evaluate to negative numbers", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 1, max: 1000 }),
          (a, b) => {
            // Ensure b > a so result is negative
            const larger = Math.max(a, b) + 1;
            const smaller = Math.min(a, b);
            const expression = `${smaller}-${larger}`;
            const result = parseExpression(expression);
            return (
              result.success === false &&
              result.error === "Amount must be greater than zero"
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should reject multiplication results that are zero", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000 }), (num) => {
          const expression = `${num}*0`;
          const result = parseExpression(expression);
          return (
            result.success === false &&
            result.error === "Amount must be greater than zero"
          );
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 8: Amount Formatting Consistency
   * For any valid number, the formatAmount function should return a string
   * with exactly two decimal places.
   */
  describe("Property 8: Amount Formatting Consistency", () => {
    it("should format any positive number with exactly two decimal places", () => {
      fc.assert(
        fc.property(
          fc.float({
            min: Math.fround(0.01),
            max: Math.fround(999999.99),
            noNaN: true,
          }),
          (num) => {
            if (num <= 0 || !isFinite(num)) return true; // Skip invalid numbers

            const formatted = formatAmount(num);

            // Check that the result is a string
            if (typeof formatted !== "string") return false;

            // Check that it has exactly two decimal places
            const decimalMatch = formatted.match(/\.(\d+)$/);
            if (!decimalMatch) return false;

            return decimalMatch[1].length === 2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should format integers with .00 suffix", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 999999 }), (num) => {
          const formatted = formatAmount(num);

          // Should end with .00
          return formatted.endsWith(".00") && formatted === `${num}.00`;
        }),
        { numRuns: 100 }
      );
    });

    it("should preserve the numeric value when parsed back", () => {
      fc.assert(
        fc.property(
          fc.float({
            min: Math.fround(0.01),
            max: Math.fround(999999.99),
            noNaN: true,
          }),
          (num) => {
            if (num <= 0 || !isFinite(num)) return true; // Skip invalid numbers

            const formatted = formatAmount(num);
            const parsedBack = parseFloat(formatted);

            // The parsed value should be within 0.01 of the original
            // (accounting for rounding to 2 decimal places)
            return Math.abs(parsedBack - num) < 0.01;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
