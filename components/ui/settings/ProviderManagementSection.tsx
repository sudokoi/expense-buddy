import { useState, useCallback, useEffect } from "react"
import { YStack, XStack, Text, Button } from "tamagui"
import { Alert, Platform } from "react-native"
import { X, Plus } from "@tamagui/lucide-icons-2"
import type {
  ProviderConfig,
  SyncProvidersState,
} from "../../../services/sync/provider-types"
import { providerSettingsStore } from "../../../services/sync/provider-settings-store"
import { createProvider } from "../../../services/sync/provider-registry"
import { isProviderReconciled } from "../../../services/sync-queue"
import { useTranslation } from "react-i18next"
import {
  UI_RADIUS,
  UI_SPACE,
  UI_OPACITY,
  UI_FONT_WEIGHT,
} from "../../../constants/ui-tokens"
import { SEMANTIC_COLORS } from "../../../constants/theme-colors"

const successColor = SEMANTIC_COLORS.success
const errorColor = SEMANTIC_COLORS.error

interface ProviderItemProps {
  config: ProviderConfig
  isActive: boolean
  isReconciled: boolean
  onActivate: (id: string) => void
  onRemove: (id: string) => void
  onTestConnection: (config: ProviderConfig) => void
  isTesting: boolean
  connectionLabel: string | null
  connectionError: string | null
}

function ProviderCard({
  config,
  isActive,
  isReconciled,
  onActivate,
  onRemove,
  onTestConnection,
  isTesting,
  connectionLabel,
  connectionError,
}: ProviderItemProps) {
  const { t } = useTranslation()

  const kindLabel =
    config.kind === "github"
      ? t("settings.providers.github")
      : t("settings.providers.googleDrive")

  return (
    <XStack
      bg={isActive ? "$backgroundHover" : "$background"}
      px={UI_SPACE.section}
      py={UI_SPACE.section}
      rounded={UI_RADIUS.surface}
      borderWidth={isActive ? 2 : 1}
      borderColor={isActive ? successColor : "$borderColor"}
      items="center"
      justify="space-between"
    >
      <YStack flex={1} gap={UI_SPACE.micro}>
        <XStack gap={UI_SPACE.control} items="center">
          <Text fontWeight={UI_FONT_WEIGHT.medium}>{config.label || kindLabel}</Text>
          {isActive && (
            <YStack bg={successColor} px={UI_SPACE.micro} py={1} rounded={UI_RADIUS.chip}>
              <Text fontSize="$caption" color="white" fontWeight={UI_FONT_WEIGHT.bold}>
                {t("settings.providers.active")}
              </Text>
            </YStack>
          )}
          {!isReconciled && (
            <YStack bg="$yellow9" px={UI_SPACE.micro} py={1} rounded={UI_RADIUS.chip}>
              <Text fontSize="$caption" color="white" fontWeight={UI_FONT_WEIGHT.bold}>
                {t("settings.providers.needsSetup")}
              </Text>
            </YStack>
          )}
        </XStack>
        <Text fontSize="$caption" color="$color" opacity={UI_OPACITY.medium}>
          {config.kind === "github"
            ? `${(config as any).repo || ""}`
            : config.kind === "google_drive"
              ? t("settings.providers.googleDriveDesc")
              : ""}
        </Text>
        {connectionLabel && (
          <Text fontSize="$caption" color={successColor}>
            {connectionLabel}
          </Text>
        )}
        {connectionError && (
          <Text fontSize="$caption" color={errorColor}>
            {connectionError}
          </Text>
        )}
      </YStack>

      <XStack gap={UI_SPACE.micro} flexWrap="wrap" items="center">
        <Button
          size="$compact"
          onPress={() => onTestConnection(config)}
          disabled={isTesting}
        >
          {isTesting ? t("settings.providers.testing") : t("settings.providers.test")}
        </Button>
        {!isActive && (
          <Button size="$compact" theme="accent" onPress={() => onActivate(config.id)}>
            {t("settings.providers.activate")}
          </Button>
        )}
        <Button
          size="$compact"
          color="white"
          bg={errorColor}
          onPress={() => onRemove(config.id)}
          icon={X}
        />
      </XStack>
    </XStack>
  )
}

export interface ProviderManagementSectionProps {
  onNotification: (message: string, type: "success" | "error" | "info") => void
  onAddProvider: (kind: "github" | "google_drive") => void
  isTesting: boolean
}

export function ProviderManagementSection({
  onNotification,
  onAddProvider,
  isTesting: _isTesting,
}: ProviderManagementSectionProps) {
  const { t } = useTranslation()

  const [providerState, setProviderState] = useState<SyncProvidersState>({
    activeProviderId: null,
    providers: [],
  })
  const [reconciledMap, setReconciledMap] = useState<Record<string, boolean>>({})
  const [connectionResults, setConnectionResults] = useState<
    Record<string, { ok: boolean; label?: string; error?: string }>
  >({})
  const [testingId, setTestingId] = useState<string | null>(null)

  const loadState = useCallback(async () => {
    const state = await providerSettingsStore.load()
    setProviderState(state)

    const reconciled: Record<string, boolean> = {}
    for (const p of state.providers) {
      reconciled[p.id] = await isProviderReconciled(p.id)
    }
    setReconciledMap(reconciled)
  }, [])

  useEffect(() => {
    void loadState()
  }, [loadState])

  const handleActivate = useCallback(
    async (id: string) => {
      await providerSettingsStore.setActiveProvider(id)
      await loadState()
      onNotification(t("settings.providers.activated"), "success")
    },
    [loadState, onNotification, t]
  )

  const handleRemove = useCallback(
    async (id: string) => {
      const config = providerState.providers.find((p) => p.id === id)
      const label = config?.label || id

      Alert.alert(
        t("settings.providers.removeTitle"),
        t("settings.providers.removeMessage", { label }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("settings.providers.remove"),
            style: "destructive",
            onPress: async () => {
              await providerSettingsStore.removeProvider(id)
              await loadState()
              onNotification(t("settings.providers.removed"), "info")
            },
          },
        ]
      )
    },
    [providerState.providers, loadState, onNotification, t]
  )

  const handleTestConnection = useCallback(
    async (config: ProviderConfig) => {
      setTestingId(config.id)
      setConnectionResults((prev) => ({
        ...prev,
        [config.id]: { ok: false },
      }))

      try {
        const provider = createProvider(config)
        const result = await provider.testConnection()

        setConnectionResults((prev) => ({
          ...prev,
          [config.id]: result.ok
            ? { ok: true, label: result.label }
            : { ok: false, error: result.error.message },
        }))

        if (result.ok) {
          onNotification(t("settings.providers.connectionOk"), "success")
        } else {
          onNotification(result.error.message, "error")
        }
      } catch (error) {
        setConnectionResults((prev) => ({
          ...prev,
          [config.id]: { ok: false, error: String(error) },
        }))
        onNotification(String(error), "error")
      } finally {
        setTestingId(null)
      }
    },
    [onNotification, t]
  )

  const hasProviders = providerState.providers.length > 0

  return (
    <YStack gap="$gutter">
      {/* Provider cards */}
      {hasProviders ? (
        <YStack gap="$control">
          <Text
            fontSize="$body"
            fontWeight={UI_FONT_WEIGHT.bold}
            color="$color"
            opacity={UI_OPACITY.strong}
          >
            {t("settings.providers.title")}
          </Text>

          {providerState.providers.map((config) => (
            <ProviderCard
              key={config.id}
              config={config}
              isActive={config.id === providerState.activeProviderId}
              isReconciled={reconciledMap[config.id] ?? false}
              onActivate={handleActivate}
              onRemove={handleRemove}
              onTestConnection={handleTestConnection}
              isTesting={testingId === config.id}
              connectionLabel={
                connectionResults[config.id]?.ok
                  ? (connectionResults[config.id].label ?? null)
                  : null
              }
              connectionError={
                connectionResults[config.id] && !connectionResults[config.id].ok
                  ? (connectionResults[config.id].error ?? null)
                  : null
              }
            />
          ))}
        </YStack>
      ) : (
        <YStack
          bg="$backgroundHover"
          p={UI_SPACE.section}
          rounded={UI_RADIUS.surface}
          items="center"
          gap="$control"
        >
          <Text
            fontSize="$body"
            color="$color"
            opacity={UI_OPACITY.medium}
            style={{ textAlign: "center" }}
          >
            {t("settings.providers.noProviders")}
          </Text>
        </YStack>
      )}

      {/* Add provider buttons */}
      <XStack gap="$control" flexWrap="wrap">
        <Button
          size="$control"
          icon={Plus}
          onPress={() => onAddProvider("github")}
          theme="accent"
        >
          {t("settings.providers.addGithub")}
        </Button>
        {Platform.OS === "android" && (
          <Button
            size="$control"
            icon={Plus}
            onPress={() => onAddProvider("google_drive")}
          >
            {t("settings.providers.addGoogleDrive")}
          </Button>
        )}
      </XStack>
    </YStack>
  )
}
