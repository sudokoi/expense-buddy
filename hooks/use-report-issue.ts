import { useCallback } from "react"
import { Alert, Linking } from "react-native"
import { useTranslation } from "react-i18next"
import * as Clipboard from "expo-clipboard"
import { getLogsForBugReportAsync } from "../services/logger"
import { APP_CONFIG } from "../constants/app-config"
import { providerSettingsStore } from "../services/sync/provider-settings-store"
import { credentialStore } from "../services/sync/credential-store"
import { useNotifications } from "../stores/hooks"

export function useReportIssue() {
  const { t } = useTranslation()
  const { addNotification } = useNotifications()

  const handleReportIssue = useCallback(() => {
    const openNewIssue = () => {
      Linking.openURL(`${APP_CONFIG.github.url}/issues/new/choose`)
    }
    const openIssue = (issueNumber: number) => {
      Linking.openURL(`${APP_CONFIG.github.url}/issues/${issueNumber}`)
    }

    Alert.alert(
      t("settings.about.includeLogsTitle"),
      t("settings.about.includeLogsMessage"),
      [
        {
          text: t("settings.about.attachLogs"),
          onPress: async () => {
            const appRepo = APP_CONFIG.github.url.replace(/^https?:\/\/github\.com\//, "")

            let githubToken: string | undefined
            try {
              const state = await providerSettingsStore.load()
              const githubProvider = state.providers.find((p) => p.kind === "github")
              if (githubProvider) {
                const entry = await credentialStore.get(githubProvider.credentialId)
                if (entry) {
                  githubToken = entry.data["token"] ?? entry.data["access_token"]
                }
              }
            } catch { /* ignore - token not available */ }

            const logs = await getLogsForBugReportAsync(githubToken ? 500 : 50)

            if (githubToken && logs) {
              try {
                const response = await fetch(
                  `https://api.github.com/repos/${appRepo}/issues`,
                  {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${githubToken}`,
                      Accept: "application/vnd.github+json",
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      title: `[Bug Report] Expense Buddy v${APP_CONFIG.version}`,
                      body: [
                        "## Bug Description",
                        "",
                        "_Please describe the bug here._",
                        "",
                        "## Device Logs",
                        "```",
                        logs,
                        "```",
                      ].join("\n"),
                    }),
                  }
                )
                if (response.ok) {
                  const issue = (await response.json()) as {
                    number: number
                    html_url: string
                  }
                  addNotification(t("settings.about.issueCreated"), "success")
                  openIssue(issue.number)
                  return
                }
            } catch { /* ignore - issue creation failed */ }
            }

            if (logs) {
              await Clipboard.setStringAsync(logs)
              addNotification(t("settings.about.logsCopied"), "info")
            }
            openNewIssue()
          },
        },
        {
          text: t("settings.about.dontAttach"),
          onPress: openNewIssue,
        },
        {
          text: t("common.cancel"),
          style: "cancel",
        },
      ]
    )
  }, [t, addNotification])

  return { handleReportIssue }
}
