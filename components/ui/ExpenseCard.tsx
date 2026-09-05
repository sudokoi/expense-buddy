import { Card } from "./Card"
import { memo } from "react"

type ExpenseCardProps = React.ComponentProps<typeof Card>

/**
 * ExpenseCard - A styled Card component for displaying expense items
 * Keeps the shared Card's rounded border with compact expense-row padding.
 * Memoized to prevent unnecessary re-renders in lists
 * Note: Parent container should control spacing between cards
 */
export const ExpenseCard = memo(function ExpenseCard(props: ExpenseCardProps) {
  return (
    <Card className="flex-row items-center justify-between gap-2 px-3 py-2" {...props} />
  )
})

export type { ExpenseCardProps }
