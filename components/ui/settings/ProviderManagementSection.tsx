import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import { YStack, XStack, Text, Button, View } from "tamagui"
import { Alert, Platform, Animated, PanResponder } from "react-native"
import { Plus, Pencil, Play, Trash2, Check } from "@tamagui/lucide-icons-2"
import type {
  ProviderConfig,
  SyncProvidersState,
} from "../../../services/sync/provider-types"
import { SyncProviderError as SyncProviderErrorClass } from "../../../services/sync/provider-types"
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
const SWIPE_THRESHOLD = 60
const ACTION_WIDTH = 260

interface ProviderItemProps {
  config: ProviderConfig
  isActive: boolean
  isReconciled: boolean
  onActivate: (id: string) => void
  onEdit: (config: ProviderConfig) => void
  onRemove: (id: string) => void
  onTestConnection: (config: ProviderConfig) => void
  isTesting: boolean
  connectionLabel: string | null
  connectionError: string | null
}

function SwipeableProviderCard({
  config,
  isActive,
  isReconciled,
  onActivate,
  onEdit,
  onRemove,
  onTestConnection,
  isTesting,
  connectionLabel,
  connectionError,
}: ProviderItemProps) {
  const { t } = useTranslation()

  const translateX = useRef(new Animated.Value(0)).current
  const isOpenRef = useRef(false)

  const kindLabel =
    config.kind === "github"
      ? t("settings.providers.github")
      : t("settings.providers.googleDrive")

  const open = useCallback(() => {
    Animated.spring(translateX, {
      toValue: ACTION_WIDTH,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start()
    isOpenRef.current = true
  }, [translateX])

  const close = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start()
    isOpenRef.current = false
  }, [translateX])

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gs) =>
          Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy) * 2,
        onPanResponderMove: (_, gs) => {
          const base = isOpenRef.current ? ACTION_WIDTH : 0
          const next = Math.max(0, Math.min(ACTION_WIDTH, base + gs.dx))
          translateX.setValue(next)
        },
        onPanResponderRelease: (_, gs) => {
          if (gs.dx > SWIPE_THRESHOLD) {
            open()
          } else if (gs.dx < -SWIPE_THRESHOLD) {
            close()
          } else {
            if (isOpenRef.current) { open() } else { close() }
          }
        },
      }),
    [translateX, open, close]
  )

  const handleAction = useCallback(
    (fn: () => void) => () => {
      close()
      fn()
    },
    [close]
  )

  const [tooltipLabel, setTooltipLabel] = useState<string | null>(null)
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const showTooltip = useCallback((label: string) => {
    setTooltipLabel(label)
    clearTimeout(tooltipTimer.current)
    tooltipTimer.current = setTimeout(() => setTooltipLabel(null), 2000)
  }, [])

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
        l={0}
        t={0}
        b={0}
        items="center"
        gap={UI_SPACE.micro}
        pl={UI_SPACE.control}
        pr={UI_SPACE.control}
        style={{ width: ACTION_WIDTH }}
      >
        <XStack position="relative" items="center" gap={UI_SPACE.micro}>
          {config.kind === "github" && (
            <YStack position="relative">
              <Button
                size="$compact"
                icon={Pencil}
                chromeless
                circular
                onPress={handleAction(() => onEdit(config))}
                onLongPress={() => showTooltip(t("settings.providers.edit"))}
              />
              {tooltipLabel === t("settings.providers.edit") && (
                <YStack
                  position="absolute"
                  b="100%"
                  mb={4}
                  bg="$color"
                  px={6}
                  py={2}
                  rounded={4}
                  style={{ zIndex: 100 }}
                >
                  <Text fontSize="$caption" color="$background" whiteSpace="nowrap">
                    {tooltipLabel}
                  </Text>
                </YStack>
              )}
            </YStack>
          )}
          <YStack position="relative">
            <Button
              size="$compact"
              icon={Play}
              chromeless
              circular
              onPress={handleAction(() => onTestConnection(config))}
              disabled={isTesting}
              onLongPress={() => showTooltip(t("settings.providers.test"))}
            />
            {tooltipLabel === t("settings.providers.test") && (
              <YStack
                position="absolute"
                b="100%"
                mb={4}
                bg="$color"
                px={6}
                py={2}
                rounded={4}
                style={{ zIndex: 100 }}
              >
                <Text fontSize="$caption" color="$background" whiteSpace="nowrap">
                  {tooltipLabel}
                </Text>
              </YStack>
            )}
          </YStack>
          {!isActive && (
            <YStack position="relative">
              <Button
                size="$compact"
                icon={Check}
                chromeless
                circular
                onPress={handleAction(() => onActivate(config.id))}
                onLongPress={() => showTooltip(t("settings.providers.activate"))}
              />
              {tooltipLabel === t("settings.providers.activate") && (
                <YStack
                  position="absolute"
                  b="100%"
                  mb={4}
                  bg="$color"
                  px={6}
                  py={2}
                  rounded={4}
                  style={{ zIndex: 100 }}
                >
                  <Text fontSize="$caption" color="$background" whiteSpace="nowrap">
                    {tooltipLabel}
                  </Text>
                </YStack>
              )}
            </YStack>
          )}
          <YStack position="relative">
            <Button
              size="$compact"
              icon={Trash2}
              chromeless
              circular
              color="white"
              bg={errorColor}
              onPress={handleAction(() => onRemove(config.id))}
              onLongPress={() => showTooltip(t("settings.providers.remove"))}
            />
            {tooltipLabel === t("settings.providers.remove") && (
              <YStack
                position="absolute"
                b="100%"
                mb={4}
                bg="$color"
                px={6}
                py={2}
                rounded={4}
                style={{ zIndex: 100 }}
              >
                <Text fontSize="$caption" color="$background" whiteSpace="nowrap">
                  {tooltipLabel}
                </Text>
              </YStack>
            )}
          </YStack>
        </XStack>
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
              <Text fontWeight={UI_FONT_WEIGHT.medium}>
                {config.label || kindLabel}
              </Text>
              {isActive && (
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
              {!isReconciled && (
                <YStack
                  bg="$yellow9"
                  px={UI_SPACE.micro}
                  py={1}
                  rounded={UI_RADIUS.chip}
                >
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
    let cancelled = false
    loadState().then(() => {
      if (cancelled) return
    })
    return () => {
      cancelled = true
    }
  }, [loadState])

  const handleActivate = useCallback(
    async (id: string) => {
      await providerSettingsStore.setActiveProvider(id)
      await loadState()
      onNotification(t("settings.providers.activated"), "success")
      onProviderMutated?.()
    },
    [loadState, onNotification, onProviderMutated, t]
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
              onProviderMutated?.()
            },
          },
        ]
      )
    },
    [providerState.providers, loadState, onNotification, onProviderMutated, t]
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
        const msg =
          error instanceof SyncProviderErrorClass ? error.message : String(error)
        setConnectionResults((prev) => ({
          ...prev,
          [config.id]: { ok: false, error: msg },
        }))
        onNotification(msg, "error")
      } finally {
        setTestingId(null)
      }
    },
    [onNotification, t]
  )

  const hasProviders = providerState.providers.length > 0

  const existingKinds = new Set(providerState.providers.map((p) => p.kind))

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
            <SwipeableProviderCard
              key={config.id}
              config={config}
              isActive={config.id === providerState.activeProviderId}
              isReconciled={reconciledMap[config.id] ?? false}
              onActivate={handleActivate}
              onEdit={onEditProvider ?? (() => {})}
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

      {/* Add provider buttons — only show for kinds not yet configured */}
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
        {!existingKinds.has("google_drive") && Platform.OS === "android" && (
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
