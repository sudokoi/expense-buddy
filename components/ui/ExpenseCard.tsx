import { Card, CardProps } from "tamagui"

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ExpenseCardProps extends CardProps {}

/**
 * ExpenseCard - A styled Card component for displaying expense items
 * Provides consistent padding, borders, layout, and hover animation
 * Note: Parent container should control spacing between cards
 */
export function ExpenseCard(props: ExpenseCardProps) {
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
}

export type { ExpenseCardProps }
