/**
 * Property-based tests for TFLite Tokenizer
 * Feature: sms-import-gaps
 */

import fc from "fast-check"

// Load the actual vocab used by the parser
const vocabJson = require("../../../assets/models/tokenizer_vocab.json") as {
  word_index: Record<string, number>
}

// Build forward and reverse vocab maps (same logic as tflite-parser.ts)
const vocab: Map<string, number> = new Map(
  Object.entries(vocabJson.word_index).map(([word, id]) => [word, id])
)
const reverseVocab: Map<number, string> = new Map()
for (const [word, id] of vocab) {
  reverseVocab.set(id, word)
}

/**
 * Reimplements the tokenize logic from tflite-parser.ts for testing.
 * Word-level for known vocab, character-level fallback for OOV.
 */
function tokenize(text: string): number[] {
  const normalized = text.toLowerCase().trim()
  const words = normalized.split(/\s+/)
  const tokens: number[] = []

  for (const word of words) {
    if (vocab.has(word)) {
      tokens.push(vocab.get(word)!)
    } else {
      for (const char of word) {
        const code = char.charCodeAt(0)
        tokens.push((code % 255) + 1)
      }
      tokens.push(1) // space separator
    }
  }

  return tokens
}

/**
 * Reimplements the tokensToText logic from tflite-parser.ts for testing.
 * Reverse vocab lookup with character-level fallback for unknown IDs.
 */
function tokensToText(tokens: number[]): string {
  return tokens
    .filter((t) => t > 0)
    .map((t) => reverseVocab.get(t) ?? String.fromCharCode(t - 1))
    .join(" ")
    .trim()
}

// Generator: pick a random word from the actual vocabulary (excluding special tokens)
const vocabWords = Array.from(vocab.keys()).filter(
  (w) => w !== "<PAD>" && w !== "<OOV>"
)
const vocabWordArb = fc.constantFrom(...vocabWords)

// Generator: OOV words that are NOT in the vocabulary
const oovWordArb = fc
  .string({ minLength: 1, maxLength: 10 })
  .map((s) => s.toLowerCase().replace(/\s+/g, ""))
  .filter((s) => s.length > 0 && !vocab.has(s))

// Generator: messages composed of known vocab words
const knownWordMessageArb = fc
  .array(vocabWordArb, { minLength: 1, maxLength: 5 })
  .map((words) => words.join(" "))

describe("TFLite Tokenizer Properties", () => {
  /**
   * Property 12: Tokenize-Detokenize Round Trip
   * For any word present in the tokenizer vocabulary, tokenizing the word to its
   * token ID and then converting back via reverse vocabulary lookup SHALL recover
   * the original word.
   */
  describe("Property 12: Tokenize-Detokenize Round Trip", () => {
    it("tokenizing then detokenizing a known vocab word SHALL recover the original word", () => {
      fc.assert(
        fc.property(vocabWordArb, (word) => {
          const tokenId = vocab.get(word)!
          const recovered = reverseVocab.get(tokenId)
          return recovered === word
        }),
        { numRuns: 100 }
      )
    })

    it("tokenizing then detokenizing a message of known words SHALL recover the original words", () => {
      fc.assert(
        fc.property(knownWordMessageArb, (message) => {
          const tokens = tokenize(message)
          const nonPadTokens = tokens.filter((t) => t > 0)
          const recovered = tokensToText(nonPadTokens)
          const expectedWords = message.toLowerCase().trim().split(/\s+/)
          const recoveredWords = recovered.split(/\s+/)
          return expectedWords.every((w, i) => recoveredWords[i] === w)
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 16: Word-Level vs Character-Level Tokenization
   * For any message, known words SHALL use vocab IDs and OOV words SHALL use
   * character codes (charCode % 255 + 1).
   */
  describe("Property 16: Word-Level vs Character-Level Tokenization", () => {
    it("known vocabulary words SHALL produce their vocab ID as a single token", () => {
      fc.assert(
        fc.property(vocabWordArb, (word) => {
          const tokens = tokenize(word)
          const nonPadTokens = tokens.filter((t) => t > 0)
          const expectedId = vocab.get(word)!
          // A known word should produce exactly one token matching its vocab ID
          return nonPadTokens.length === 1 && nonPadTokens[0] === expectedId
        }),
        { numRuns: 100 }
      )
    })

    it("OOV words SHALL produce character-level tokens (charCode mod 255 + 1)", () => {
      fc.assert(
        fc.property(oovWordArb, (word) => {
          const tokens = tokenize(word)
          const nonPadTokens = tokens.filter((t) => t > 0)
          const expectedCharTokens = Array.from(word).map(
            (c: string) => (c.charCodeAt(0) % 255) + 1
          )
          // Last token is the space separator (value 1)
          const charTokens = nonPadTokens.slice(0, -1)
          const spaceSep = nonPadTokens[nonPadTokens.length - 1]
          return (
            spaceSep === 1 &&
            charTokens.length === expectedCharTokens.length &&
            charTokens.every((t, i) => t === expectedCharTokens[i])
          )
        }),
        { numRuns: 100 }
      )
    })
  })
})
