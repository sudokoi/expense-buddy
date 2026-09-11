# Regex SMS parser robustness

The parser remains deterministic, on-device, and review-first. No model, ML
training asset, expense schema, or review-queue schema changes are required.

## Boundaries and behavior

`SmsMessageParser.parseRawMessageWithReason` remains the shared foreground and
background entry point. Its result fields, region selection, skip-reason enum,
receipt-date fallback, and pattern-key format are unchanged.

The internal responsibilities are now separate:

- `SmsEvidence`: keep ranges in normalized matching text for money, labels,
  merchant fields, and clauses. Ranges are not offsets into the stored SMS.
- `SmsTransactionRules`: distinguish reported debits from failures, future
  debits, payment requests, promotions, and authentication prompts. Mask bounded
  instruction spans only in matching text, not in the stored SMS. An instruction
  cannot swallow a later sentence containing another transaction. Require a
  relationship between the money and an outgoing event, rather than a debit word
  elsewhere. Reject distinct events even when their amounts are equal.
- `SmsAmountRules`: extract complete money tokens, discard labelled balances,
  limits, cashback and dues, and require an unambiguous positive finite amount.
  Validate western/Indian grouping and currency precision. Explicit supported
  currency codes/symbols win; bare dollars use the US/CA/AU region. Unsupported
  or conflicting amounts are skipped rather than silently truncated or guessed.
  Retain money roles until selection: an explicitly billed FX amount or explicit
  fee-inclusive debit total may disambiguate a single event. Estimates, missing
  fee totals, conflicting billed amounts, and malformed relevant tokens still
  skip. No conversion, fee summation, or refund netting is performed; the output
  must be an explicitly present money token.
- `SmsTransactionTemplates` / `IndiaSmsTransactionTemplates`: narrow body
  structures for HDFC sent-from-account and NetBanking, ICICI card usage and
  linked debit/recipient-credit, and SBI debit-card completion. They bind the
  amount and merchant, then pass through shared outcome/money checks. Multiple
  matching structures skip instead of choosing by registry order. Body signatures
  suffice for these initial templates; no sender allowlist or authentication claim
  is introduced. Internal rule IDs do not change public pattern keys.
- `SmsMerchantRules`: prefer structured UPI references, then bounded merchant
  fields; support punctuation, domains, longer names, and Japanese field labels.
  Compact `UPI/P2M/reference/merchant` fields (including the Axis BMTC format)
  are bounded by a field separator, sentence, end of text, or masked instruction;
  ambiguous trailing prose is not folded into the merchant. A P2M reference alone
  does not establish a completed payment.
- `SmsCategoryRules`: merchant evidence before body evidence; longer matching
  phrases before shorter terms, with list order as the tie-breaker. Latin token
  boundaries prevent `lease` matching `please` and `ola` matching `chocolate`.
- Regional packs own language-specific state markers, category vocabulary, and
  payment-rail hints. Visa/Mastercard alone do not imply credit. Explicit card
  types and regional transfer rails remain suggestions, not payment verification.
- `SmsPaymentMethodRules`: distinguish payer instruments from recipient details
  and supply an optional payer suffix in the existing identifier field. Uncertain
  identifiers remain absent; they do not invalidate an otherwise clear debit.
  Account labels such as `A/c no.`, `acct no`, and `account number:` are supported
  in both native extraction and the JS fallback. UPI uses the last three digits.

The JS suggestion resolver retains saved-instrument/custom-category ownership.
Its fallback no longer treats account debits as proof of debit-card use or lets
generic network hints override explicit debit/credit wording. Native absence is
not a veto on a useful configured guess: relevant payer digits, nicknames, and
network references can resolve a unique active saved instrument and supply that
instrument's configured type. `review-evidence.ts` limits these guesses to review
context, excluding support, reference, balance, and recipient details; it does not
classify transactions or choose amounts. Conflicting identifiers and duplicate
saved matches do not select an arbitrary instrument. Native `Other` likewise
does not block a supported custom-category guess. Existing explicit instrument
links and the review/edit/save UI remain unchanged, including for old pending
items. The existing independent native ML category stage is unchanged and is not
part of these deterministic-parser measurements.

### Saved-instrument hint matching

The resolver filters to active instruments with a compatible payment method,
then uses payer digits before nickname evidence. Conflicting native/body digits
or multiple saved suffix matches leave the instrument unselected; a nickname
cannot override them. Existing explicit instrument links retain priority.

When digits are absent, a normalized exact nickname takes precedence over a
distinctive two- or three-word phrase. Phrase matching removes the configured
method's words from the nickname, so `Axis Bank UPI` can match a separate `UPI`
rail and `Axis Bank` signature. Word boundaries, Unicode normalization, and
punctuation folding apply. Generic terms such as `bank`, `card`, `account`, or
`UPI` alone are insufficient. Multiple matches at the strongest tier remain
ambiguous regardless of instrument order. This is deterministic phrase matching,
not TF-IDF or unrestricted token overlap.

Review evidence excludes named payees and UPI recipient fields as well as
support/reference text. Line boundaries keep a bank signature separate from a
preceding security instruction. These hints enrich review suggestions only;
they do not establish transaction acceptance or bank authentication.

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

Fixtures live under
`modules/expense-buddy-sms-parser/android/src/test/resources/` in
`sms-regex-corpus.tsv`, `sms-evidence-corpus.tsv`, and
`sms-bank-template-corpus.tsv`.
Each row has an ID, provenance, region, exact expected fields or skip reason,
and SMS text. The bank corpus also records sender and template family. Expected
values are independently authored; never regenerate them
from parser output. `SmsParserCorpusTest` tests the public parser, not private
regex helpers. The existing 4.2.1 tests are retained; three assertions that
incorrectly assumed Visa means credit now expect an unspecified card type.

The only changed original corpus outcome in the evidence upgrade is
`in-two-debits`: still rejected, but now `NEGATIVE_ALERT` because two outgoing
events are identified, rather than `AMOUNT_MISSING` from competing amounts.
The bank fixture `hdfc-sent` deliberately does not infer UPI from a `SMS BLOCK UPI`
security footer. Initial test labelling was corrected on semantic review before
the comparison; that footer does not establish the paying rail.

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

### Evidence-upgrade comparison (2026-09-06)

Compared the parser sources at `0dcc0339741cd203c6ef726e0908bb2f44ad798a` with the
evidence implementation on the **same 108 independently labelled development
fixtures**: 73 original, 24 new synthetic evidence cases, and 11 bank cases.
Both source versions were compiled with Kotlin 2.1.20 and run on the host JVM
through the unchanged public parser boundary; only `android.util.Log` was
stubbed. No ML stage, inbox access, saved-user settings, or Android speed measurement
was involved. The fixture suites also execute through `yarn test:kotlin`.

This is a deliberately targeted regression comparison, **not held-out evaluation
or population accuracy**. Source families and generated variants used to develop
the rules are not independent evaluation samples. No family was kept blind during
this iteration, so no generalization claim is made.

| Metric                                         |      Baseline | Evidence implementation |
| ---------------------------------------------- | ------------: | ----------------------: |
| True positives                                 |            45 |                      56 |
| False positives                                |            14 |                       0 |
| False negatives                                |            11 |                       0 |
| True negatives                                 |            38 |                      52 |
| Detection precision, TP / (TP + FP)            | 45/59 (76.3%) |            56/56 (100%) |
| Detection recall, TP / (TP + FN)               | 45/56 (80.4%) |            56/56 (100%) |
| Exact amount / currency, among true positives  |    45/45 each |              56/56 each |
| Exact merchant, among true positives           |         43/45 |                   56/56 |
| Exact category, among true positives           |         45/45 |                   56/56 |
| Exact native method type, among true positives |         44/45 |                   56/56 |

The field denominators differ because more valid cases are detected; missing
candidates are counted as false negatives, not hidden field successes. Null
merchant/method expectations count as exact matches when correctly left null.
These method figures are native type extraction, not saved-instrument precision;
configured-guess behavior is separately protected by JS resolver/bridge tests.

| Region | Cases | Baseline TP / FP / FN / TN | Final TP / FP / FN / TN |
| ------ | ----: | -------------------------- | ----------------------- |
| IN     |    56 | 24 / 4 / 6 / 22            | 30 / 0 / 0 / 26         |
| US     |    11 | 5 / 2 / 1 / 3              | 6 / 0 / 0 / 5           |
| GB     |     9 | 3 / 2 / 1 / 3              | 4 / 0 / 0 / 5           |
| CA     |    12 | 6 / 2 / 1 / 3              | 7 / 0 / 0 / 5           |
| AU     |     8 | 3 / 2 / 1 / 2              | 4 / 0 / 0 / 4           |
| JP     |    12 | 4 / 2 / 1 / 5              | 5 / 0 / 0 / 7           |

Traceable changes by fixture ID:

- `*-equal-events` and `*-offer` (six regions each), `in-unrelated-credit`, and
  `in-unrelated-prize`: incorrect candidates now skip (14 false positives fixed).
- `*-conditional` (six regions), `in-fx-billed`, `in-fee-total`, `hdfc-sent`,
  `icici-card-limit`, and `sbi-done`: previously missed valid candidates now parse.
- `hdfc-netbanking`: previously absent method becomes Net Banking.
- `icici-recipient-credit` and `icici-autopay`: previously missing merchants are
  extracted from their transaction fields.
- No baseline true-positive detection in these fixtures was lost.

Other public-boundary tests cover equal-valued Japanese usage events, repeated
bank templates, linked transfers, actual versus conditional refunds, malformed
billed amounts, payer/payee suffixes, and long inputs. Queue tests verify complete
pending/terminal row preservation and the old fingerprint in dedupe journals,
including a billed-currency correction. Production queue/DAO/schema code is
unchanged. No rebuilt-APK device smoke was performed for these measurements.

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

### Bank-template fixture attribution

`sms-bank-template-corpus.tsv` contains adaptations of the
[PennyWise contributors' test examples](https://github.com/sarim2000/pennywiseai-tracker/tree/3392949219ea5474959b65a413924ff9bd227c74/parser-core/src/test/kotlin),
specifically `TestHDFCBankParser.kt`, `TestICICIBankParser.kt`, and
`TestSBIParser.kt`, at commit `3392949219ea5474959b65a413924ff9bd227c74`.
The source repository is licensed under
[AGPL-3.0](https://github.com/sarim2000/pennywiseai-tracker/blob/3392949219ea5474959b65a413924ff9bd227c74/LICENSE),
also provided in this repository's `LICENSE`. These fixture adaptations were
modified on 2026-09-06: identifiers, dates, phone numbers, and some merchants and
amounts were replaced. Expected results were independently labelled for Expense
Buddy; source income/refund behavior and unspecified-card credit assumptions were
not adopted. Credit: PennyWise contributors. No source parser implementation was
copied. These are public repository examples, not verified bank-issued/customer
messages. Rows labelled `generated` are synthetic counterexamples in the same
template family, not additional independent real samples.

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
