import { useCallback } from "react"
import { YStack, XStack, Text, Button, View } from "tamagui"
import { Alert, Animated } from "react-native"
import { Plus, Pencil, Play, Check, Trash2, X } from "@tamagui/lucide-icons-2"
import type { ProviderConfig } from "../../../services/sync/provider-types"
import { SyncProviderError } from "../../../services/sync/provider-types"
import { providerStateStore } from "../../../services/sync/provider-state-store"
import { useSwipeReveal } from "../../../hooks/use-swipe-reveal"
import { IconActionButton } from "../IconActionButton"
import { useTranslation } from "react-i18next"
import {
  useProviderManagement,
  ProviderCardStatus,
  ProviderConnectionStatus,
} from "../../../stores/hooks"
import {
  UI_RADIUS,
  UI_SPACE,
  UI_OPACITY,
  UI_FONT_WEIGHT,
} from "../../../constants/ui-tokens"
import { SEMANTIC_COLORS } from "../../../constants/theme-colors"

const successColor = SEMANTIC_COLORS.success
const errorColor = SEMANTIC_COLORS.error
const ACTION_WIDTH = 260
const SWIPE_THRESHOLD = 60
const OPEN_RATIO = 0.85

interface ProviderCardActions {
  onEdit?: (config: ProviderConfig) => void
  onRemove: (id: string) => void
  onDeleteRemote: (config: ProviderConfig) => void
  onActivate: (id: string) => void
  onTestConnection: (config: ProviderConfig) => void
}

function SwipeableProviderCard({
  status,
  providerCard,
  actions,
}: {
  status: ProviderCardStatus
  providerCard: ReturnType<typeof useProviderManagement>["providerCards"][number]
  actions: ProviderCardActions
}) {
  const { t } = useTranslation()
  const { config, connectionStatus, connectionLabel, connectionError } = providerCard

  const { translateX, panResponder, close, actionsWidthRef } = useSwipeReveal({
    swipeThreshold: SWIPE_THRESHOLD,
    openRatio: OPEN_RATIO,
    direction: "left",
    verticalThresholdMultiplier: 2,
  })

  const kindLabel =
    config.kind === "github"
      ? t("settings.providers.github")
      : t("settings.providers.googleDrive")

  const handleAction = useCallback(
    (fn: () => void) => () => {
      close()
      fn()
    },
    [close]
  )

  const isActive =
    status === ProviderCardStatus.ActiveReconciled ||
    status === ProviderCardStatus.ActiveUnreconciled
  const isTesting = connectionStatus === ProviderConnectionStatus.Testing

  return (
    <View
      bg={isActive ? "$backgroundHover" : "$background"}
      rounded={UI_RADIUS.surface}
      borderWidth={isActive ? 2 : 1}
      borderColor={isActive ? successColor : "$borderColor"}
      overflow="hidden"
      position="relative"
    >
      <XStack
        position="absolute"
        r={0}
        t={0}
        b={0}
        style={{ alignItems: "center", justifyContent: "flex-end" }}
        gap={UI_SPACE.micro}
        pl={UI_SPACE.control}
        pr={UI_SPACE.control}
        onLayout={(e) => {
          actionsWidthRef.current = e.nativeEvent.layout.width
        }}
      >
        {config.kind === "github" && actions.onEdit && (
          <IconActionButton
            size="$compact"
            icon={Pencil}
            chromeless
            circular
            onPress={handleAction(() => actions.onEdit!(config))}
            tooltip={t("settings.providers.edit")}
          />
        )}
        <IconActionButton
          size="$compact"
          icon={Play}
          chromeless
          circular
          onPress={handleAction(() => actions.onTestConnection(config))}
          disabled={isTesting}
          tooltip={t("settings.providers.test")}
        />
        {!isActive && (
          <IconActionButton
            size="$compact"
            icon={Check}
            chromeless
            circular
            onPress={handleAction(() => actions.onActivate(config.id))}
            tooltip={t("settings.providers.activate")}
          />
        )}
        {config.kind === "google_drive" && (
          <IconActionButton
            size="$compact"
            icon={Trash2}
            chromeless
            circular
            color="white"
            bg={errorColor}
            onPress={handleAction(() => actions.onDeleteRemote(config))}
            tooltip={t("settings.providers.deleteBackup")}
          />
        )}
        <IconActionButton
          size="$compact"
          icon={X}
          chromeless
          circular
          onPress={handleAction(() => actions.onRemove(config.id))}
          tooltip={t("settings.providers.remove")}
        />
      </XStack>

      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        <XStack
          bg={isActive ? "$backgroundHover" : "$background"}
          px={UI_SPACE.section}
          py={UI_SPACE.section}
          items="center"
        >
          <YStack flex={1} gap={UI_SPACE.micro}>
            <XStack gap={UI_SPACE.control} items="center">
              <Text fontWeight={UI_FONT_WEIGHT.medium}>{config.label || kindLabel}</Text>
              {status === ProviderCardStatus.ActiveReconciled && (
                <YStack
                  bg={successColor}
                  px={UI_SPACE.micro}
                  py={1}
                  rounded={UI_RADIUS.chip}
                >
                  <Text
                    fontSize="$caption"
                    color="white"
                    fontWeight={UI_FONT_WEIGHT.bold}
                  >
                    {t("settings.providers.active")}
                  </Text>
                </YStack>
              )}
              {status === ProviderCardStatus.ActiveUnreconciled && (
                <YStack bg="$yellow9" px={UI_SPACE.micro} py={1} rounded={UI_RADIUS.chip}>
                  <Text
                    fontSize="$caption"
                    color="white"
                    fontWeight={UI_FONT_WEIGHT.bold}
                  >
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
            {connectionStatus === ProviderConnectionStatus.Success && connectionLabel && (
              <Text fontSize="$caption" color={successColor}>
                {connectionLabel}
              </Text>
            )}
            {connectionStatus === ProviderConnectionStatus.Failed && connectionError && (
              <Text fontSize="$caption" color={errorColor}>
                {connectionError}
              </Text>
            )}
          </YStack>
        </XStack>
      </Animated.View>
    </View>
  )
}

export interface ProviderManagementSectionProps {
  onNotification: (message: string, type: "success" | "error" | "info") => void
  onAddProvider: (kind: "github" | "google_drive") => void
  onEditProvider?: (config: ProviderConfig) => void
  onProviderMutated?: () => void
}

export function ProviderManagementSection({
  onNotification,
  onAddProvider,
  onEditProvider,
  onProviderMutated,
}: ProviderManagementSectionProps) {
  const { t } = useTranslation()

  const {
    providerCards,
    hasActiveProvider,
    removeProvider,
    setActiveProvider,
    testConnection,
  } = useProviderManagement()

  const handleActivate = useCallback(
    async (id: string) => {
      setActiveProvider(id)
      onNotification(t("settings.providers.activated"), "success")
      onProviderMutated?.()
    },
    [setActiveProvider, onNotification, onProviderMutated, t]
  )

  const handleRemove = useCallback(
    async (id: string) => {
      const config = providerCards.find((p) => p.config.id === id)
      const label = config?.config.label || id

      Alert.alert(
        t("settings.providers.removeTitle"),
        t("settings.providers.removeMessage", { label }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("settings.providers.remove"),
            style: "destructive",
            onPress: () => {
              removeProvider(id)
              onNotification(t("settings.providers.removed"), "info")
              onProviderMutated?.()
            },
          },
        ]
      )
    },
    [providerCards, removeProvider, onNotification, onProviderMutated, t]
  )

  const handleDeleteRemote = useCallback(
    async (config: ProviderConfig) => {
      if (config.kind !== "google_drive") return

      const label = config.label || config.id

      Alert.alert(
        t("settings.providers.deleteBackupTitle"),
        t("settings.providers.deleteBackupMessage", { label }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("settings.providers.deleteBackup"),
            style: "destructive",
            onPress: async () => {
              try {
                const { createProvider } =
                  await import("../../../services/sync/provider-registry")
                const provider = createProvider(config)
                if (!provider.deleteRemoteData) {
                  throw new SyncProviderError(
                    "NOT_FOUND",
                    config.kind,
                    "Remote backup deletion is not supported for this provider",
                    false
                  )
                }
                const deleted = await provider.deleteRemoteData()
                await providerStateStore.clearProvider(config.id)
                onNotification(
                  deleted
                    ? t("settings.providers.deleteBackupSuccess")
                    : t("settings.providers.deleteBackupMissing"),
                  deleted ? "success" : "info"
                )
                onProviderMutated?.()
              } catch (err) {
                const msg = err instanceof SyncProviderError ? err.message : String(err)
                onNotification(msg, "error")
              }
            },
          },
        ]
      )
    },
    [onNotification, onProviderMutated, t]
  )

  const handleTestConnection = useCallback(
    async (config: ProviderConfig) => {
      const result = await testConnection(config)
      if (result.ok) {
        onNotification(t("settings.providers.connectionOk"), "success")
      } else {
        const msg = typeof result.error === "string" ? result.error : result.error.message
        onNotification(msg, "error")
      }
    },
    [testConnection, onNotification, t]
  )

  const hasProviders = providerCards.length > 0
  const existingKinds = new Set(providerCards.map((p) => p.config.kind))

  return (
    <YStack gap="$gutter">
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

          {providerCards.map((card) => (
            <SwipeableProviderCard
              key={card.config.id}
              status={card.status}
              providerCard={card}
              actions={{
                onEdit: onEditProvider,
                onRemove: handleRemove,
                onDeleteRemote: handleDeleteRemote,
                onActivate: handleActivate,
                onTestConnection: handleTestConnection,
              }}
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

      <XStack gap="$control" flexWrap="wrap">
        {!existingKinds.has("github") && (
          <Button
            size="$control"
            icon={Plus}
            onPress={() => onAddProvider("github")}
            theme="accent"
          >
            {t("settings.providers.addGithub")}
          </Button>
        )}
        {!existingKinds.has("google_drive") && (
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
