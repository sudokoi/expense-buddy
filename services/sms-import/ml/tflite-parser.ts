/**
 * TensorFlow Lite SMS Parser
 *
 * On-device ML model for SMS transaction extraction.
 * Uses Bi-LSTM model with NER for entity extraction.
 * 
 * Model specs:
 * - Input: Token IDs (128 integers)
 * - Output: NER labels (128 x 7 classes)
 * - Classes: O, B-MERCHANT, I-MERCHANT, B-AMOUNT, I-AMOUNT, B-DATE, I-DATE
 */

import { loadTensorflowModel, TensorflowModel } from "react-native-fast-tflite"

// NER label indices
const LABELS = ['O', 'B-MERCHANT', 'I-MERCHANT', 'B-AMOUNT', 'I-AMOUNT', 'B-DATE', 'I-DATE']

export interface MLParseResult {
  merchant: string
  amount: number
  date: string
  confidence: number
}

export interface TFLiteModelConfig {
  modelPath: string
  maxInputLength: number
  confidenceThreshold: number
  useGpuDelegate: boolean
}

export class TFLiteSMSParser {
  private model: TensorflowModel | null = null
  private config: TFLiteModelConfig
  private initialized = false
  private vocab: Map<string, number> | null = null
  private oovToken = '<OOV>'

  constructor(config?: Partial<TFLiteModelConfig>) {
    this.config = {
      modelPath: "sms_parser_model.tflite",
      maxInputLength: 128,
      confidenceThreshold: 0.7,
      useGpuDelegate: false,
      ...config,
    }
  }

  /**
   * Initialize the TFLite model
   * Loads model from assets and tokenizer vocab
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      // Load tokenizer vocab
      await this.loadVocab()

      // Load model from assets
      const delegate = this.config.useGpuDelegate ? "android-gpu" : undefined

      let modelPath
      try {
        modelPath = require(`../../../assets/models/${this.config.modelPath}`)
      } catch {
        console.log("ML model not found, will use regex-only mode")
        return
      }

      this.model = await loadTensorflowModel(modelPath, delegate)

      // Warm up with dummy inference
      await this.warmup()

      this.initialized = true
      console.log("TFLite model initialized successfully")
    } catch (error) {
      console.error("Failed to initialize TFLite model:", error)
      console.log("Falling back to regex-only mode")
    }
  }

  /**
   * Load tokenizer vocabulary
   */
  private async loadVocab(): Promise<void> {
    try {
      // In production, load from JSON file
      // For now, use a basic character-level approach as fallback
      const vocabJson = require("../../../assets/models/tokenizer_vocab.json")
      this.vocab = new Map(Object.entries(vocabJson.word_index))
      console.log(`Loaded vocab: ${this.vocab.size} words`)
    } catch {
      console.log("Tokenizer vocab not found, using character-level fallback")
      this.vocab = null
    }
  }

  /**
   * Parse SMS using ML model
   */
  async parse(message: string): Promise<MLParseResult | null> {
    if (!this.initialized || !this.model) {
      throw new Error("Model not initialized")
    }

    try {
      // Tokenize input
      const tokens = this.tokenize(message)

      // Run inference
      const output = await this.runInference(tokens)

      // Parse NER output
      const result = this.extractEntities(message, tokens, output)

      if (result.confidence >= this.config.confidenceThreshold) {
        return result
      }

      return null
    } catch (error) {
      console.error("ML inference failed:", error)
      return null
    }
  }

  /**
   * Tokenize text to integer IDs
   */
  private tokenize(text: string): number[] {
    const normalized = text.toLowerCase().trim()
    const words = normalized.split(/\s+/)

    const tokens: number[] = []
    
    for (const word of words) {
      if (this.vocab && this.vocab.has(word)) {
        tokens.push(this.vocab.get(word)!)
      } else {
        // Character-level fallback for unknown words
        for (const char of word) {
          const code = char.charCodeAt(0)
          // Map to 1-255 range, reserve 0 for padding
          tokens.push((code % 255) + 1)
        }
        // Add space separator
        tokens.push(1) // space character code
      }
    }

    // Pad/truncate to max length
    if (tokens.length > this.config.maxInputLength) {
      return tokens.slice(0, this.config.maxInputLength)
    }
    
    // Pad with zeros
    while (tokens.length < this.config.maxInputLength) {
      tokens.push(0)
    }

    return tokens
  }

  /**
   * Run model inference
   */
  private async runInference(tokens: number[]): Promise<Float32Array> {
    // Convert tokens to Float32Array (model expects float input)
    const inputArray = new Float32Array(tokens.map(t => t))
    
    // Run inference - returns array of output tensors
    const outputs = await (this.model as any).run([inputArray.buffer as ArrayBuffer])
    
    // Output is [batch, sequence, classes] = [1, 128, 7]
    return new Float32Array(outputs[0])
  }

  /**
   * Extract entities from NER output
   */
  private extractEntities(
    originalText: string,
    tokens: number[],
    output: Float32Array
  ): MLParseResult {
    const seqLen = this.config.maxInputLength
    const numClasses = LABELS.length
    
    // Get predicted label for each position
    const predictions: number[] = []
    for (let i = 0; i < seqLen; i++) {
      let maxProb = -Infinity
      let maxLabel = 0
      
      for (let j = 0; j < numClasses; j++) {
        const prob = output[i * numClasses + j]
        if (prob > maxProb) {
          maxProb = prob
          maxLabel = j
        }
      }
      predictions.push(maxLabel)
    }

    // Extract merchant (B-MERCHANT = 1, I-MERCHANT = 2)
    let merchant = "Unknown"
    const merchantTokens: number[] = []
    let inMerchant = false
    
    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i] === 1) { // B-MERCHANT
        inMerchant = true
        merchantTokens.length = 0
        merchantTokens.push(tokens[i])
      } else if (predictions[i] === 2 && inMerchant) { // I-MERCHANT
        merchantTokens.push(tokens[i])
      } else if (inMerchant) {
        break
      }
    }

    if (merchantTokens.length > 0) {
      // Convert tokens back to text (simplified)
      merchant = this.tokensToText(merchantTokens)
    }

    // Extract amount (B-AMOUNT = 3, I-AMOUNT = 4)
    let amount = 0
    const amountTokens: number[] = []
    let inAmount = false
    
    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i] === 3) { // B-AMOUNT
        inAmount = true
        amountTokens.length = 0
        amountTokens.push(tokens[i])
      } else if (predictions[i] === 4 && inAmount) { // I-AMOUNT
        amountTokens.push(tokens[i])
      } else if (inAmount) {
        break
      }
    }

    if (amountTokens.length > 0) {
      const amountText = this.tokensToText(amountTokens)
      // Extract number from text
      const match = amountText.match(/[\d,]+\.?\d*/)
      if (match) {
        amount = parseFloat(match[0].replace(/,/g, ''))
      }
    }

    // Extract date (B-DATE = 5, I-DATE = 6)
    let date = new Date().toISOString()
    const dateTokens: number[] = []
    let inDate = false
    
    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i] === 5) { // B-DATE
        inDate = true
        dateTokens.length = 0
        dateTokens.push(tokens[i])
      } else if (predictions[i] === 6 && inDate) { // I-DATE
        dateTokens.push(tokens[i])
      } else if (inDate) {
        break
      }
    }

    if (dateTokens.length > 0) {
      const dateText = this.tokensToText(dateTokens)
      // Try to parse date
      const parsedDate = this.parseDate(dateText)
      if (parsedDate) {
        date = parsedDate.toISOString()
      }
    }

    // Calculate confidence as average of entity probabilities
    const entityProbs: number[] = []
    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i] > 0) { // Non-O label
        const prob = output[i * numClasses + predictions[i]]
        entityProbs.push(prob)
      }
    }
    
    const confidence = entityProbs.length > 0
      ? entityProbs.reduce((a, b) => a + b, 0) / entityProbs.length
      : 0.5

    return {
      merchant,
      amount: Math.abs(amount),
      date,
      confidence: Math.min(Math.max(confidence, 0), 1),
    }
  }

  /**
   * Convert tokens back to text (simplified)
   */
  private tokensToText(tokens: number[]): string {
    // Reverse vocab lookup (simplified)
    if (!this.vocab) {
      // Character-level decoding
      return tokens
        .filter(t => t > 0)
        .map(t => String.fromCharCode(t - 1))
        .join('')
    }

    // Word-level decoding would require reverse mapping
    return "Extracted Entity"
  }

  /**
   * Parse date string to Date object
   */
  private parseDate(dateStr: string): Date | null {
    // Try common date formats
    const formats = [
      // DD-MM-YYYY or DD/MM/YYYY
      /(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/,
      // YYYY-MM-DD
      /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/,
    ]

    for (const format of formats) {
      const match = dateStr.match(format)
      if (match) {
        const groups = match.slice(1).map(Number)
        
        if (groups[0] > 31) {
          // YYYY-MM-DD format
          return new Date(groups[0], groups[1] - 1, groups[2])
        } else {
          // DD-MM-YYYY format
          const year = groups[2] < 100 ? 2000 + groups[2] : groups[2]
          return new Date(year, groups[1] - 1, groups[0])
        }
      }
    }

    return null
  }

  /**
   * Warm up model with dummy inference
   */
  private async warmup(): Promise<void> {
    const dummyTokens = this.tokenize("Rs. 1000 spent at Amazon on 01-01-2024")
    await this.runInference(dummyTokens)
  }

  /**
   * Check if model is ready
   */
  isReady(): boolean {
    return this.initialized
  }

  /**
   * Dispose model to free memory
   */
  async dispose(): Promise<void> {
    if (this.model) {
      this.model = null
      this.initialized = false
    }
  }
}
