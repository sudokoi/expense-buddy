/**
 * Expression Parser Utility
 * Parses and evaluates basic arithmetic expressions for expense amount entry.
 * Supports: +, -, *, / operators with standard precedence.
 */

export interface ParseResult {
  success: boolean;
  value?: number;
  error?: string;
}

type Token =
  | { type: "number"; value: number }
  | { type: "operator"; value: string };

/**
 * Tokenizes an expression string into numbers and operators.
 */
function tokenize(expression: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  const expr = expression.replace(/\s/g, "");

  while (i < expr.length) {
    const char = expr[i];

    // Handle operators
    if (["+", "-", "*", "/"].includes(char)) {
      // Handle negative numbers at start or after operator
      if (
        char === "-" &&
        (tokens.length === 0 || tokens[tokens.length - 1].type === "operator")
      ) {
        // This is a negative sign for a number
        let numStr = "-";
        i++;
        while (i < expr.length && (/\d/.test(expr[i]) || expr[i] === ".")) {
          numStr += expr[i];
          i++;
        }
        if (numStr === "-") return null; // Just a minus with nothing after
        const num = parseFloat(numStr);
        if (isNaN(num)) return null;
        tokens.push({ type: "number", value: num });
      } else {
        tokens.push({ type: "operator", value: char });
        i++;
      }
    }
    // Handle numbers
    else if (/\d/.test(char) || char === ".") {
      let numStr = "";
      while (i < expr.length && (/\d/.test(expr[i]) || expr[i] === ".")) {
        numStr += expr[i];
        i++;
      }
      const num = parseFloat(numStr);
      if (isNaN(num)) return null;
      tokens.push({ type: "number", value: num });
    }
    // Invalid character
    else {
      return null;
    }
  }

  return tokens;
}

/**
 * Validates token sequence for proper syntax.
 */
function validateTokens(tokens: Token[]): boolean {
  if (tokens.length === 0) return false;

  // Must start with a number
  if (tokens[0].type !== "number") return false;

  // Must end with a number
  if (tokens[tokens.length - 1].type !== "number") return false;

  // Check for consecutive operators
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i].type === "operator" && tokens[i + 1].type === "operator") {
      return false;
    }
  }

  // Check alternating pattern: number, operator, number, operator, ...
  for (let i = 0; i < tokens.length; i++) {
    const expectedType = i % 2 === 0 ? "number" : "operator";
    if (tokens[i].type !== expectedType) return false;
  }

  return true;
}

/**
 * Evaluates tokens with proper operator precedence.
 * Multiplication and division are evaluated before addition and subtraction.
 */
function evaluate(tokens: Token[]): number {
  // First pass: handle * and /
  const intermediate: (number | string)[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    if (token.type === "number") {
      intermediate.push(token.value);
    } else if (token.type === "operator") {
      const op = token.value;
      if (op === "*" || op === "/") {
        const left = intermediate.pop() as number;
        const right = (tokens[i + 1] as { type: "number"; value: number })
          .value;
        const result = op === "*" ? left * right : left / right;
        intermediate.push(result);
        i++; // Skip the next number since we already used it
      } else {
        intermediate.push(op);
      }
    }
    i++;
  }

  // Second pass: handle + and -
  let result = intermediate[0] as number;
  for (let j = 1; j < intermediate.length; j += 2) {
    const op = intermediate[j] as string;
    const right = intermediate[j + 1] as number;
    result = op === "+" ? result + right : result - right;
  }

  return result;
}

/**
 * Evaluates a basic arithmetic expression string.
 * Supports: +, -, *, / operators with standard precedence.
 *
 * @param expression - The expression string to evaluate (e.g., "211+192")
 * @returns ParseResult with evaluated value or error message
 */
export function parseExpression(expression: string): ParseResult {
  // 1. Trim and validate input
  const trimmed = expression.trim();
  if (!trimmed) {
    return { success: false, error: "Please enter a valid amount" };
  }

  // 2. Check for valid characters only (digits, operators, decimal point, whitespace)
  if (!/^[\d+\-*/.\s]+$/.test(trimmed)) {
    return { success: false, error: "Invalid characters in expression" };
  }

  // 3. Tokenize into numbers and operators
  const tokens = tokenize(trimmed);
  if (!tokens) {
    return { success: false, error: "Invalid expression syntax" };
  }

  // 4. Validate token sequence (no consecutive operators, etc.)
  if (!validateTokens(tokens)) {
    return { success: false, error: "Invalid expression syntax" };
  }

  // 5. Evaluate with operator precedence
  const result = evaluate(tokens);

  // 6. Check for division by zero and valid result
  if (!isFinite(result) || isNaN(result)) {
    return { success: false, error: "Cannot divide by zero" };
  }

  // 7. Check for zero or negative result
  if (result <= 0) {
    return { success: false, error: "Amount must be greater than zero" };
  }

  return { success: true, value: result };
}

/**
 * Checks if a string contains arithmetic operators.
 * Used to determine if preview should be shown.
 *
 * @param input - The input string to check
 * @returns true if the string contains +, -, *, or / operators
 */
export function hasOperators(input: string): boolean {
  // Check for operators that are not at the start (to exclude negative numbers)
  const trimmed = input.trim();
  if (!trimmed) return false;

  // Remove leading minus (negative number) and check for remaining operators
  const withoutLeadingMinus = trimmed.startsWith("-")
    ? trimmed.slice(1)
    : trimmed;
  return /[+\-*/]/.test(withoutLeadingMinus);
}

/**
 * Formats a number for display with 2 decimal places.
 *
 * @param value - The number to format
 * @returns Formatted string (e.g., "403.00")
 */
export function formatAmount(value: number): string {
  return value.toFixed(2);
}
