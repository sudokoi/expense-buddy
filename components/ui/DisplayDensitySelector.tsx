import { Text, View } from "react-native"
import { Check } from "lucide-react-native"
import { useTranslation } from "react-i18next"
import { useDisplayDensity } from "../../hooks/use-display-density"
import { useThemeColors } from "../../hooks/use-theme-colors"
import { CompactControl } from "./CompactControl"
import { Label } from "./Label"

export function DisplayDensitySelector() {
  const { density, setDensity, icon } = useDisplayDensity()
  const { t } = useTranslation()
  const theme = useThemeColors()
  return (
    <View className="gap-ui-control">
      <Label>{t("settings.appearance.density.title")}</Label>
      <View className="flex-row flex-wrap gap-ui-control">
        {(["standard", "compact"] as const).map((value) => (
          <CompactControl
            key={value}
            accessibilityRole="radio"
            accessibilityLabel={t(`settings.appearance.density.${value}`)}
            accessibilityState={{ checked: density === value }}
            onPress={() => setDensity(value)}
            surfaceStyle={{
              backgroundColor: density === value ? theme.muted : theme.surface,
              borderColor: density === value ? theme.accent : theme.border,
            }}
          >
            <Text className="text-sm font-medium text-foreground">
              {t(`settings.appearance.density.${value}`)}
            </Text>
            {density === value ? <Check size={icon.mini} color={theme.accent} /> : null}
          </CompactControl>
        ))}
      </View>
      <Text className="text-xs text-muted-foreground">
        {t("settings.appearance.density.help")}
      </Text>
    </View>
  )
}
