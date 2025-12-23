import { Card, CardProps } from "tamagui"

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ExpenseCardProps extends CardProps {}

/**
 * ExpenseCard - A styled Card component for displaying expense items
 * Provides consistent padding, borders, layout, and hover animation
 */
export function ExpenseCard(props: ExpenseCardProps) {
  return (
    <Card
      bordered
      padding="$3"
      marginBottom="$3"
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
      animation="lazy"
      hoverStyle={{ scale: 1.01 }}
      {...props}
    />
  )
}

export type { ExpenseCardProps }
