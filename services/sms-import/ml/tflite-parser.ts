/**
 * TensorFlow Lite SMS Parser
 *
 * On-device ML model for SMS transaction extraction.
 * Uses quantized MobileBERT model (8MB) fine-tuned on transaction SMS.
 */

import { loadTensorflowModel, TensorflowModel } from "react-native-fast-tflite"

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

  constructor(config?: Partial<TFLiteModelConfig>) {
    this.config = {
      modelPath: "sms_parser_model.tflite",
      maxInputLength: 256,
      confidenceThreshold: 0.7,
      useGpuDelegate: false, // Disabled by default for compatibility
      ...config,
    }
  }

  /**
   * Initialize the TFLite model
   * Loads model from assets and warms up
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      // Load model from assets
      const delegate = this.config.useGpuDelegate ? "android-gpu" : undefined
      this.model = await loadTensorflowModel(
        require(`../../../assets/models/${this.config.modelPath}`),
        delegate
      )

      // Warm up with dummy inference
      await this.warmup()

      this.initialized = true
      console.log("TFLite model initialized successfully")
    } catch (error) {
      console.error("Failed to initialize TFLite model:", error)
      throw new Error("ML model initialization failed")
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
      // Preprocess input to ArrayBuffer
      const inputBuffer = this.preprocess(message)

      // Run inference
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const output = await (this.model as any).run([inputBuffer.buffer])

      // Parse output
      const result = this.postprocess(output)

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
   * Preprocess SMS text for model input
   * Returns TypedArray for TFLite
   */
  private preprocess(message: string): Uint8Array {
    // Normalize text
    const normalized = message.toLowerCase().replace(/\s+/g, " ").trim()

    // Truncate/pad to max length
    const truncated = normalized.slice(0, this.config.maxInputLength)

    // Convert to bytes (character-level encoding for SMS)
    const encoder = new TextEncoder()
    const bytes = encoder.encode(truncated)

    // Create fixed-size buffer
    const view = new Uint8Array(this.config.maxInputLength)
    view.set(bytes.slice(0, this.config.maxInputLength))

    return view
  }

  /**
   * Postprocess model output to structured result
   */
  private postprocess(output: ArrayBuffer[]): MLParseResult {
    // Parse model output
    // Expected output format: [merchant_logits, amount_logits, date_logits, confidence]

    const view = new Float32Array(output[0], 0, output[0].byteLength / 4)

    // Extract entities from output tensor
    // Layout: [merchant_start, merchant_end, amount, year, month, day, confidence]
    const merchantStart = Math.floor(view[0] * this.config.maxInputLength)
    const merchantEnd = Math.floor(view[1] * this.config.maxInputLength)
    const amount = view[2]
    const year = Math.floor(view[3])
    const month = Math.floor(view[4])
    const day = Math.floor(view[5])
    const confidence = view[6]

    // Build result
    const merchant = "Unknown" // Would extract from input using indices
    const date = new Date(year, month - 1, day).toISOString()

    return {
      merchant,
      amount: Math.abs(amount),
      date,
      confidence: Math.min(Math.max(confidence, 0), 1), // Clamp 0-1
    }
  }

  /**
   * Warm up model with dummy inference
   */
  private async warmup(): Promise<void> {
    const dummyInput = this.preprocess("Rs. 1000 spent at Amazon on 01-01-2024")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (this.model as any).run([dummyInput.buffer])
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
      // Model cleanup is handled automatically by the library
      this.model = null
      this.initialized = false
    }
  }
}
