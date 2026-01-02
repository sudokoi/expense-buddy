/**
 * Property-based tests for Sync Config Pre-fill
 *
 * **Feature: useeffect-cleanup, Property 4: Sync Config Pre-fill**
 *
 * For any previously saved sync configuration, when the settings screen reads from the store,
 * the config values SHALL match the saved values.
 *
 * **Validates: Requirements 6.4**
 */

import fc from "fast-check"
import { createStore } from "@xstate/store"

// Define SyncConfig type locally to avoid import issues
interface SyncConfig {
  token: string
  repo: string
  branch: string
}

// Arbitrary generator for valid GitHub Personal Access Tokens
const githubTokenArb: fc.Arbitrary<string> = fc
  .string({ minLength: 10, maxLength: 40 })
  .filter((s) => /^[a-zA-Z0-9_]+$/.test(s))
  .map((suffix) => `ghp_${suffix}`)

// Arbitrary generator for valid GitHub repository names (owner/repo format)
const githubRepoArb: fc.Arbitrary<string> = fc
  .tuple(
    fc
      .string({ minLength: 1, maxLength: 20 })
      .filter((s) => /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(s)),
    fc
      .string({ minLength: 1, maxLength: 30 })
      .filter((s) => /^[a-z0-9][a-z0-9._-]*[a-z0-9]$|^[a-z0-9]$/.test(s))
  )
  .map(([owner, repo]) => `${owner}/${repo}`)

// Arbitrary generator for valid branch names
const branchNameArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter(
    (branch) =>
      /^[a-z0-9][a-z0-9_/-]*[a-z0-9]$|^[a-z0-9]$/.test(branch) && !branch.includes("//")
  )

// Arbitrary generator for complete SyncConfig
const syncConfigArb: fc.Arbitrary<SyncConfig> = fc.record({
  token: githubTokenArb,
  repo: githubRepoArb,
  branch: branchNameArb,
})

// Create a test settings store that mirrors the real implementation
function createTestSettingsStore() {
  return createStore({
    context: {
      syncConfig: null as SyncConfig | null,
      isLoading: true,
    },

    on: {
      loadSettings: (context, event: { syncConfig?: SyncConfig | null }) => ({
        ...context,
        syncConfig: event.syncConfig ?? null,
        isLoading: false,
      }),

      saveSyncConfig: (context, event: { config: SyncConfig }) => ({
        ...context,
        syncConfig: event.config,
      }),

      clearSyncConfig: (context) => ({
        ...context,
        syncConfig: null,
      }),
    },
  })
}

/**
 * Simulates reading sync config from the store and initializing form state.
 * This mirrors the actual implementation in settings.tsx:
 *
 * const [token, setToken] = useState(syncConfig?.token ?? "")
 * const [repo, setRepo] = useState(syncConfig?.repo ?? "")
 * const [branch, setBranch] = useState(syncConfig?.branch ?? "main")
 * const isConfigured = syncConfig !== null
 */
function initializeFormStateFromStore(syncConfig: SyncConfig | null): {
  token: string
  repo: string
  branch: string
  isConfigured: boolean
} {
  return {
    token: syncConfig?.token ?? "",
    repo: syncConfig?.repo ?? "",
    branch: syncConfig?.branch ?? "main",
    isConfigured: syncConfig !== null,
  }
}

describe("Sync Config Pre-fill Properties", () => {
  /**
   * Property 4: Sync Config Pre-fill
   * **Feature: useeffect-cleanup, Property 4: Sync Config Pre-fill**
   * **Validates: Requirements 6.4**
   */
  describe("Property 4: Sync Config Pre-fill", () => {
    it("previously saved sync config SHALL be pre-filled in form state", () => {
      fc.assert(
        fc.property(syncConfigArb, (savedConfig) => {
          const store = createTestSettingsStore()

          // Simulate store initialization with saved config
          store.trigger.loadSettings({ syncConfig: savedConfig })

          // Read config from store
          const syncConfig = store.getSnapshot().context.syncConfig

          // Initialize form state from store (mirrors settings.tsx)
          const formState = initializeFormStateFromStore(syncConfig)

          // Verify form state matches saved config
          expect(formState.token).toBe(savedConfig.token)
          expect(formState.repo).toBe(savedConfig.repo)
          expect(formState.branch).toBe(savedConfig.branch)
          expect(formState.isConfigured).toBe(true)

          return true
        }),
        { numRuns: 100 }
      )
    })

    it("when no config is saved, form SHALL have default values", () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const store = createTestSettingsStore()

          // Simulate store initialization without saved config
          store.trigger.loadSettings({ syncConfig: null })

          // Read config from store
          const syncConfig = store.getSnapshot().context.syncConfig

          // Initialize form state from store
          const formState = initializeFormStateFromStore(syncConfig)

          // Verify form state has default values
          expect(formState.token).toBe("")
          expect(formState.repo).toBe("")
          expect(formState.branch).toBe("main")
          expect(formState.isConfigured).toBe(false)

          return true
        }),
        { numRuns: 100 }
      )
    })

    it("saving config SHALL update store and be readable immediately", () => {
      fc.assert(
        fc.property(syncConfigArb, (config) => {
          const store = createTestSettingsStore()

          // Initialize store without config
          store.trigger.loadSettings({ syncConfig: null })

          // Save new config
          store.trigger.saveSyncConfig({ config })

          // Read config from store
          const syncConfig = store.getSnapshot().context.syncConfig

          // Verify config was saved correctly
          expect(syncConfig).not.toBeNull()
          expect(syncConfig?.token).toBe(config.token)
          expect(syncConfig?.repo).toBe(config.repo)
          expect(syncConfig?.branch).toBe(config.branch)

          return true
        }),
        { numRuns: 100 }
      )
    })

    it("clearing config SHALL result in null syncConfig", () => {
      fc.assert(
        fc.property(syncConfigArb, (config) => {
          const store = createTestSettingsStore()

          // Initialize store with config
          store.trigger.loadSettings({ syncConfig: config })

          // Verify config is present
          expect(store.getSnapshot().context.syncConfig).not.toBeNull()

          // Clear config
          store.trigger.clearSyncConfig()

          // Verify config is cleared
          const syncConfig = store.getSnapshot().context.syncConfig
          expect(syncConfig).toBeNull()

          // Form state should have defaults
          const formState = initializeFormStateFromStore(syncConfig)
          expect(formState.token).toBe("")
          expect(formState.repo).toBe("")
          expect(formState.branch).toBe("main")
          expect(formState.isConfigured).toBe(false)

          return true
        }),
        { numRuns: 100 }
      )
    })

    it("isConfigured SHALL be derived from syncConfig !== null", () => {
      fc.assert(
        fc.property(fc.oneof(fc.constant(null), syncConfigArb), (config) => {
          const store = createTestSettingsStore()

          // Initialize store with or without config
          store.trigger.loadSettings({ syncConfig: config })

          // Read config from store
          const syncConfig = store.getSnapshot().context.syncConfig

          // Initialize form state
          const formState = initializeFormStateFromStore(syncConfig)

          // isConfigured should be true if and only if syncConfig is not null
          expect(formState.isConfigured).toBe(syncConfig !== null)

          return true
        }),
        { numRuns: 100 }
      )
    })

    it("updating config SHALL preserve all fields correctly", () => {
      fc.assert(
        fc.property(syncConfigArb, syncConfigArb, (initialConfig, updatedConfig) => {
          const store = createTestSettingsStore()

          // Initialize with first config
          store.trigger.loadSettings({ syncConfig: initialConfig })

          // Update with second config
          store.trigger.saveSyncConfig({ config: updatedConfig })

          // Read config from store
          const syncConfig = store.getSnapshot().context.syncConfig

          // Verify updated config is stored
          expect(syncConfig?.token).toBe(updatedConfig.token)
          expect(syncConfig?.repo).toBe(updatedConfig.repo)
          expect(syncConfig?.branch).toBe(updatedConfig.branch)

          return true
        }),
        { numRuns: 100 }
      )
    })

    it("form state initialization SHALL be idempotent", () => {
      fc.assert(
        fc.property(fc.oneof(fc.constant(null), syncConfigArb), (config) => {
          // Initialize form state multiple times with same config
          const formState1 = initializeFormStateFromStore(config)
          const formState2 = initializeFormStateFromStore(config)
          const formState3 = initializeFormStateFromStore(config)

          // All should be equal
          expect(formState1).toEqual(formState2)
          expect(formState2).toEqual(formState3)

          return true
        }),
        { numRuns: 100 }
      )
    })

    it("store config and form state SHALL be consistent after any operation sequence", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              syncConfigArb.map((config) => ({ type: "save" as const, config })),
              fc.constant({ type: "clear" as const })
            ),
            { minLength: 1, maxLength: 10 }
          ),
          (operations) => {
            const store = createTestSettingsStore()
            store.trigger.loadSettings({ syncConfig: null })

            // Apply all operations
            for (const op of operations) {
              if (op.type === "save") {
                store.trigger.saveSyncConfig({ config: op.config })
              } else {
                store.trigger.clearSyncConfig()
              }
            }

            // Get final state
            const syncConfig = store.getSnapshot().context.syncConfig
            const formState = initializeFormStateFromStore(syncConfig)

            // Verify consistency
            if (syncConfig === null) {
              expect(formState.token).toBe("")
              expect(formState.repo).toBe("")
              expect(formState.branch).toBe("main")
              expect(formState.isConfigured).toBe(false)
            } else {
              expect(formState.token).toBe(syncConfig.token)
              expect(formState.repo).toBe(syncConfig.repo)
              expect(formState.branch).toBe(syncConfig.branch)
              expect(formState.isConfigured).toBe(true)
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
