import { Card, CardProps } from "tamagui"
import { memo } from "react"

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ExpenseCardProps extends CardProps {}

/**
 * ExpenseCard - A styled Card component for displaying expense items
 * Provides consistent padding, borders, layout, and hover animation
 * Memoized to prevent unnecessary re-renders in lists
 * Note: Parent container should control spacing between cards
 */
export const ExpenseCard = memo(function ExpenseCard(props: ExpenseCardProps) {
  return (
    <Card
      bordered
      padding="$3"
      marginBottom="$2"
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
      {...props}
    />
  )
})

export type { ExpenseCardProps }
