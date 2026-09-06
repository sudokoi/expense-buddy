import type { SmsImportReviewItem } from "../../types/sms-import"

const clauseBoundary = /[!?。;]+\s*|\.\s+(?=[\p{L}₹$£€¥￥])/u
const instruction =
  /\b(?:never share|do not share|not you|if not|if this wasn|if (?:your|the) (?:payment|transaction) (?:failed|was declined)|for (?:assistance|help|refund enquiries|refund inquiries)|please contact|to dispute|sms block)\b|^\s*call\s+\d/i
const information =
  /\b(?:available balance|avl[. ]*(?:bal|limit)|balance|available limit|credit limit|ref(?:erence)?|rrn|utr)\s*[:.=-]?\s*/i
const recipient =
  /\b(?:to|for|recipient|beneficiary)\s+(?:(?:your|the|a)\s+)?(?:credit card|debit card|card|a\/c|acct|account)\b[^.;!?]{0,60}?(?=\s+(?:via|using|by|from)\b|[.;!?]|$)/gi

/** Review-only context: never determines transaction acceptance, amount, or currency. */
export function getReviewEvidence(item: SmsImportReviewItem): {
  description: string
  payer: string
} {
  const description = item.sourceMessage.body
    .normalize("NFKC")
    .replace(/[\u200b\ufeff]/g, "")
    .split(clauseBoundary)
    .map((clause) => {
      const end = [clause.search(instruction), clause.search(information)].filter(
        (index) => index >= 0
      )
      return end.length ? clause.slice(0, Math.min(...end)) : clause
    })
    .join(". ")
  let payer = description.replace(recipient, " ")
  if (item.merchantName) {
    const merchant = item.merchantName
      .normalize("NFKC")
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    payer = payer.replace(new RegExp(merchant, "gi"), " ")
  }
  return { description, payer }
}
