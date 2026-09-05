import { Card } from "./Card"
import { memo } from "react"

type ExpenseCardProps = React.ComponentProps<typeof Card>

/**
 * ExpenseCard - A styled Card component for displaying expense items
 * Provides consistent padding, borders, layout, and hover animation
 * Memoized to prevent unnecessary re-renders in lists
 * Note: Parent container should control spacing between cards
 */
export const ExpenseCard = memo(function ExpenseCard(props: ExpenseCardProps) {
  return (
    <Card
      className="flex-row items-center justify-between rounded-none border-0 border-b border-border py-3"
      {...props}
    />
  )
})

export type { ExpenseCardProps }
