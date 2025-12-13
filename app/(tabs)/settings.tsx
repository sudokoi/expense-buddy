import React, { useState, useEffect } from 'react'
import {
  YStack,
  XStack,
  Text,
  Input,
  Button,
  H4,
  Label,
  ScrollView,
  useTheme,
  Card,
} from 'tamagui'
import { Alert } from 'react-native'
import { Check, X, Settings as SettingsIcon } from '@tamagui/lucide-icons'
import {
  saveSyncConfig,
  loadSyncConfig,
  clearSyncConfig,
  testConnection,
  syncUp,
  syncDown,
  SyncConfig,
} from '../../services/sync-manager'
import { useExpenses } from '../../context/ExpenseContext'

export default function SettingsScreen() {
  const theme = useTheme()
  const { state } = useExpenses()

  const [token, setToken] = useState('')
  const [repo, setRepo] = useState('')
  const [branch, setBranch] = useState('main')
  const [isTesting, setIsTesting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle')

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    const config = await loadSyncConfig()
    if (config) {
      setToken(config.token)
      setRepo(config.repo)
      setBranch(config.branch)
    }
  }

  const handleSaveConfig = async () => {
    if (!token || !repo || !branch) {
      Alert.alert('Missing Information', 'Please fill in all fields')
      return
    }

    const config: SyncConfig = { token, repo, branch }
    await saveSyncConfig(config)
    Alert.alert('Success', 'Sync configuration saved')
  }

  const handleTestConnection = async () => {
    setIsTesting(true)
    setConnectionStatus('idle')

    const result = await testConnection()

    setIsTesting(false)
    if (result.success) {
      setConnectionStatus('success')
      Alert.alert('Success', result.message)
    } else {
      setConnectionStatus('error')
      Alert.alert('Error', result.error || result.message)
    }
  }

  const handleSyncUp = async () => {
    setIsSyncing(true)
    const result = await syncUp(state.expenses)
    setIsSyncing(false)

    if (result.success) {
      Alert.alert('Success', result.message)
    } else {
      Alert.alert('Error', result.error || result.message)
    }
  }

  const handleSyncDown = async () => {
    Alert.alert(
      'Confirm Download',
      'This will replace your local data with data from GitHub. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Download',
          style: 'destructive',
          onPress: async () => {
            setIsSyncing(true)
            const result = await syncDown()
            setIsSyncing(false)

            if (result.success && result.expenses) {
              // TODO: Update context with downloaded expenses
              Alert.alert('Success', result.message + '\nPlease reload the app to see changes.')
            } else {
              Alert.alert('Error', result.error || result.message)
            }
          },
        },
      ]
    )
  }

  const handleClearConfig = async () => {
    Alert.alert('Confirm Clear', 'Remove sync configuration?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await clearSyncConfig()
          setToken('')
          setRepo('')
          setBranch('main')
          setConnectionStatus('idle')
          Alert.alert('Success', 'Configuration cleared')
        },
      },
    ])
  }

  return (
    <ScrollView
      flex={1}
      style={{ backgroundColor: theme.background.val as string }}
      contentContainerStyle={{ padding: 20 } as any}
    >
      <YStack space="$4" style={{ maxWidth: 600, alignSelf: 'center', width: '100%' }}>
        <H4 style={{ marginBottom: 8 }}>GitHub Sync Settings</H4>

        <Text style={{ color: (theme.gray10?.val as string) || 'gray', marginBottom: 16 }}>
          Sync your expenses to a GitHub repository using a Personal Access Token.
        </Text>

        {/* GitHub PAT */}
        <YStack space="$2">
          <Label>GitHub Personal Access Token</Label>
          <Input
            secureTextEntry
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            value={token}
            onChangeText={setToken}
            size="$4"
            borderWidth={2}
            borderColor="$borderColor"
          />
          <Text style={{ fontSize: 12, color: (theme.gray9?.val as string) || 'gray' }}>
            Create a fine-grained PAT with Contents (read/write) permission
          </Text>
        </YStack>

        {/* Repository */}
        <YStack space="$2">
          <Label>Repository</Label>
          <Input
            placeholder="username/repo-name"
            value={repo}
            onChangeText={setRepo}
            size="$4"
            borderWidth={2}
            borderColor="$borderColor"
          />
        </YStack>

        {/* Branch */}
        <YStack space="$2">
          <Label>Branch</Label>
          <Input
            placeholder="main"
            value={branch}
            onChangeText={setBranch}
            size="$4"
            borderWidth={2}
            borderColor="$borderColor"
          />
        </YStack>

        {/* Action Buttons */}
        <XStack style={{ gap: 12, flexWrap: 'wrap' }}>
          <Button
            flex={1}
            style={{ minWidth: "45%" }}
            size="$4"
            onPress={handleSaveConfig}
            themeInverse
          >
            Save Configuration
          </Button>
          <Button
            flex={1}
            style={{
              minWidth: "45%",
              backgroundColor: connectionStatus === 'success'
                ? '#22c55e'  // Bright green
                : connectionStatus === 'error'
                  ? '#ef4444'  // Bright red
                  : '#3b82f6'  // Default blue
            }}
            size="$4"
            onPress={handleTestConnection}
            disabled={isTesting || !token || !repo}
            icon={connectionStatus === 'success' ? Check : connectionStatus === 'error' ? X : undefined}
            color={connectionStatus === 'idle' ? undefined : 'white'}
          >
            {isTesting ? 'Testing...' : 'Test Connection'}
          </Button>
        </XStack>

        {/* Sync Actions */}
        <Card bordered style={{ padding: 16, marginTop: 16 }}>
          <H4 style={{ marginBottom: 12, fontSize: 16 }}>Manual Sync</H4>

          <YStack space="$3">
            <Button
              size="$4"
              onPress={handleSyncUp}
              disabled={isSyncing || !token || !repo}
            >
              {isSyncing ? 'Syncing...' : `Upload to GitHub (${state.expenses.length} expenses)`}
            </Button>

            <Button
              size="$4"
              onPress={handleSyncDown}
              disabled={isSyncing || !token || !repo}
            >
              Download from GitHub
            </Button>
          </YStack>
        </Card>

        {/* Clear Config */}
        <Button
          size="$3"
          chromeless
          color="$red10"
          onPress={handleClearConfig}
          style={{ marginTop: 16 }}
        >
          Clear Configuration
        </Button>
      </YStack>
    </ScrollView>
  )
}
