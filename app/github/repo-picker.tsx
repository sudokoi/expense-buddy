import { useCallback, useEffect, useMemo, useState } from "react"
import { Platform, ViewStyle } from "react-native"
import { useRouter } from "expo-router"
import { YStack, XStack, Text, Input, Button, Spinner } from "tamagui"

import { ScreenContainer } from "../../components/ui/ScreenContainer"
import { secureStorage } from "../../services/secure-storage"

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

const layoutStyles = {
  container: {
    padding: 16,
    maxWidth: 700,
    alignSelf: "center",
    width: "100%",
  } as ViewStyle,
  headerRow: {
    justifyContent: "space-between",
    alignItems: "center",
  } as ViewStyle,
  loadingRow: {
    alignItems: "center",
  } as ViewStyle,
  repoButton: {
    justifyContent: "space-between",
  } as ViewStyle,
  repoButtonInner: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
  } as ViewStyle,
}

function hasWriteAccess(repo: GitHubRepo): boolean {
  return Boolean(
    repo.permissions?.push || repo.permissions?.admin || repo.permissions?.maintain
  )
}

export default function GitHubRepoPickerScreen() {
  const router = useRouter()

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
        setError("Repo picker is not available on web. Use a token and enter owner/repo.")
        setRepos([])
        return
      }

      const token = await secureStorage.getItem(TOKEN_KEY)
      if (!token) {
        setError("Please sign in with GitHub first.")
        setRepos([])
        return
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      }

      const userResponse = await fetch("https://api.github.com/user", { headers })
      if (userResponse.status === 401) {
        setError("Session expired. Please sign in again.")
        setRepos([])
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
  }, [])

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

  return (
    <ScreenContainer>
      <YStack gap="$4" style={layoutStyles.container}>
        <XStack style={layoutStyles.headerRow}>
          <Text fontSize="$7" fontWeight="700">
            Choose a repository
          </Text>
          <Button size="$3" onPress={() => router.back()}>
            Close
          </Button>
        </XStack>

        <Text opacity={0.7}>
          Personal repositories you own (organization repos aren’t supported). Only repos
          with write access are shown.
        </Text>

        {viewerLogin ? <Text opacity={0.7}>Signed in as {viewerLogin}</Text> : null}

        {isLoading ? (
          <XStack gap="$3" style={layoutStyles.loadingRow}>
            <Spinner />
            <Text>Loading repositories…</Text>
          </XStack>
        ) : null}

        {error ? (
          <YStack gap="$2">
            <Text color="$red10">{error}</Text>
            <Button size="$3" onPress={load}>
              Retry
            </Button>
          </YStack>
        ) : null}

        <Input
          placeholder="Search owner/repo"
          value={query}
          onChangeText={setQuery}
          disabled={isLoading || !!error}
        />

        {!isLoading && !error && filtered.length === 0 ? (
          <Text opacity={0.7}>No writable personal repositories found.</Text>
        ) : null}

        <YStack gap="$2">
          {filtered.map((r) => (
            <Button
              key={r.full_name}
              size="$4"
              onPress={() => void handleSelect(r)}
              style={layoutStyles.repoButton}
            >
              <XStack style={layoutStyles.repoButtonInner}>
                <Text>{r.full_name}</Text>
                <Text opacity={0.6}>{r.private ? "Private" : "Public"}</Text>
              </XStack>
            </Button>
          ))}
        </YStack>
      </YStack>
    </ScreenContainer>
  )
}
