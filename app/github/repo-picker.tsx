import { useCallback, useEffect, useMemo, useState } from "react"
import { Platform, Text, View } from "react-native"
import { FlashList } from "@shopify/flash-list"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { secureStorage } from "../../services/secure-storage"
import { useTranslation } from "react-i18next"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { Spinner } from "../../components/ui/Spinner"
import { UI_SPACE } from "../../constants/ui-tokens"

type GitHubUser = { login: string }

type GitHubRepo = {
  full_name: string
  name: string
  private: boolean
  default_branch?: string
  owner?: { login?: string }
  permissions?: {
    admin?: boolean
    maintain?: boolean
    push?: boolean
  }
}

const TOKEN_KEY = "github_pat"
const REPO_KEY = "github_repo"
const BRANCH_KEY = "github_branch"

function hasWriteAccess(repo: GitHubRepo): boolean {
  return Boolean(
    repo.permissions?.push || repo.permissions?.admin || repo.permissions?.maintain
  )
}

export default function GitHubRepoPickerScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewerLogin, setViewerLogin] = useState<string | null>(null)
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return repos
    return repos.filter((r) => r.full_name.toLowerCase().includes(q))
  }, [repos, query])

  const load = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      if (Platform.OS === "web") {
        setError(
          t("repoPicker.webAuthError") ||
            "Repo picker is not available on web. Use a token and enter owner/repo."
        )
        setRepos([])
        return
      }

      const token = await secureStorage.getItem(TOKEN_KEY)
      if (!token) {
        setError(t("settings.github.signIn") + " " + t("common.required"))
        setRepos([])
        return
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      }

      const handleAuthFailure = async (status: 401 | 403, message: string) => {
        const lower = message.toLowerCase()
        const isRateLimit = lower.includes("rate limit")

        if (status === 401) {
          setError(
            t("repoPicker.sessionExpired") ||
              "Your GitHub session is no longer valid. Please sign in again."
          )
        } else if (isRateLimit) {
          setError(
            t("repoPicker.rateLimit") ||
              "GitHub rate limit reached. Please wait a bit and try again."
          )
        } else {
          setError(t("repoPicker.accessDenied") || "GitHub denied access (403).")
        }

        // Force re-login by clearing saved credentials/config.
        await Promise.all([
          secureStorage.deleteItem(TOKEN_KEY),
          secureStorage.deleteItem(REPO_KEY),
          secureStorage.deleteItem(BRANCH_KEY),
        ])

        setRepos([])
      }

      const userResponse = await fetch("https://api.github.com/user", { headers })
      if (userResponse.status === 401 || userResponse.status === 403) {
        const data = await userResponse.json().catch(() => ({}))
        await handleAuthFailure(
          userResponse.status as 401 | 403,
          String((data as any).message || userResponse.statusText)
        )
        return
      }
      if (!userResponse.ok) {
        const data = await userResponse.json().catch(() => ({}))
        setError(
          `GitHub error (${userResponse.status}): ${data.message || userResponse.statusText}`
        )
        setRepos([])
        return
      }

      const user = (await userResponse.json()) as GitHubUser
      setViewerLogin(user.login)

      const collected: GitHubRepo[] = []
      const perPage = 100

      for (let page = 1; page <= 5; page++) {
        const url = `https://api.github.com/user/repos?affiliation=owner&per_page=${perPage}&page=${page}&sort=updated`
        const resp = await fetch(url, { headers })
        if (resp.status === 401 || resp.status === 403) {
          const data = await resp.json().catch(() => ({}))
          await handleAuthFailure(
            resp.status as 401 | 403,
            String((data as any).message || resp.statusText)
          )
          break
        }
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}))
          setError(`GitHub error (${resp.status}): ${data.message || resp.statusText}`)
          break
        }

        const items = (await resp.json()) as GitHubRepo[]
        collected.push(...items)

        if (items.length < perPage) break
      }

      // Personal-only: owned by the authenticated user (no org repos)
      const personal = collected.filter(
        (r) => String(r.owner?.login || "").toLowerCase() === user.login.toLowerCase()
      )

      // Must have push/write access
      const writable = personal.filter(hasWriteAccess)

      // Stable sort: private first, then alphabetical
      writable.sort((a, b) => {
        if (a.private !== b.private) return a.private ? -1 : 1
        return a.full_name.localeCompare(b.full_name)
      })

      setRepos(writable)
    } catch (e) {
      setError(String(e))
      setRepos([])
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const handleSelect = useCallback(
    async (repo: GitHubRepo) => {
      await secureStorage.setItem(REPO_KEY, repo.full_name)

      // Only set branch if not already set
      const existingBranch = await secureStorage.getItem(BRANCH_KEY)
      if (!existingBranch && repo.default_branch) {
        await secureStorage.setItem(BRANCH_KEY, repo.default_branch)
      }

      router.back()
    },
    [router]
  )

  const keyExtractor = useCallback((item: GitHubRepo) => item.full_name, [])

  const renderItem = useCallback(
    ({ item }: { item: GitHubRepo }) => (
      <Button
        size="control"
        variant="outline"
        className="mb-2 justify-between"
        onPress={() => void handleSelect(item)}
      >
        <Text numberOfLines={1}>{item.full_name}</Text>
        <Text className="text-xs text-foreground opacity-60">
          {item.private ? "Private" : "Public"}
        </Text>
      </Button>
    ),
    [handleSelect]
  )

  return (
    <View className="flex-1 bg-background">
      <View
        className="px-4 pb-4 gap-4 bg-background"
        style={{ paddingTop: insets.top }}
      >
        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-bold text-foreground">
            {t("repoPicker.title")}
          </Text>
          <Button size="chip" className="px-2" variant="ghost" onPress={() => router.back()}>
            {t("common.cancel")}
          </Button>
        </View>

        <Text className="text-foreground opacity-70">{t("repoPicker.subtitle")}</Text>

        {viewerLogin ? (
          <Text className="text-foreground opacity-70">
            Signed in as {viewerLogin}
          </Text>
        ) : null}

        {isLoading ? (
          <View className="flex-row items-center gap-3">
            <Spinner />
            <Text className="text-foreground">{t("repoPicker.loading")}</Text>
          </View>
        ) : null}

        {error ? (
          <View className="gap-2">
            <Text className="text-error">{error}</Text>
            <Button size="chip" className="px-2" onPress={load}>
              {t("common.save")}
            </Button>
          </View>
        ) : null}

        <Input
          placeholder={t("repoPicker.searchPlaceholder")}
          value={query}
          onChangeText={setQuery}
          editable={!isLoading && !error}
        />
      </View>

      <FlashList
        data={!isLoading && !error ? filtered : []}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingBottom: insets.bottom,
          paddingHorizontal: UI_SPACE.gutter,
          maxWidth: 17.5 * UI_SPACE.empty,
          alignSelf: "center",
          width: "100%",
        }}
        ItemSeparatorComponent={() => <View style={{ height: UI_SPACE.control }} />}
        ListEmptyComponent={
          !isLoading && !error ? (
            <Text className="text-foreground opacity-70">{t("repoPicker.empty")}</Text>
          ) : null
        }
      />
    </View>
  )
}
