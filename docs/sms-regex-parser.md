# Regex SMS parser robustness

The parser remains deterministic, on-device, and review-first. No model, ML
training asset, expense schema, or review-queue schema changes are required.

## Boundaries and behavior

`SmsMessageParser.parseRawMessageWithReason` remains the shared foreground and
background entry point. Its result fields, region selection, skip-reason enum,
receipt-date fallback, and pattern-key format are unchanged.

The internal responsibilities are now separate:

- `SmsTransactionRules`: distinguish reported debits from failures, future
  debits, payment requests, promotions, and authentication prompts. Remove known
  security footers only from the matching text, not from the stored SMS.
- `SmsAmountRules`: extract complete money tokens, discard labelled balances,
  limits, cashback and dues, and require an unambiguous positive finite amount.
  Validate western/Indian grouping and currency precision. Explicit supported
  currency codes/symbols win; bare dollars use the US/CA/AU region. Unsupported
  or conflicting amounts are skipped rather than silently truncated or guessed.
- `SmsMerchantRules`: prefer structured UPI references, then bounded merchant
  fields; support punctuation, domains, longer names, and Japanese field labels.
- `SmsCategoryRules`: merchant evidence before body evidence; longer matching
  phrases before shorter terms, with list order as the tie-breaker. Latin token
  boundaries prevent `lease` matching `please` and `ola` matching `chocolate`.
- Regional packs own language-specific state markers, category vocabulary, and
  payment-rail hints. Visa/Mastercard alone do not imply credit. Explicit card
  types and regional transfer rails remain suggestions, not payment verification.

The JS suggestion resolver retains saved-instrument/custom-category ownership.
Its fallback no longer treats account debits as proof of debit-card use or lets
generic network hints override explicit debit/credit wording.

Matching tolerates whitespace, fullwidth text, decimal Unicode digits, and
zero-width separators. The original SMS is retained. This additional matching
normalization deliberately does not change historical fingerprint normalization.

## Upgrade safety

Amount formatting in fingerprints is now locale-independent. Corrected amounts
can also change fingerprints, so fingerprint equality alone is insufficient for
upgrade deduplication.

Within each queue/journal transaction, the repository compares normalized source
sender/body and the existing three-minute receipt-time bucket **without the
extracted amount**. It looks up all four statuses using the existing
`(status, timestamp)` index. A batch-local map shares one lookup/hash pass per
bucket. Concurrent inserts remain serialized by Room transactions.

If the source already exists, its fingerprint, amount, pending edits, terminal
decision, and accepted-expense link remain untouched. The deduplication journal
uses the existing fingerprint. This intentionally does not repair old suggestions
in place or modify confirmed expenses. No inbox cursor reset or automatic replay
is performed. New rules apply to messages scanned after the current cursor;
recovering older missed SMS needs a separately designed replay flow.

The existing three-minute bucket behavior is retained, including its limitation:
identical messages on opposite sides of a bucket boundary are distinct.

## Corpus and measurement

Fixtures live in
`modules/expense-buddy-sms-parser/android/src/test/resources/sms-regex-corpus.tsv`.
Each row has an ID, provenance, region, exact expected fields or skip reason,
and SMS text. Expected values are independently authored; never regenerate them
from parser output. `SmsParserCorpusTest` tests the public parser, not private
regex helpers. The existing 4.2.1 tests are retained; three assertions that
incorrectly assumed Visa means credit now expect an unspecified card type.

`SmsParserRobustnessTest` exercises each of IN/US/GB/CA/AU/JP with typography,
whitespace, security-footer, negative-outcome and malformed-number variants.
Repository tests cover changed-amount identities, pending/terminal preservation,
concurrent parser versions, and genuinely later transactions. JS tests cover
the downstream category and saved-instrument boundary.

Reproduction:

```sh
yarn test:kotlin
yarn exec jest --runInBand services/sms-import/suggestion-resolver.test.ts
yarn test
yarn typecheck --incremental false
yarn lint
```

This is a **regression corpus**, not a representative bank-message benchmark.
Passing it does not establish population precision/recall. Generated variants
share their source template and must not be counted as independent real samples.
Before claiming real-world accuracy, collect consented, anonymized messages,
label them independently, and hold out entire bank/template families rather than
randomly splitting near-duplicate variants. Report detection precision/recall and
exact amount/currency/merchant/method correctness separately for each region.

## Sources and privacy

Consulted on 2026-09-06:

1. [Transaction SMS Parser example](https://github.com/saurabhgupta050890/transaction-sms-parser)
   — the `balance-last` fixture adapts its debit/balance example, with a different
   account suffix and simplified wording. Its published output incorrectly uses
   the balance as the transaction amount; those output labels were not reused.
   The example is MIT-licensed; the notice is retained below.
2. [Bank SMS auto-detection explainer](https://www.trakio.co.in/blog/how-bank-sms-auto-detection-works)
   — `in-public-upi` is a short adapted example with replacement account/reference
   digits. This is a publicly illustrated template, not verified bank SMS data.
3. [SMBC usage-notification guidance](https://www.smbc-card.com/mem/service/sec/selfcontrol/usage_notice.jsp)
   and [confirmation-notification FAQ](https://qa.smbc-card.com/mem/hojin/detail?category=116&id=2761&site=4H4A00IO)
   — contextual guidance distinguishing usage, failed usage, and confirmation
   notifications. These pages do not establish the synthetic JP fixtures as real
   SMS templates; routine notifications also use email/push/LINE.

Rows marked `generated` are invented regression cases, not customer data or
claims of a particular bank's exact wording. Hindi and Japanese additions are
limited examples, not comprehensive language coverage. No inbox data was uploaded,
no third-party corpus dependency was added, and no ML tooling was used.

### MIT notice for the adapted Transaction SMS Parser example

Copyright (c) 2022 Saurabh Gupta

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
