import { memo } from "react"
import { useTranslation } from "react-i18next"
import { formatDate } from "../../utils/date"
import { getMonthStartDate } from "../../utils/analytics/time"
import { FilterChip, FilterChipBar } from "./FilterChipBar"

interface MonthSelectorProps {
  value: string | null
  onChange: (value: string | null) => void
  availableMonths: string[]
}

export const MonthSelector = memo(function MonthSelector({
  value,
  onChange,
  availableMonths,
}: MonthSelectorProps) {
  const { t } = useTranslation()

  return (
    <FilterChipBar horizontal>
      <FilterChip
        label={t("common.all")}
        selected={value === null}
        onPress={() => onChange(null)}
      />
      {availableMonths.map((monthKey) => {
        const isSelected = value === monthKey
        const label = formatDate(getMonthStartDate(monthKey), "MMM yyyy")
        return (
          <FilterChip
            key={monthKey}
            label={label}
            selected={isSelected}
            onPress={() => onChange(monthKey)}
          />
        )
      })}
    </FilterChipBar>
  )
})

export type { MonthSelectorProps }
