# SMS Auto-Import Feature Implementation Plan

**Branch:** `feature/sms-expense-import`  
**Status:** In Development  
**Last Updated:** 2026-02-15  
**Author:** Development Team

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Requirements](#requirements)
3. [Architecture Overview](#architecture-overview)
4. [Data Models](#data-models)
5. [Implementation Phases](#implementation-phases)
6. [Technical Specifications](#technical-specifications)
7. [User Interface](#user-interface)
8. [Testing Strategy](#testing-strategy)
9. [Security & Privacy](#security--privacy)
10. [GitHub Sync Integration](#github-sync-integration)
11. [Sync Trigger Behavior](#sync-trigger-behavior)
12. [Migration Strategy](#migration-strategy)
13. [Appendices](#appendices)

---

## Executive Summary

This document outlines the implementation plan for adding SMS-based automatic expense import functionality to Expense Buddy. The feature will:

- **Monitor incoming SMS messages** for transaction messages from banks and payment providers
- **Parse transaction data** using an on-device ML model (TensorFlow Lite Bi-LSTM)
- **Present all expenses for user review** before adding to the expense list (no auto-import bypass in v1)
- **Learn from user corrections** to improve future categorization
- **Prevent duplicate entries** through sophisticated fingerprinting
- **Tag imported expenses** with "auto-imported" label and metadata

**Key Benefits:**

- Reduces manual data entry friction
- Captures expenses users might forget to log
- Provides learning system that improves over time
- Maintains 100% on-device processing for privacy

> **v1 Scope Note:** This version is scoped to SMS-only. Notification listener support (which requires a native Android `NotificationListenerService` module — `expo-notifications` only handles the app's own push notifications) is deferred to a future version.

---

## Requirements

### Functional Requirements

#### FR-1: SMS Import

- **FR-1.1:** Support SMS message monitoring (with user permission)
- **FR-1.2:** Provide on-demand historical SMS inbox scanning

#### FR-2: Transaction Parsing

- **FR-2.1:** Extract: amount, currency, merchant, date, payment method, transaction type
- **FR-2.2:** Support multiple bank SMS formats (Indian, US, EU, JP banks)
- **FR-2.3:** Support UPI wallet SMS (Paytm, GPay, PhonePe)
- **FR-2.4:** Calculate confidence score for each parsed transaction

#### FR-3: Duplicate Detection

- **FR-3.1:** Prevent duplicate imports using message ID fingerprinting
- **FR-3.2:** Detect potential duplicates by amount + date + merchant similarity
- **FR-3.3:** Store last 1000 processed message IDs (rotating window)
- **FR-3.4:** Show duplicate warning when similar expense exists

#### FR-4: Review Queue System

- **FR-4.1:** Queue imported transactions for user review
- **FR-4.2:** Show transaction details with editable fields
- **FR-4.3:** Allow confirmation, editing, or rejection
- **FR-4.4:** Support bulk actions (confirm all, reject all)
- **FR-4.5:** Auto-remove items after 30 days if not reviewed

#### FR-5: Auto-Import Tagging

- **FR-5.1:** Add `source: 'auto-imported'` to expense metadata
- **FR-5.2:** Store complete SMS content in metadata
- **FR-5.3:** Display "Auto-imported" badge in expense lists
- **FR-5.4:** Show "SMS Import" source indicator in UI

#### FR-6: Learning System

- **FR-6.1:** Track merchant → category mappings
- **FR-6.2:** Track merchant → payment method mappings
- **FR-6.3:** Suggest category/payment method based on patterns
- **FR-6.4:** Update confidence scores based on user confirmations
- **FR-6.5:** Store user corrections for future transactions
- **FR-6.6:** Support fuzzy matching for similar merchant names

#### FR-7: Manual Tagging Interface

- **FR-7.1:** Allow users to edit category before saving
- **FR-7.2:** Allow users to edit payment method and instrument
- **FR-7.3:** Allow users to add/edit note
- **FR-7.4:** Provide option to "Apply to future transactions"
- **FR-7.5:** Show prediction confidence and suggestions

### Non-Functional Requirements

#### NFR-1: Performance

- **NFR-1.1:** Parse SMS within 100ms
- **NFR-1.2:** Review queue must handle 100+ items smoothly
- **NFR-1.3:** Learning engine lookup under 50ms
- **NFR-1.4:** App startup time increase < 500ms

#### NFR-2: Privacy & Security

- **NFR-2.1:** All processing on-device only
- **NFR-2.2:** No SMS content sent to cloud services
- **NFR-2.3:** No analytics on transaction data
- **NFR-2.4:** Secure storage of merchant patterns
- **NFR-2.5:** Allow complete feature disable and data deletion

#### NFR-3: Reliability

- **NFR-3.1:** 99.9% duplicate detection accuracy
- **NFR-3.2:** Graceful handling of malformed SMS
- **NFR-3.3:** Recovery from app crashes during import
- **NFR-3.4:** Background processing without battery drain

#### NFR-4: Accessibility

- **NFR-4.1:** WCAG 2.1 AA compliance for all new UI
- **NFR-4.2:** Support screen readers
- **NFR-4.3:** Minimum touch target 44x44dp
- **NFR-4.4:** Color contrast ratio 4.5:1 minimum

---

## Architecture Overview

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ SMS          │  │ Review       │  │ Import Settings      │  │
│  │ Permission   │  │ Queue        │  │ Panel                │  │
│  │ Request      │  │ Modal        │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                        SMS SERVICE                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐                            │
│  │ SMS Listener │  │ Inbox Scanner│                            │
│  │ (Native)     │  │ (On-demand)  │                            │
│  └──────────────┘  └──────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    PARSING & PROCESSING                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ ML Parser    │  │ Duplicate    │  │ Merchant     │          │
│  │ (TFLite)     │──│ Detector     │──│ Normalizer   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                      LEARNING ENGINE                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ User         │  │ Pattern      │  │ Merchant     │          │
│  │ Corrections  │──│ Database     │──│ Mapping      │          │
│  │ Store        │  │ (Local)      │  │ Service      │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    EXPENSE INTEGRATION                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐                            │
│  │ Expense      │  │ Review       │                            │
│  │ Store        │  │ Queue        │                            │
│  │ (XState)     │  │ State        │                            │
│  └──────────────┘  └──────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
```

### Component Interactions

1. **SMS Listener** receives incoming messages
2. **ML Parser** extracts structured data using on-device TFLite Bi-LSTM model
3. **Duplicate Detector** checks against existing expenses
4. **Merchant Learning Engine** suggests category and payment method
5. **Review Queue Store** manages pending items (all imports require review in v1)
6. **User Interface** presents items for confirmation
7. **Expense Store** receives confirmed expenses
8. **Learning Engine** updates patterns from user corrections

---

## Data Models

### SMS Import Types

```typescript
// types/sms-import.ts

/**
 * Source of the import (SMS-only in v1)
 */
export type ImportSource = "sms"

/**
 * Metadata attached to auto-imported expenses
 */
export interface SMSImportMetadata {
  /** Source type (always "sms" in v1) */
  source: ImportSource

  /** Original raw message content */
  rawMessage: string

  /** SMS sender address (e.g., "AD-HDFCBK") */
  sender: string

  /** Unique message identifier for duplicate detection */
  messageId: string

  /** Parsing confidence score (0-1) */
  confidenceScore: number

  /** When the message was parsed */
  parsedAt: string

  /** When user reviewed the import */
  reviewedAt?: string

  /** Whether user manually corrected data */
  userCorrected?: boolean
}

/**
 * Transaction data extracted from SMS
 */
export interface ParsedTransaction {
  /** Transaction amount */
  amount: number

  /** Currency code (ISO 4217) */
  currency: string

  /** Merchant or recipient name */
  merchant: string

  /** Transaction date */
  date: string

  /** Payment method type */
  paymentMethod: PaymentMethodType

  /** Payment instrument details */
  paymentInstrument?: {
    type: string
    lastDigits?: string
  }

  /** Debit or credit transaction */
  transactionType: "debit" | "credit"

  /** Overall parsing confidence */
  confidenceScore: number

  /** Import metadata */
  metadata: SMSImportMetadata
}

/**
 * Item in the review queue
 */
export interface ReviewQueueItem {
  /** Unique queue item ID */
  id: string

  /** Parsed transaction data */
  parsedTransaction: ParsedTransaction

  /** Suggested category from learning engine */
  suggestedCategory: string

  /** Suggested payment method */
  suggestedPaymentMethod: PaymentMethodType

  /** Suggested payment instrument */
  suggestedInstrument?: PaymentInstrument

  /** Current review status */
  status: "pending" | "confirmed" | "edited" | "rejected"

  /** When item was added to queue */
  createdAt: string
}

/**
 * Settings for SMS import feature (v1 - SMS only)
 */
export interface SMSImportSettings {
  /** Master enable/disable switch for SMS import */
  enabled: boolean

  /** Scan inbox on app launch */
  scanOnLaunch: boolean

  /** Days to keep items in review queue */
  reviewRetentionDays: number
}
```

> **v1 Note:** All imports go through the review queue. There is no `autoImportEnabled` or `minimumConfidence` bypass. These may be added in a future version once the parsing engine has proven reliable.

### Merchant Learning Types

```typescript
// types/merchant-patterns.ts

/**
 * Learned pattern for a merchant
 */
export interface MerchantPattern {
  /** Unique pattern ID */
  id: string

  /** Normalized merchant name */
  normalizedName: string

  /** Raw merchant strings that map to this pattern */
  rawPatterns: string[]

  /** Associated category */
  category: string

  /** Associated payment method */
  paymentMethod: PaymentMethodType

  /** Associated payment instrument */
  paymentInstrument?: PaymentInstrument

  /** Confidence in this pattern (0-1) */
  confidence: number

  /** Number of times this pattern was used */
  usageCount: number

  /** Last time this pattern was used */
  lastUsed: string

  /** Whether user manually overrode this pattern */
  userOverridden: boolean
}

/**
 * Explicit user correction
 */
export interface UserCorrection {
  /** Correction ID */
  id: string

  /** Original merchant string */
  originalMerchant: string

  /** User-selected category */
  correctedCategory?: string

  /** User-selected payment method */
  correctedPaymentMethod?: PaymentMethodType

  /** User-selected instrument */
  correctedInstrument?: PaymentInstrument

  /** When correction was made */
  timestamp: string

  /** Whether to apply to future transactions */
  applyToFuture: boolean
}

/**
 * Similarity match result
 */
export interface SimilarityMatch {
  /** Matched merchant string */
  merchant: string

  /** Similarity score (0-1) */
  similarity: number

  /** Matching pattern */
  pattern: MerchantPattern
}
```

### Extended Expense Type

```typescript
// Extension to types/expense.ts

export interface Expense {
  // ... existing fields ...

  /**
   * Source of the expense
   * - 'manual': User manually created
   * - 'auto-imported': Imported from SMS
   */
  source?: "manual" | "auto-imported"

  /**
   * Metadata for auto-imported expenses
   */
  importMetadata?: SMSImportMetadata
}
```

> **Migration Note:** The `source` and `importMetadata` fields are new optional additions to the Expense type. This requires a CSV format version bump. Existing expenses without these fields will default to `source: undefined` (treated as manual). A backward-compatible migration script must handle reading old-format CSVs that lack these columns. See [Migration Strategy](#migration-strategy) for details.

---

## Implementation Phases

### Phase 1: Foundation (Week 1)

**Goal:** Core infrastructure and types

**Tasks:**

- [ ] Create type definitions (`types/sms-import.ts`, `types/merchant-patterns.ts`)
- [ ] Set up storage constants and keys
- [ ] Create SMS import settings service
- [ ] Add permission handling utilities
- [ ] Create basic file structure

**Deliverables:**

- Type definitions complete
- Storage layer ready
- Settings persistence working

**Dependencies:** None

### Phase 2: SMS Access (Week 2)

**Goal:** SMS message reception infrastructure

**Tasks:**

- [ ] Install and configure `@maniac-tech/react-native-expo-read-sms`
- [ ] Implement SMS permission request flow
- [ ] Create SMS listener service
- [ ] Create inbox scanner for historical messages
- [ ] Add message filtering (bank detection)

**Deliverables:**

- SMS listening functional
- Inbox scanning working

**Dependencies:** Phase 1

### Phase 3: Transaction Parsing (Week 2-4)

**Goal:** Extract transaction data from messages using on-device ML

**Tasks:**

- [ ] Integrate TensorFlow Lite runtime (`react-native-fast-tflite`)
- [ ] Create TFLite tokenizer for SMS text preprocessing
- [ ] Create ML parser service wrapping the Bi-LSTM model
- [ ] Implement confidence thresholding (≥ 0.7 for review queue)
- [ ] Implement merchant name extraction from model output
- [ ] Implement amount and currency parsing from model output
- [ ] Implement date parsing from model output
- [ ] Create merchant normalizer
- [ ] Add SHA-256 message ID fingerprinting

**Deliverables:**

- ML parser working across all bank formats (Indian, US, EU, JP)
- Confidence scoring from model output
- Unit and property-based tests for parsing accuracy

> **Note:** The ML-only approach replaces the earlier regex-based pattern matching design. See [ML_SMS_PARSER.md](./ML_SMS_PARSER.md) for full architecture details.

**Dependencies:** Phase 2

### Phase 4: Duplicate Detection (Week 3)

**Goal:** Prevent duplicate entries

**Tasks:**

- [ ] Implement message ID fingerprinting
- [ ] Create processed message ID storage (rotating window)
- [ ] Implement similarity-based duplicate detection
- [ ] Add duplicate warning UI
- [ ] Create duplicate resolution strategies

**Deliverables:**

- Duplicate detection 99%+ accuracy
- Performance tests pass
- Edge cases handled

**Dependencies:** Phase 3

### Phase 5: Learning Engine (Week 4)

**Goal:** Smart categorization and payment method suggestions

**Tasks:**

- [ ] Create merchant pattern storage
- [ ] Implement pattern learning algorithm
- [ ] Create similarity matching engine
- [ ] Implement user correction storage
- [ ] Add fuzzy matching for merchant names
- [ ] Create confidence scoring system
- [ ] Implement pattern updates from user confirmations

**Deliverables:**

- Learning engine functional
- Patterns persist across app restarts
- Suggestions improve over time

**Dependencies:** Phase 3

### Phase 6: Review Queue UI (Week 4-5)

**Goal:** User interface for reviewing imports

**Tasks:**

- [ ] Create review queue XState store
- [ ] Build review queue modal component
- [ ] Implement expense preview card
- [ ] Create editable fields (category, payment method, note)
- [ ] Add confirm/edit/reject actions
- [ ] Create bulk actions UI
- [ ] Add "Apply to future" checkbox
- [ ] Implement queue item persistence

**Deliverables:**

- Review queue UI complete
- All actions functional
- Accessibility tests pass

**Dependencies:** Phase 5

### Phase 7: Integration & Settings (Week 5)

**Goal:** Connect everything and add settings

**Tasks:**

- [ ] Integrate SMS listener with review queue
- [ ] Add expense creation from review queue
- [ ] Create settings page for SMS import
- [ ] Create import history view
- [ ] Add "Auto-imported" badge to expense list
- [ ] Integrate with existing expense store

**Deliverables:**

- End-to-end flow working
- Settings page complete
- Integration tests pass

**Dependencies:** Phase 6

### Phase 8: Testing & Polish (Week 6)

**Goal:** Quality assurance and optimization

**Tasks:**

- [ ] Write unit tests for all services
- [ ] Create integration tests
- [ ] Perform security audit
- [ ] Optimize performance (parsing < 100ms)
- [ ] Add error handling and recovery
- [ ] Create user documentation
- [ ] Perform accessibility audit

**Deliverables:**

- Test coverage > 80%
- Performance benchmarks met
- Documentation complete

**Dependencies:** Phase 7

---

## Technical Specifications

### 1. Storage Architecture

#### Storage Keys

```typescript
// services/sms-import/constants.ts
export const STORAGE_KEYS = {
  // Feature settings
  IMPORT_SETTINGS: "sms_import_settings_v1",

  // Review queue
  REVIEW_QUEUE: "sms_review_queue_v1",

  // Duplicate prevention
  PROCESSED_MESSAGE_IDS: "sms_processed_ids_v1",

  // Learning system
  MERCHANT_PATTERNS: "merchant_patterns_v1",
  USER_CORRECTIONS: "user_corrections_v1",

  // Analytics (local only)
  IMPORT_STATS: "sms_import_stats_v1",
} as const
```

#### Data Retention

- **Processed Message IDs:** Last 1000 items (rotating window)
- **Review Queue:** 30 days max per item
- **Merchant Patterns:** Unlimited (with LRU eviction at 1000 patterns)
- **User Corrections:** Unlimited

### 2. SMS Listener Implementation

```typescript
// services/sms-import/sms-listener.ts

export class SMSListener {
  private isListening = false
  private unsubscribe?: () => void

  async initialize(): Promise<boolean> {
    const settings = await getSMSImportSettings()

    if (!settings.enabled || !settings.smsEnabled) {
      return false
    }

    // Check permissions
    const hasPermission = await this.checkPermissions()
    if (!hasPermission) {
      return false
    }

    await this.startSMSListener()
    return true
  }

  private async checkPermissions(): Promise<boolean> {
    const smsPermission = await check(PERMISSIONS.ANDROID.READ_SMS)
    return smsPermission === RESULTS.GRANTED
  }

  private async startSMSListener(): Promise<void> {
    const hasPermission = await requestReadSMSPermission()
    if (!hasPermission) return

    this.isListening = true
    this.unsubscribe = startReadSMS((status, sms, error) => {
      if (status === "success" && sms) {
        this.handleIncomingMessage(sms)
      }
    })
  }

  private async handleIncomingMessage(message: string): Promise<void> {
    // Parse transaction
    const parsed = await transactionParser.parse(message, "sms")

    if (!parsed) {
      return // Not a transaction message
    }

    // Check for duplicates
    const duplicate = await duplicateDetector.check(parsed)
    if (duplicate.isDuplicate) {
      await markMessageProcessed(parsed.metadata.messageId)
      return
    }

    // Get suggestions from learning engine
    const suggestions = await learningEngine.suggest(parsed.merchant)

    // Add to review queue (all imports require review in v1)
    await reviewQueueStore.addItem({
      parsedTransaction: parsed,
      suggestedCategory: suggestions?.category || "Other",
      suggestedPaymentMethod: suggestions?.paymentMethod || "Other",
      suggestedInstrument: suggestions?.instrument,
    })

    // Show notification to user
    await this.showImportNotification(parsed)
  }

  async dispose(): Promise<void> {
    this.unsubscribe?.()
    this.isListening = false
  }
}
```

### 3. ML Transaction Parser

The transaction parser uses an on-device TensorFlow Lite Bi-LSTM model to extract structured data from SMS messages. This replaces the earlier regex-based approach, providing universal support across bank formats and languages.

> **Full architecture details:** See [ML_SMS_PARSER.md](./ML_SMS_PARSER.md)

```typescript
// services/sms-import/ml/tflite-parser.ts

import { loadTensorflowModel } from "react-native-fast-tflite"
import { TFLiteTokenizer } from "./tflite-tokenizer"
import { generateMessageId } from "./message-id"

interface ParseResult {
  parsed: ParsedTransaction | null
  confidence: number
  method: "ml"
}

export class TFLiteParser {
  private model: TensorflowModel | null = null
  private tokenizer: TFLiteTokenizer | null = null

  async initialize(): Promise<boolean> {
    this.tokenizer = new TFLiteTokenizer()
    await this.tokenizer.loadVocab()

    this.model = await loadTensorflowModel(require("@/assets/models/sms_parser.tflite"))
    return true
  }

  async parse(message: string, source: ImportSource = "sms"): Promise<ParseResult> {
    if (!this.model || !this.tokenizer) {
      return { parsed: null, confidence: 0, method: "ml" }
    }

    // Tokenize and run inference
    const tokens = this.tokenizer.tokenize(message)
    const output = this.model.runSync([tokens])

    // Decode model output into structured fields
    const decoded = this.decodeOutput(output, message)

    if (!decoded || decoded.confidence < 0.7) {
      return { parsed: null, confidence: decoded?.confidence ?? 0, method: "ml" }
    }

    return {
      parsed: {
        amount: decoded.amount,
        currency: decoded.currency,
        merchant: decoded.merchant,
        date: decoded.date || new Date().toISOString(),
        paymentMethod: decoded.paymentMethod,
        transactionType: decoded.transactionType,
        confidenceScore: decoded.confidence,
        metadata: {
          source,
          rawMessage: message,
          sender: decoded.sender || "Unknown",
          messageId: generateMessageId(message),
          confidenceScore: decoded.confidence,
          parsedAt: new Date().toISOString(),
        },
      },
      confidence: decoded.confidence,
      method: "ml",
    }
  }
}
```

#### Message ID Generation (SHA-256)

```typescript
// services/sms-import/ml/message-id.ts

import * as Crypto from "expo-crypto"

/**
 * Generate a deterministic SHA-256 message ID for duplicate detection.
 * Uses the full message content to produce a collision-resistant fingerprint.
 */
export function generateMessageId(message: string): string {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, message)
}
```

> **Why SHA-256?** The earlier design used a simple 32-bit hash which had high collision risk. SHA-256 provides collision-resistant fingerprinting suitable for the 1000-ID rotating window.

### 4. Duplicate Detection

```typescript
// services/sms-import/duplicate-detector.ts

interface DuplicateCheck {
  isDuplicate: boolean
  matchedExpense?: Expense
  confidence: number
  reason: "message_id" | "amount_date_merchant" | "none"
}

export class DuplicateDetector {
  private processedIds: Set<string> = new Set()
  private readonly SIMILARITY_THRESHOLD = 0.85

  async initialize(): Promise<void> {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.PROCESSED_MESSAGE_IDS)
    if (stored) {
      const ids: string[] = JSON.parse(stored)
      this.processedIds = new Set(ids)
    }
  }

  async check(parsed: ParsedTransaction): Promise<DuplicateCheck> {
    // Check 1: Exact message ID match
    if (this.processedIds.has(parsed.metadata.messageId)) {
      return {
        isDuplicate: true,
        confidence: 1.0,
        reason: "message_id",
      }
    }

    // Check 2: Amount + Date + Merchant similarity
    const existingExpenses = await getAllExpenses()
    const candidates = this.findCandidates(parsed, existingExpenses)

    for (const candidate of candidates) {
      const similarity = this.calculateSimilarity(parsed, candidate)

      if (similarity > this.SIMILARITY_THRESHOLD) {
        return {
          isDuplicate: true,
          matchedExpense: candidate,
          confidence: similarity,
          reason: "amount_date_merchant",
        }
      }
    }

    return {
      isDuplicate: false,
      confidence: 0,
      reason: "none",
    }
  }

  private findCandidates(parsed: ParsedTransaction, expenses: Expense[]): Expense[] {
    const parsedDate = new Date(parsed.date)
    const parsedAmount = parsed.amount

    return expenses.filter((expense) => {
      // Amount match (within 1% tolerance)
      const amountMatch = Math.abs(expense.amount - parsedAmount) < parsedAmount * 0.01

      // Date match (same day)
      const expenseDate = new Date(expense.date)
      const dateMatch = isSameDay(expenseDate, parsedDate)

      return amountMatch && dateMatch
    })
  }

  private calculateSimilarity(parsed: ParsedTransaction, expense: Expense): number {
    // Compare merchant names using string similarity
    const merchantSimilarity = this.stringSimilarity(
      parsed.merchant.toLowerCase(),
      expense.note.toLowerCase()
    )

    return merchantSimilarity
  }

  private stringSimilarity(a: string, b: string): number {
    // Levenshtein distance-based similarity
    const distance = this.levenshteinDistance(a, b)
    const maxLength = Math.max(a.length, b.length)
    return 1 - distance / maxLength
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix = []
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i]
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j
    }
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
          )
        }
      }
    }
    return matrix[b.length][a.length]
  }

  async markProcessed(messageId: string): Promise<void> {
    this.processedIds.add(messageId)

    // Keep only last 1000 IDs
    const idsArray = Array.from(this.processedIds)
    if (idsArray.length > 1000) {
      this.processedIds = new Set(idsArray.slice(-1000))
    }

    await AsyncStorage.setItem(
      STORAGE_KEYS.PROCESSED_MESSAGE_IDS,
      JSON.stringify(Array.from(this.processedIds))
    )
  }
}
```

### 5. Learning Engine

```typescript
// services/merchant-learning/index.ts

export class MerchantLearningEngine {
  private patterns: Map<string, MerchantPattern> = new Map()
  private corrections: UserCorrection[] = []

  async initialize(): Promise<void> {
    await Promise.all([this.loadPatterns(), this.loadCorrections()])
  }

  async suggest(merchant: string): Promise<{
    category?: string
    paymentMethod?: PaymentMethodType
    instrument?: PaymentInstrument
    confidence: number
  } | null> {
    const normalized = this.normalizeMerchant(merchant)

    // Check for exact match
    const exactPattern = this.patterns.get(normalized)
    if (exactPattern && exactPattern.confidence > 0.7) {
      return {
        category: exactPattern.category,
        paymentMethod: exactPattern.paymentMethod,
        instrument: exactPattern.paymentInstrument,
        confidence: exactPattern.confidence,
      }
    }

    // Check for similar merchants
    const similar = await this.findSimilarMerchants(normalized)
    if (similar.length > 0 && similar[0].similarity > 0.8) {
      const bestMatch = similar[0]
      return {
        category: bestMatch.pattern.category,
        paymentMethod: bestMatch.pattern.paymentMethod,
        instrument: bestMatch.pattern.paymentInstrument,
        confidence: bestMatch.similarity * bestMatch.pattern.confidence,
      }
    }

    // Check user corrections
    const correction = this.corrections.find(
      (c) => this.normalizeMerchant(c.originalMerchant) === normalized
    )
    if (correction && correction.applyToFuture) {
      return {
        category: correction.correctedCategory,
        paymentMethod: correction.correctedPaymentMethod,
        instrument: correction.correctedInstrument,
        confidence: 0.9,
      }
    }

    return null
  }

  async learnFromExpense(expense: Expense, parsed: ParsedTransaction): Promise<void> {
    const normalized = this.normalizeMerchant(parsed.merchant)
    const existingPattern = this.patterns.get(normalized)

    if (existingPattern) {
      // Check if should overwrite existing pattern (same amount range + within 24h window)
      const shouldOverwrite = this.shouldOverwritePattern(
        existingPattern,
        expense,
        parsed
      )

      if (shouldOverwrite) {
        // Overwrite: likely same merchant with different raw string representation
        existingPattern.rawPatterns = [parsed.merchant] // Replace, don't accumulate
        existingPattern.category = expense.category
        existingPattern.paymentMethod = expense.paymentMethod?.type || "Other"
        existingPattern.paymentInstrument = expense.paymentMethod?.instrumentId
          ? await this.getInstrumentById(expense.paymentMethod.instrumentId)
          : undefined
        existingPattern.userOverridden = expense.importMetadata?.userCorrected || false
        existingPattern.confidence = expense.importMetadata?.userCorrected ? 0.9 : 0.5
        existingPattern.usageCount = 1 // Reset count for new representation
        existingPattern.lastUsed = new Date().toISOString()
      } else {
        // Update existing pattern
        existingPattern.usageCount++
        existingPattern.lastUsed = new Date().toISOString()

        if (expense.importMetadata?.userCorrected) {
          // User override - update with their preference
          existingPattern.category = expense.category
          existingPattern.paymentMethod = expense.paymentMethod?.type || "Other"
          existingPattern.paymentInstrument = expense.paymentMethod?.instrumentId
            ? await this.getInstrumentById(expense.paymentMethod.instrumentId)
            : undefined
          existingPattern.userOverridden = true
          existingPattern.confidence = 1.0
        } else {
          // User confirmed - reinforce pattern
          existingPattern.confidence = Math.min(existingPattern.confidence + 0.05, 0.95)
        }

        // Track raw pattern if new
        if (!existingPattern.rawPatterns.includes(parsed.merchant)) {
          existingPattern.rawPatterns.push(parsed.merchant)
        }
      }
    } else {
      // Create new pattern
      const newPattern: MerchantPattern = {
        id: generateId(),
        normalizedName: normalized,
        rawPatterns: [parsed.merchant],
        category: expense.category,
        paymentMethod: expense.paymentMethod?.type || "Other",
        paymentInstrument: expense.paymentMethod?.instrumentId
          ? await this.getInstrumentById(expense.paymentMethod.instrumentId)
          : undefined,
        confidence: expense.importMetadata?.userCorrected ? 0.9 : 0.5,
        usageCount: 1,
        lastUsed: new Date().toISOString(),
        userOverridden: expense.importMetadata?.userCorrected || false,
      }

      this.patterns.set(normalized, newPattern)
    }

    await this.savePatterns()
  }

  /**
   * Determine if an existing pattern should be overwritten.
   * Overwrite when:
   * 1. Same normalized merchant name (by definition)
   * 2. Same category (proxy for same merchant type)
   * 3. Amount within 10% range
   * 4. Within 24-hour time window
   *
   * This handles cases where the same merchant appears with different
   * raw strings (e.g., "SWIGGY" vs "Swiggy Food Delivery")
   */
  private shouldOverwritePattern(
    existing: MerchantPattern,
    expense: Expense,
    parsed: ParsedTransaction
  ): boolean {
    // Check category match
    if (existing.category !== expense.category) {
      return false
    }

    // Check amount within 10% range
    const existingAmount = parsed.amount // Use parsed amount as reference
    const amountDiff = Math.abs(parsed.amount - existingAmount) / existingAmount
    if (amountDiff > 0.1) {
      return false
    }

    // Check 24-hour time window
    const timeDiff = Math.abs(
      new Date().getTime() - new Date(existing.lastUsed).getTime()
    )
    const twentyFourHours = 24 * 60 * 60 * 1000
    if (timeDiff > twentyFourHours) {
      return false
    }

    return true
  }

  async addCorrection(correction: UserCorrection): Promise<void> {
    this.corrections.push(correction)
    await this.saveCorrections()

    // Immediately update or create pattern
    const normalized = this.normalizeMerchant(correction.originalMerchant)
    const pattern = this.patterns.get(normalized) || {
      id: generateId(),
      normalizedName: normalized,
      rawPatterns: [correction.originalMerchant],
      category: correction.correctedCategory || "Other",
      paymentMethod: correction.correctedPaymentMethod || "Other",
      paymentInstrument: correction.correctedInstrument,
      confidence: 0.9,
      usageCount: 1,
      lastUsed: new Date().toISOString(),
      userOverridden: true,
    }

    this.patterns.set(normalized, pattern)
    await this.savePatterns()
  }

  private normalizeMerchant(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .replace(/(pvt|ltd|inc|llc|corp|limited)/g, "")
      .trim()
  }

  private async findSimilarMerchants(normalized: string): Promise<SimilarityMatch[]> {
    const matches: SimilarityMatch[] = []

    for (const [name, pattern] of this.patterns) {
      const similarity = this.calculateSimilarity(normalized, name)
      if (similarity > 0.7) {
        matches.push({ merchant: name, similarity, pattern })
      }
    }

    return matches.sort((a, b) => b.similarity - a.similarity)
  }

  private calculateSimilarity(a: string, b: string): number {
    // Use Levenshtein distance for fuzzy matching
    const maxLength = Math.max(a.length, b.length)
    if (maxLength === 0) return 1

    const distance = this.levenshteinDistance(a, b)
    return 1 - distance / maxLength
  }

  private async loadPatterns(): Promise<void> {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.MERCHANT_PATTERNS)
    if (stored) {
      const patterns: MerchantPattern[] = JSON.parse(stored)
      this.patterns = new Map(patterns.map((p) => [p.normalizedName, p]))
    }
  }

  private async savePatterns(): Promise<void> {
    const patternsArray = Array.from(this.patterns.values())
    await AsyncStorage.setItem(
      STORAGE_KEYS.MERCHANT_PATTERNS,
      JSON.stringify(patternsArray)
    )
  }

  private async loadCorrections(): Promise<void> {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.USER_CORRECTIONS)
    if (stored) {
      this.corrections = JSON.parse(stored)
    }
  }

  private async saveCorrections(): Promise<void> {
    await AsyncStorage.setItem(
      STORAGE_KEYS.USER_CORRECTIONS,
      JSON.stringify(this.corrections)
    )
  }
}
```

### 6. Review Queue Store

```typescript
// stores/review-queue-store.ts

interface ReviewQueueContext {
  queue: ReviewQueueItem[]
  isLoading: boolean
  currentItem: ReviewQueueItem | null
  stats: {
    totalImported: number
    pendingReview: number
    autoImported: number
  }
}

export const reviewQueueStore = createStore({
  context: {
    queue: [] as ReviewQueueItem[],
    isLoading: true,
    currentItem: null as ReviewQueueItem | null,
    stats: {
      totalImported: 0,
      pendingReview: 0,
      autoImported: 0,
    },
  } as ReviewQueueContext,

  on: {
    loadQueue: (context, event: { items: ReviewQueueItem[] }) => ({
      ...context,
      queue: event.items,
      isLoading: false,
      stats: computeStats(event.items),
    }),

    addItem: (context, event: { item: ReviewQueueItem }, enqueue) => {
      const newQueue = [...context.queue, event.item]

      enqueue.effect(async () => {
        await saveReviewQueue(newQueue)
      })

      return {
        ...context,
        queue: newQueue,
        stats: computeStats(newQueue),
      }
    },

    confirmItem: (
      context,
      event: {
        itemId: string
        expenseData: Partial<Expense>
      },
      enqueue
    ) => {
      const item = context.queue.find((i) => i.id === event.itemId)
      if (!item) return context

      const expense = createExpenseFromReviewItem(item, event.expenseData)

      // Add source and metadata
      expense.source = "auto-imported"
      expense.importMetadata = {
        ...item.parsedTransaction.metadata,
        reviewedAt: new Date().toISOString(),
      }

      // Add to expense store WITHOUT triggering sync (batch later)
      expenseStore.trigger.addExpense({ expense, triggerSync: false })

      enqueue.effect(async () => {
        // Learn from confirmation
        await merchantLearningEngine.learnFromExpense(expense, item.parsedTransaction)

        // Mark as processed
        await duplicateDetector.markProcessed(item.parsedTransaction.metadata.messageId)

        // Remove from queue
        await removeFromReviewQueue(event.itemId)
      })

      const newQueue = context.queue.filter((i) => i.id !== event.itemId)

      return {
        ...context,
        queue: newQueue,
        currentItem: null,
        stats: computeStats(newQueue),
      }
    },

    editItem: (
      context,
      event: {
        itemId: string
        updates: {
          category?: string
          paymentMethod?: PaymentMethodType
          instrument?: PaymentInstrument
          note?: string
        }
      },
      enqueue
    ) => {
      const item = context.queue.find((i) => i.id === event.itemId)
      if (!item) return context

      const expense = createExpenseFromReviewItem(item, {
        category: event.updates.category || item.suggestedCategory,
        paymentMethod: {
          type: event.updates.paymentMethod || item.suggestedPaymentMethod,
          instrumentId: event.updates.instrument?.id,
        },
        note: event.updates.note || item.parsedTransaction.merchant,
      })

      // Mark as user-corrected
      expense.source = "auto-imported"
      expense.importMetadata = {
        ...item.parsedTransaction.metadata,
        reviewedAt: new Date().toISOString(),
        userCorrected: true,
      }

      // Add to expense store WITHOUT triggering sync (batch later)
      expenseStore.trigger.addExpense({ expense, triggerSync: false })

      enqueue.effect(async () => {
        // Store user correction
        await merchantLearningEngine.addCorrection({
          id: generateId(),
          originalMerchant: item.parsedTransaction.merchant,
          correctedCategory: event.updates.category,
          correctedPaymentMethod: event.updates.paymentMethod,
          correctedInstrument: event.updates.instrument,
          timestamp: new Date().toISOString(),
          applyToFuture: true,
        })

        // Learn from correction
        await merchantLearningEngine.learnFromExpense(expense, item.parsedTransaction)

        // Mark as processed
        await duplicateDetector.markProcessed(item.parsedTransaction.metadata.messageId)

        // Remove from queue
        await removeFromReviewQueue(event.itemId)
      })

      const newQueue = context.queue.filter((i) => i.id !== event.itemId)

      return {
        ...context,
        queue: newQueue,
        currentItem: null,
        stats: computeStats(newQueue),
      }
    },

    rejectItem: (context, event: { itemId: string }, enqueue) => {
      const item = context.queue.find((i) => i.id === event.itemId)
      if (!item) return context

      enqueue.effect(async () => {
        // Mark message as processed so we don't import again
        await duplicateDetector.markProcessed(item.parsedTransaction.metadata.messageId)

        await removeFromReviewQueue(event.itemId)
      })

      const newQueue = context.queue.filter((i) => i.id !== event.itemId)

      return {
        ...context,
        queue: newQueue,
        currentItem: null,
        stats: computeStats(newQueue),
      }
    },

    setCurrentItem: (context, event: { itemId: string | null }) => ({
      ...context,
      currentItem: event.itemId
        ? context.queue.find((i) => i.id === event.itemId) || null
        : null,
    }),

    clearOldItems: (context, _event, enqueue) => {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const newQueue = context.queue.filter((item) => {
        const itemDate = new Date(item.createdAt)
        return itemDate > thirtyDaysAgo
      })

      enqueue.effect(async () => {
        await saveReviewQueue(newQueue)
      })

      return {
        ...context,
        queue: newQueue,
        stats: computeStats(newQueue),
      }
    },
  },
})

function computeStats(queue: ReviewQueueItem[]) {
  return {
    totalImported: queue.length,
    pendingReview: queue.filter((i) => i.status === "pending").length,
    autoImported: 0, // TODO: Track separately
  }
}

function createExpenseFromReviewItem(
  item: ReviewQueueItem,
  overrides: Partial<Expense>
): Expense {
  return {
    id: generateId(),
    amount: item.parsedTransaction.amount,
    currency: item.parsedTransaction.currency,
    category: overrides.category || item.suggestedCategory,
    date: item.parsedTransaction.date,
    note: overrides.note || item.parsedTransaction.merchant,
    paymentMethod: overrides.paymentMethod || {
      type: item.suggestedPaymentMethod,
      instrumentId: item.suggestedInstrument?.id,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}
```

---

## User Interface

### 1. Review Queue Modal

**Component:** `components/ui/sms-import/ReviewQueueModal.tsx`

**Key Features:**

- Display transaction amount prominently
- Show merchant name and date
- Collapsible raw SMS view
- Category selector (dropdown or horizontal cards)
- Payment method selector with instrument dropdown
- Note input field
- Confidence indicator (visual bar or percentage)
- Confirm/Edit/Reject buttons
- "Apply to future transactions" checkbox
- Swipe gestures for quick actions (optional)

**Accessibility:**

- Screen reader announcements for each field
- Focus management between fields
- Error messages announced
- Keyboard navigation support

### 2. Auto-Imported Badge

**Component:** `components/ui/expense-list/AutoImportedBadge.tsx`

**Design:**

- Small badge with icon (import/download icon)
- Blue color scheme to indicate "automatic"
- Tooltip on hover/press showing "Imported from SMS"
- Click to view original SMS (optional)

### 3. Settings Page

**Route:** `/settings/sms-import`

**Sections:**

1. **Enable/Disable Feature** - Master toggle
2. **SMS Monitoring** - Enable/disable SMS listening, scan on launch
3. **Advanced Settings** - Retention period
4. **Learning Data** - View/edit learned patterns
5. **Privacy** - Delete all import data

### 4. Import History

**Route:** `/history/sms-imports` (or section in main history)

**Features:**

- List of all auto-imported expenses
- Filter by status (confirmed/edited/rejected)
- Search by merchant
- Bulk actions (delete, reprocess)

---

## Testing Strategy

### Unit Tests

```typescript
// __tests__/services/transaction-parser.test.ts

describe("TransactionParser", () => {
  const parser = new TransactionParser()

  describe("HDFC Bank SMS", () => {
    it("should parse debit transaction", async () => {
      const sms =
        "Rs.1,500.00 debited from a/c **1234 on 15-02-2026. Avl Bal: Rs.25,430.50. Swiggy - Food Order"
      const result = await parser.parse(sms, "sms")

      expect(result).not.toBeNull()
      expect(result!.amount).toBe(1500)
      expect(result!.merchant).toBe("Swiggy")
      expect(result!.transactionType).toBe("debit")
    })
  })

  describe("ICICI Bank SMS", () => {
    it("should parse credit card transaction", async () => {
      const sms =
        "Thank you for using your ICICI Bank Credit Card ending 5678 for INR 2,499 at AMAZON on 14-02-2026"
      const result = await parser.parse(sms, "sms")

      expect(result).not.toBeNull()
      expect(result!.amount).toBe(2499)
      expect(result!.merchant).toBe("Amazon")
    })
  })

  describe("UPI Transaction", () => {
    it("should parse PhonePe payment", async () => {
      const sms = "Rs.350 paid to ZOMATO via PhonePe UPI. UPI Ref: 123456789012"
      const result = await parser.parse(sms, "sms")

      expect(result).not.toBeNull()
      expect(result!.amount).toBe(350)
      expect(result!.paymentMethod).toBe("UPI")
    })
  })
})
```

### Integration Tests

```typescript
// __tests__/integration/sms-import-flow.test.ts

describe("SMS Import Flow", () => {
  beforeEach(async () => {
    await clearAllStorage()
    await initializeStores()
  })

  it("should complete full import flow", async () => {
    // 1. Simulate incoming SMS
    const sms = "Rs.500 debited from a/c **1234 to SWIGGY"
    await smsListener.handleIncomingMessage(sms, "sms")

    // 2. Check review queue
    const queue = reviewQueueStore.getSnapshot().context.queue
    expect(queue).toHaveLength(1)
    expect(queue[0].parsedTransaction.merchant).toBe("Swiggy")

    // 3. Confirm the import
    reviewQueueStore.trigger.confirmItem({
      itemId: queue[0].id,
      expenseData: {
        category: "Food",
        paymentMethod: { type: "UPI" },
      },
    })

    // 4. Check expense was created
    const expenses = expenseStore.getSnapshot().context.expenses
    expect(expenses).toHaveLength(1)
    expect(expenses[0].source).toBe("auto-imported")
    expect(expenses[0].category).toBe("Food")

    // 5. Check learning engine updated
    const suggestion = await merchantLearningEngine.suggest("Swiggy")
    expect(suggestion?.category).toBe("Food")
  })

  it("should detect and prevent duplicates", async () => {
    const sms = "Rs.1000 debited to AMAZON"

    // First import
    await smsListener.handleIncomingMessage(sms, "sms")
    const queue1 = reviewQueueStore.getSnapshot().context.queue
    reviewQueueStore.trigger.confirmItem({
      itemId: queue1[0].id,
      expenseData: {},
    })

    // Same SMS again
    await smsListener.handleIncomingMessage(sms, "sms")
    const queue2 = reviewQueueStore.getSnapshot().context.queue

    expect(queue2).toHaveLength(0) // Duplicate prevented
  })
})
```

### Performance Tests

```typescript
// __tests__/performance/parsing-performance.test.ts

describe("Parsing Performance", () => {
  it("should parse SMS within 100ms", async () => {
    const sms = "Rs.1,500.00 debited from a/c **1234 to SWIGGY"

    const start = performance.now()
    await transactionParser.parse(sms, "sms")
    const end = performance.now()

    expect(end - start).toBeLessThan(100)
  })

  it("should handle 1000 messages without performance degradation", async () => {
    const messages = generateTestMessages(1000)

    const start = performance.now()
    for (const message of messages) {
      await transactionParser.parse(message, "sms")
    }
    const end = performance.now()

    expect(end - start).toBeLessThan(10000) // 10 seconds total
  })
})
```

---

## Security & Privacy

### Data Handling

1. **On-Device Only**
   - No SMS content leaves the device
   - No cloud APIs for parsing
   - No analytics on transaction data
   - No crash reporting with SMS content

2. **Minimal Data Retention**
   - Only store parsed expense data (not full SMS)
   - Message IDs stored for dedup only
   - Rotating window of 1000 processed IDs
   - Review queue auto-expires after 30 days

3. **Secure Storage**
   - Use AsyncStorage (encrypted on modern devices)
   - Sensitive data in SecureStore
   - No backup of import metadata to cloud

### Permissions

**SMS Permission:**

- Required: `READ_SMS`, `RECEIVE_SMS` (Android)
- Justification: "To automatically detect expenses from bank SMS"
- Fallback: Manual import if permission denied

### User Control

1. **Complete Disable:** Toggle to turn off entire feature
2. **Data Deletion:** Clear all import history and learned patterns
3. **Review Required:** All imports require manual review in v1
4. **Transparency:** Show exactly what data is stored

---

## GitHub Sync Integration

### Merchant Learning Sync

**Objective:** Sync merchant patterns and user corrections to GitHub for cross-device transfer and backup.

#### Design Decisions

- **Opt-out:** Syncs by default (follows existing expense sync toggle)
- **Merge resolution:** Usage count-based with timestamp fallback
- **Sync frequency:** Follows expense sync settings (on_launch/on_change)
- **Scope:** Patterns + User corrections
- **Format:** Plain JSON for debuggability

#### File Structure

```
expense-buddy-sync/
├── expenses/
│   ├── 2026-02-14.csv
│   └── ...
├── settings.json
└── merchant-patterns.json  ← NEW: Separate file for learning data
```

#### Data Schema

```typescript
// types/merchant-sync.ts

export interface MerchantPatternsFile {
  version: number
  lastSyncedAt: string
  patterns: MerchantPattern[]
  corrections: UserCorrection[]
}

export interface MerchantPatternSyncResult {
  success: boolean
  uploaded: number
  downloaded: number
  merged: boolean
}
```

#### Sync Flow

```
1. TRIGGER
   ├── User confirms/edits import → Queue pattern sync
   ├── Expense sync runs → Include patterns
   └── Manual "Sync Now" button

2. UPLOAD
   ├── Load local patterns & corrections
   ├── Serialize to JSON
   └── Upload to GitHub: merchant-patterns.json

3. DOWNLOAD (During sync)
   ├── Fetch remote merchant-patterns.json
   ├── If exists: Merge with local
   │   ├── Same merchant: Higher usageCount wins
   │   ├── Timestamp tie: Local wins (conservative)
   │   └── Combine usageCounts
   └── Save merged result locally
```

#### Implementation

**Extend Sync Queue:**

```typescript
// services/sync-queue.ts

export type SyncQueueOp =
  | { type: "expense.upsert"; expense: Expense }
  | { type: "settings.patch"; updates: Partial<AppSettings> }
  | {
      type: "merchantPatterns.update"
      patterns: MerchantPattern[]
      corrections: UserCorrection[]
      timestamp: string
    }
```

**GitHub API Functions:**

```typescript
// services/github-sync.ts

export async function downloadMerchantPatterns(
  config: SyncConfig
): Promise<MerchantPatternsFile | null> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${config.repo}/contents/merchant-patterns.json?ref=${config.branch}`,
      {
        headers: {
          Authorization: `token ${config.token}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    )

    if (response.status === 404) {
      return null // File doesn't exist yet
    }

    if (!response.ok) {
      throw await toGitHubApiError(response)
    }

    const data = await response.json()
    const content = JSON.parse(atob(data.content))
    return content
  } catch (error) {
    console.error("Failed to download merchant patterns:", error)
    throw error
  }
}

export async function uploadMerchantPatterns(
  config: SyncConfig,
  data: MerchantPatternsFile
): Promise<void> {
  const content = btoa(JSON.stringify(data, null, 2))

  // Get existing file SHA if it exists
  let sha: string | undefined
  try {
    const existing = await fetch(
      `https://api.github.com/repos/${config.repo}/contents/merchant-patterns.json?ref=${config.branch}`,
      {
        headers: { Authorization: `token ${config.token}` },
      }
    )
    if (existing.ok) {
      const existingData = await existing.json()
      sha = existingData.sha
    }
  } catch {
    // File doesn't exist, will create new
  }

  const response = await fetch(
    `https://api.github.com/repos/${config.repo}/contents/merchant-patterns.json`,
    {
      method: "PUT",
      headers: {
        Authorization: `token ${config.token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "Update merchant patterns",
        content,
        sha,
        branch: config.branch,
      }),
    }
  )

  if (!response.ok) {
    throw await toGitHubApiError(response)
  }
}
```

**Merge Logic:**

```typescript
// services/merchant-learning/merge-patterns.ts

export function mergeMerchantPatterns(
  localPatterns: MerchantPattern[],
  remotePatterns: MerchantPattern[],
  localCorrections: UserCorrection[],
  remoteCorrections: UserCorrection[]
): {
  patterns: MerchantPattern[]
  corrections: UserCorrection[]
} {
  const mergedPatterns = new Map<string, MerchantPattern>()

  // Process local patterns
  localPatterns.forEach((p) => {
    mergedPatterns.set(p.normalizedName, p)
  })

  // Merge remote patterns
  remotePatterns.forEach((remote) => {
    const local = mergedPatterns.get(remote.normalizedName)

    if (local) {
      // Conflict resolution: Higher usageCount wins
      const winner = remote.usageCount > local.usageCount ? remote : local
      const loser = remote.usageCount > local.usageCount ? local : remote

      mergedPatterns.set(remote.normalizedName, {
        ...winner,
        // Combine usage counts
        usageCount: winner.usageCount + loser.usageCount,
        // Merge raw patterns (deduplicate)
        rawPatterns: [...new Set([...winner.rawPatterns, ...loser.rawPatterns])],
        // Keep most recent timestamp
        lastUsed: new Date(
          Math.max(
            new Date(winner.lastUsed).getTime(),
            new Date(loser.lastUsed).getTime()
          )
        ).toISOString(),
        // If either was user-overridden, keep that
        userOverridden: winner.userOverridden || loser.userOverridden,
      })
    } else {
      // New pattern from remote
      mergedPatterns.set(remote.normalizedName, remote)
    }
  })

  // Merge corrections (last-write-wins by timestamp)
  const correctionMap = new Map<string, UserCorrection>()
  ;[...localCorrections, ...remoteCorrections].forEach((c) => {
    const existing = correctionMap.get(c.originalMerchant)
    if (!existing || new Date(c.timestamp) > new Date(existing.timestamp)) {
      correctionMap.set(c.originalMerchant, c)
    }
  })

  return {
    patterns: Array.from(mergedPatterns.values()),
    corrections: Array.from(correctionMap.values()),
  }
}
```

**Auto-Sync Integration:**

```typescript
// stores/helpers.ts - performAutoSyncOnChange

export async function performAutoSyncOnChange(
  expenses: Expense[],
  callbacks: AutoSyncCallbacks,
  settings: AppSettings
): Promise<void> {
  if (!settings.autoSyncEnabled || settings.autoSyncTiming !== "on_change") {
    return
  }

  // Sync expenses
  await performSync(expenses, callbacks)

  // Sync merchant learning if enabled
  if (settings.syncSettings) {
    // Uses same toggle as settings sync
    const patterns = await merchantLearningEngine.getAllPatterns()
    const corrections = await merchantLearningEngine.getAllCorrections()
    await syncMerchantPatterns(config, patterns, corrections)
  }
}
```

#### UI Changes

**Settings Page Addition:**

The merchant pattern sync follows the existing `syncSettings` toggle - no separate UI needed. When user enables "Sync Settings to GitHub", merchant patterns are included automatically.

**Sync Status Indicator:**

```typescript
// Show in sync status UI
{syncResult.merchantPatterns && (
  <Text fontSize="$2" color="$green10">
    ✓ {syncResult.merchantPatterns.uploaded} patterns synced
  </Text>
)}
```

---

## Sync Trigger Behavior

### Overview

To prevent unnecessary sync churn, auto-imported expenses and pattern updates do **NOT** trigger immediate sync. Sync only occurs at controlled intervals.

### Sync Triggers

| Event                              | Expense Sync      | Pattern Sync   | Notes                  |
| ---------------------------------- | ----------------- | -------------- | ---------------------- |
| **App launch**                     | ✅                | ✅             | Full sync              |
| **Manual sync**                    | ✅                | ✅             | User triggered         |
| **User adds expense**              | ✅ (if on_change) | ❌             | Immediate sync         |
| **User edits expense**             | ✅ (if on_change) | ❌             | Immediate sync         |
| **Review queue confirmed**         | ❌                | ❌             | Batch later            |
| **Review queue edited**            | ❌                | ✅ (queue)     | Pattern changes queued |
| **User edits pattern in settings** | ❌                | ✅ (immediate) | Settings change        |

### Implementation

**Modified Expense Store:**

```typescript
// stores/expense-store.ts

addExpense: (context, event: {
  expense: Expense
  triggerSync?: boolean  // NEW: Explicit control (defaults to true)
}, enqueue) => {
  const normalizedExpense = normalizeExpenseForSave(event.expense)
  const newExpenses = [normalizedExpense, ...context.expenses]
  const dayKey = getLocalDayKey(normalizedExpense.date)
  const dirtyDays = addUniqueDay(context.dirtyDays, dayKey)

  enqueue.effect(async () => {
    await persistExpenseAdded(normalizedExpense)
    await markDirtyDay(dayKey)
    await enqueueSyncOp({ type: "expense.upsert", expense: normalizedExpense })

    // Only auto-sync if explicitly allowed (defaults to true for manual adds)
    // Review queue sets triggerSync: false to batch sync later
    if (event.triggerSync !== false) {
      await performAutoSyncOnChange(newExpenses, createAutoSyncCallbacks())
    }
  })

  return { ...context, expenses: newExpenses, dirtyDays }
},
```

**Review Queue Integration:**

```typescript
// stores/review-queue-store.ts

confirmItem: (context, event, enqueue) => {
  // ... create expense ...

  // Add to expense store WITHOUT triggering sync
  expenseStore.trigger.addExpense({
    expense,
    triggerSync: false, // Don't sync on review queue confirm — batch later
  })

  // Pattern updates are still saved locally but not synced immediately
  enqueue.effect(async () => {
    await merchantLearningEngine.learnFromExpense(expense, item.parsedTransaction)
    // Pattern sync happens at next app launch or manual sync
  })
}
```

**Pattern Sync Behavior:**

```typescript
// In merchant learning engine
async learnFromExpense(expense: Expense, ...): Promise<void> {
  // Update local patterns
  await this.savePatterns()

  // Only queue sync op if user explicitly edited in settings
  // Auto-import confirmations don't queue immediate sync
  if (expense.importMetadata?.userCorrected) {
    await enqueueSyncOp({
      type: "merchantPatterns.update",
      patterns: this.patterns,
      corrections: this.corrections
    })
  }
}
```

### Benefits

- **Reduced API calls** - No sync on every auto-imported expense
- **Batch efficiency** - Multiple auto-imports batch together
- **Better UX** - Faster import processing
- **Battery friendly** - Fewer background operations

---

## Migration Strategy

### CSV Format Version Bump

Adding `source` and `importMetadata` columns to the Expense type requires a CSV format version bump to **v2.0**. The migration must be backward-compatible:

**CSV Version Header:**
CSV exports will include a version comment header: `#version: 2.0`

**Export Format (v2.0):**

```csv
#version: 2.0
id,amount,currency,category,date,note,paymentMethodType,paymentMethodId,paymentInstrumentId,source,importMetadata,createdAt,updatedAt,deletedAt
exp-001,1500.00,INR,Food,2026-02-15,Lunch at Swiggy,UPI,,upi-123,auto-imported,"{rawMessage: '...', sender: 'AD-SWIGGY'}"
```

```typescript
// services/csv-handler.ts - Updated export function
export function exportToCSV(expenses: Expense[]): string {
  const rows = expenses.map((expense) => ({
    id: expense.id,
    amount: expense.amount.toString(),
    currency: expense.currency || getFallbackCurrency(),
    category: expense.category,
    date: expense.date,
    note: expense.note || "",
    paymentMethodType: expense.paymentMethod?.type || "",
    paymentMethodId: expense.paymentMethod?.identifier || "",
    paymentInstrumentId: expense.paymentMethod?.instrumentId || "",
    // NEW v2.0 fields
    source: expense.source || "",
    importMetadata: expense.importMetadata ? JSON.stringify(expense.importMetadata) : "",
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,
    deletedAt: expense.deletedAt || "",
  }))

  const csv = Papa.unparse(rows, {
    header: true,
    columns: [
      "id",
      "amount",
      "currency",
      "category",
      "date",
      "note",
      "paymentMethodType",
      "paymentMethodId",
      "paymentInstrumentId",
      "source",
      "importMetadata", // NEW v2.0
      "createdAt",
      "updatedAt",
      "deletedAt",
    ],
  })

  // Add version header comment
  return `#version: 2.0\n${csv}`
}

// services/csv-handler.ts - Updated import function
export function importFromCSV(csvString: string): {
  expenses: Expense[]
  version: number
} {
  // Parse version from header comment
  const versionMatch = csvString.match(/^#version:\s*(\d+\.?\d*)/m)
  const csvVersion = versionMatch ? parseFloat(versionMatch[1]) : 1.0

  // Remove comment lines before parsing
  const cleanCsv = csvString.replace(/^#.*$/gm, "").trim()

  const result = Papa.parse<CSVRow>(cleanCsv, {
    header: true,
    skipEmptyLines: true,
  })

  if (result.errors.length > 0) {
    throw new Error(`CSV parsing failed: ${result.errors[0].message}`)
  }

  const expenses = result.data.map((row) => {
    const paymentMethod = row.paymentMethodType?.trim()
      ? {
          type: row.paymentMethodType as PaymentMethodType,
          identifier: row.paymentMethodId?.trim() || undefined,
          instrumentId: row.paymentInstrumentId?.trim() || undefined,
        }
      : undefined

    const expense: Expense = {
      id: row.id,
      amount: parseFloat(row.amount),
      currency: row.currency?.trim() || getFallbackCurrency(),
      category: row.category as ExpenseCategory,
      date: row.date,
      note: row.note || "",
      paymentMethod,
      createdAt: row.createdAt || new Date().toISOString(),
      updatedAt: row.updatedAt || new Date().toISOString(),
      deletedAt: row.deletedAt?.trim() || undefined,
    }

    // Handle v2.0+ fields
    if (csvVersion >= 2) {
      if (row.source?.trim()) {
        expense.source = row.source as "manual" | "auto-imported"
      }
      if (row.importMetadata?.trim()) {
        try {
          expense.importMetadata = JSON.parse(row.importMetadata)
        } catch {
          // Ignore malformed metadata
        }
      }
    }

    return expense
  })

  return { expenses, version: csvVersion }
}
```

### Database Schema Migration

Since we're adding new fields to existing Expense type:

```typescript
// Migration for existing expenses
async function migrateExpensesForSMSImport(): Promise<void> {
  const expenses = await loadAllExpenses()

  const migrated = expenses.map((expense) => ({
    ...expense,
    // New fields default to undefined (backward compatible)
    source: expense.source || undefined,
    // importMetadata only added for new auto-imported expenses
  }))

  await saveExpenses(migrated)
}
```

### Settings Migration

Add new fields to AppSettings (v6 → v7):

```typescript
// services/settings-manager.ts - Migration v7
function migrateV6ToV7(settings: AppSettings): AppSettings {
  return {
    ...settings,
    smsImportSettings: {
      enabled: false,
      scanOnLaunch: false,
      reviewRetentionDays: 30,
    },
    version: 7,
  }
}
```

> **Note:** The v7 migration uses a simplified settings interface with a single `enabled` toggle (no separate `smsEnabled` field since v1 is SMS-only). Fields like `autoImportEnabled`, `notificationsEnabled`, and `minimumConfidence` are deferred to future versions. All imports go through the review queue in v1.

---

## Appendices

### Appendix A: Supported Bank Formats

The ML-only parser (TFLite Bi-LSTM) handles all bank SMS formats universally without per-bank regex patterns. The model was trained on transaction SMS samples from the following regions:

| Region | Banks / Providers                                   |
| ------ | --------------------------------------------------- |
| India  | HDFC, ICICI, SBI, Axis, Kotak, Paytm, GPay, PhonePe |
| US     | Chase, Bank of America, Wells Fargo, Citi           |
| EU     | Revolut, N26, ING                                   |
| Japan  | MUFG (三菱UFJ), SMBC (三井住友), Mizuho (みずほ)    |

> **Note:** Unlike the earlier regex-based design, the ML model generalizes to unseen SMS formats. No per-bank pattern maintenance is required. See [ML_SMS_PARSER.md](./ML_SMS_PARSER.md) for architecture details.

### Appendix B: Error Codes

| Code     | Description                 | Recovery                        |
| -------- | --------------------------- | ------------------------------- |
| `SMS001` | SMS permission denied       | Show manual import option       |
| `SMS002` | Failed to parse transaction | Log for model improvement       |
| `SMS003` | Duplicate detected          | Skip silently                   |
| `SMS004` | Learning engine error       | Continue without suggestions    |
| `SMS005` | Storage full                | Alert user to clear old imports |

### Appendix C: Analytics (Optional)

If analytics are enabled (opt-in):

| Event                      | Properties                        |
| -------------------------- | --------------------------------- |
| `sms_import_received`      | confidence                        |
| `sms_import_confirmed`     | time_to_confirm, category_changed |
| `sms_import_edited`        | fields_changed, apply_to_future   |
| `sms_import_rejected`      | reason                            |
| `learning_suggestion_used` | merchant, confidence              |

**Note:** No PII in analytics. Merchant names hashed.

---

## Change Log

| Date       | Version | Changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-02-15 | 1.0     | Initial implementation plan                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-02-15 | 1.1     | Added GitHub sync for merchant learning patterns                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-02-15 | 1.2     | Added sync trigger behavior specification (no auto-sync on import)                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-02-15 | 1.3     | v1 scope corrections: SMS-only (dropped notification listener — expo-notifications cannot read other apps' notifications, requires native NotificationListenerService); removed auto-import bypass (all imports require review queue); fixed .toTitleCase() bug (not a JS built-in); added international bank patterns (US, EU, JP); CSV format version bump with backward-compatible migration; settings migration v6→v7 simplified; review queue uses triggerSync: false |
| 2026-02-19 | 2.0     | ML-only architecture: replaced all regex-based bank patterns with on-device TFLite Bi-LSTM model; removed BANK_PATTERNS and TransactionParser class; added TFLiteParser, TFLiteTokenizer, and ML message-id (SHA-256) services; updated architecture diagrams; updated Phase 3 tasks; replaced Appendix A bank pattern tables with ML training coverage table; added reference to ML_SMS_PARSER.md                                                                         |

---

## References

1. [Expo SMS Documentation](https://docs.expo.dev/versions/latest/sdk/sms/)
2. [Android SMS Permissions](https://developer.android.com/reference/android/Manifest.permission#READ_SMS)
3. [ML SMS Parser Architecture](./ML_SMS_PARSER.md)
4. [TensorFlow Lite for React Native](https://github.com/nicklockwood/react-native-fast-tflite)
5. [Levenshtein Distance Algorithm](https://en.wikipedia.org/wiki/Levenshtein_distance)
6. [XState Store Documentation](https://stately.ai/docs/xstate-store)

---

**Next Steps:**

1. Review and approve implementation plan
2. Create Phase 1 tickets
3. Set up feature branch structure
4. Begin development
