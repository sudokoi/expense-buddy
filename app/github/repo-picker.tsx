import { useState, useCallback, useMemo, useEffect } from "react"
import { YStack, Text, Input, Button, ScrollView, Spinner } from "tamagui"
import { useRouter } from "expo-router"
import { Search, GitBranch, Lock, Unlock, Plus } from "@tamagui/lucide-icons"
import { ViewStyle, Alert } from "react-native"
import { ScreenContainer } from "../../components/ui/ScreenContainer"
import { useGitHubAuthMachine } from "../../hooks/use-github-auth-machine"
import { useSettings } from "../../stores/hooks"
import { Octokit } from "@octokit/rest"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

const layoutStyles = {
  repoItem: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  } as ViewStyle,
  searchContainer: {
    marginBottom: 16,
  } as ViewStyle,
}

interface GitHubRepo {
  id: number
  name: string
  full_name: string
  private: boolean
  default_branch: string
  owner: {
    login: string
  }
}

export default function RepoPickerScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const { setSyncConfig } = useSettings()
  const auth = useGitHubAuthMachine()
  const { token } = auth

  const [loading, setLoading] = useState(false)
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const octokit = useMemo(() => {
    if (!token) return null
    return new Octokit({ auth: token })
  }, [token])

  const fetchRepos = useCallback(
    async (pageNum: number, search: string) => {
      if (!octokit) return

      try {
        setLoading(true)
        let results: GitHubRepo[] = []

        if (search.trim()) {
          const response = await octokit.search.repos({
            q: `${search} in:name user:${(await octokit.users.getAuthenticated()).data.login}`,
            per_page: 20,
            page: pageNum,
          })
          results = response.data.items as GitHubRepo[]
        } else {
          const response = await octokit.repos.listForAuthenticatedUser({
            sort: "updated",
            per_page: 20,
            page: pageNum,
            affiliation: "owner",
          })
          results = response.data as GitHubRepo[]
        }

        if (pageNum === 1) {
          setRepos(results)
        } else {
          setRepos((prev) => [...prev, ...results])
        }

        setHasMore(results.length === 20)
      } catch (error) {
        console.error("Failed to fetch repos:", error)
        Alert.alert("Error", t("repoPicker.error"))
      } finally {
        setLoading(false)
      }
    },
    [octokit, t]
  )

  useEffect(() => {
    fetchRepos(1, searchQuery)
  }, [fetchRepos, searchQuery])

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1
      setPage(nextPage)
      fetchRepos(nextPage, searchQuery)
    }
  }

  const handleSelectRepo = (repo: GitHubRepo) => {
    setSyncConfig({
      token,
      repo: repo.full_name,
      branch: repo.default_branch,
    })
    router.back()
  }

  const handleSearch = (text: string) => {
    setSearchQuery(text)
    setPage(1)
  }

  return (
    <ScreenContainer>
      <YStack gap="$4" style={{ paddingBottom: insets.bottom }}>
        <YStack>
          <Text fontSize="$6" fontWeight="bold">
            {t("repoPicker.title")}
          </Text>
          <Text fontSize="$3" color="$color" opacity={0.6}>
            {t("repoPicker.subtitle")}
          </Text>
        </YStack>

        <YStack style={layoutStyles.searchContainer}>
          <Input
            value={searchQuery}
            onChangeText={handleSearch}
            placeholder={t("repoPicker.searchPlaceholder")}
            size="$4"
            icon={Search}
          />
        </YStack>

        <ScrollView showsVerticalScrollIndicator={false}>
          <YStack gap="$2" paddingBottom="$8">
            {repos.map((repo) => (
              <Button
                key={repo.id}
                onPress={() => handleSelectRepo(repo)}
                chromeless
                bordered
                style={layoutStyles.repoItem}
                themeInverse={false}
              >
                <YStack flex={1} gap="$1">
                  <XStack justifyContent="space-between" alignItems="center">
                    <Text fontWeight="bold" fontSize="$4">
                      {repo.name}
                    </Text>
                    {repo.private ? (
                      <Lock size={16} color="$color" opacity={0.6} />
                    ) : (
                      <Unlock size={16} color="$color" opacity={0.6} />
                    )}
                  </XStack>
                  <XStack gap="$2" alignItems="center">
                    <GitBranch size={14} color="$color" opacity={0.6} />
                    <Text fontSize="$2" color="$color" opacity={0.6}>
                      {repo.default_branch}
                    </Text>
                  </XStack>
                </YStack>
              </Button>
            ))}

            {!loading && repos.length === 0 && (
              <YStack padding="$4" alignItems="center">
                <Text color="$color" opacity={0.6}>
                  {t("repoPicker.empty")}
                </Text>
                {searchQuery.length > 0 && (
                  <Button
                    marginTop="$4"
                    icon={Plus}
                    onPress={() => {
                      // Logic to create new repo handled elsewhere?
                      // Or just show alert not implemented
                      Alert.alert("Coming Soon", "Create repo functionality")
                    }}
                  >
                    {t("repoPicker.createPrivate", { name: searchQuery })}
                  </Button>
                )}
              </YStack>
            )}

            {hasMore && (
              <Button
                onPress={handleLoadMore}
                disabled={loading}
                icon={loading ? <Spinner /> : undefined}
              >
                {loading ? t("repoPicker.loading") : t("repoPicker.loadMore")}
              </Button>
            )}
          </YStack>
        </ScrollView>
      </YStack>
    </ScreenContainer>
  )
}
