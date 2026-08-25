import {
  exportExpensesToCsv,
  buildExpenseExportFilename,
  saveExpenseExportToFile,
  downloadExpensesToCsv,
} from "../csv-export"
import { Expense } from "../../types/expense"

const mockShareAsync = jest.fn()
const mockIsAvailable = jest.fn()

jest.mock("expo-sharing", () => ({
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
  isAvailableAsync: () => mockIsAvailable(),
}))

interface MockInstance {
  name: string
  uri: string
  writtenContent: string | null
  exists: boolean
}

jest.mock("expo-file-system", () => {
  class MockFile {
    static instances: MockInstance[]
    static files = new Map<string, MockFile>()
    static failNextWrite = false
    uri: string
    name: string
    writtenContent: string | null
    exists = false

    constructor(_dir: unknown, name: string) {
      const dirStr =
        typeof _dir === "string"
          ? _dir
          : ((_dir as { uri?: string })?.uri ?? "file://cache/")
      this.name = name
      this.uri = `${dirStr}${name}`
      const existing = MockFile.files.get(this.uri)
      if (existing) {
        this.exists = existing.exists
        this.writtenContent = existing.writtenContent
      } else {
        this.exists = false
        this.writtenContent = null
      }
      MockFile.files.set(this.uri, this)
      MockFile.instances.push(this)
    }

    async write(content: string): Promise<void> {
      if (MockFile.failNextWrite) {
        throw new Error("disk full")
      }
      this.writtenContent = content
      this.exists = true
      MockFile.files.set(this.uri, this)
    }

    delete(): void {
      this.exists = false
      MockFile.files.delete(this.uri)
    }
  }

  class MockDirectory {
    static pickShouldCancel = false
    static lastPicked: MockDirectory | null = null
    uri: string

    constructor(uri: unknown, _name?: string) {
      if (typeof uri === "string" && uri.startsWith("file://")) {
        this.uri = uri.endsWith("/") ? uri : `${uri}/`
      } else if (uri && typeof (uri as { uri?: string }).uri === "string") {
        const u = (uri as { uri: string }).uri
        this.uri = u.endsWith("/") ? u : `${u}/`
      } else {
        this.uri = "file://document/"
      }
      MockDirectory.lastPicked = this
    }

    static async pickDirectoryAsync(): Promise<MockDirectory | null> {
      if (MockDirectory.pickShouldCancel) return null
      return new MockDirectory("file://picked/")
    }

    createFile(name: string, _mimeType: string): MockFile {
      return new MockFile(this.uri, name) as unknown as MockFile
    }

    get exists(): boolean {
      return true
    }
  }

  return {
    File: MockFile,
    Directory: MockDirectory,
    Paths: { cache: "file://cache/", document: "file://document/" },
  }
})

// Access the mock class through the mocked module to keep one source of truth
import * as FileSystem from "expo-file-system"
const MockFile = FileSystem.File as unknown as {
  instances: MockInstance[]
  files: Map<string, MockInstance>
  failNextWrite: boolean
  new (
    dir: unknown,
    name: string
  ): MockInstance & { write(content: string): Promise<void>; delete(): void }
}

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: "e1",
    amount: 100,
    currency: "INR",
    category: "Food",
    date: new Date().toISOString(),
    note: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as Expense
}

describe("csv-export", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    MockFile.instances = []
    MockFile.files.clear()
    MockFile.failNextWrite = false
    mockIsAvailable.mockResolvedValue(true)
    mockShareAsync.mockResolvedValue(undefined)
    const FS = FileSystem as unknown as { Directory: { pickShouldCancel: boolean } }
    FS.Directory.pickShouldCancel = false
  })

  describe("buildExpenseExportFilename", () => {
    it("derives a dated filename from an ISO timestamp", () => {
      expect(buildExpenseExportFilename("2026-08-23T10:15:30.000Z")).toBe(
        "expense-buddy-export-2026-08-23.csv"
      )
    })
  })

  describe("exportExpensesToCsv", () => {
    it("writes the full ledger including soft-deleted tombstones", async () => {
      const expenses = [
        makeExpense({ id: "a" }),
        makeExpense({ id: "b", deletedAt: "2026-08-01T00:00:00.000Z" }),
      ]

      const result = await exportExpensesToCsv(expenses)

      expect(result.shared).toBe(true)
      expect(result.file).not.toBeNull()
      expect(result.file?.name).toMatch(/^expense-buddy-export-\d{4}-\d{2}-\d{2}\.csv$/)

      const content = MockFile.instances[0]?.writtenContent ?? ""
      expect(content).toContain("deletedAt")
      expect(content).toContain("2026-08-01T00:00:00.000Z")
      expect(content.split("\n").length).toBe(3) // header + 2 rows
    })

    it("hands the file to the share sheet with csv mime type", async () => {
      const result = await exportExpensesToCsv([makeExpense()])
      const file = MockFile.instances[0]

      expect(mockShareAsync).toHaveBeenCalledWith(file.uri, {
        mimeType: "text/csv",
        dialogTitle: file.name,
      })
      expect(result.shared).toBe(true)
    })

    it("reports unshared when no share target exists but still writes the file", async () => {
      mockIsAvailable.mockResolvedValue(false)

      const result = await exportExpensesToCsv([makeExpense()])

      expect(mockShareAsync).not.toHaveBeenCalled()
      expect(result.shared).toBe(false)
      expect(MockFile.instances[0]?.writtenContent).not.toBeNull()
    })

    it("returns a null file on write failure instead of throwing", async () => {
      MockFile.failNextWrite = true

      const result = await exportExpensesToCsv([makeExpense()])

      expect(result.file).toBeNull()
      expect(result.shared).toBe(false)
    })
  })

  describe("saveExpenseExportToFile", () => {
    it("writes via fallback path when picker unavailable (non-Android)", async () => {
      const result = await saveExpenseExportToFile([makeExpense({ id: "fallback" })])

      expect(result.success).toBe(true)
      expect(result.uri).toMatch(/file:\/\//)
      expect(MockFile.instances[0]?.writtenContent).toContain("fallback")
    })

    it("overwrites existing file idempotently", async () => {
      await saveExpenseExportToFile([makeExpense({ id: "first" })], "same-day.csv")
      const firstInstance = MockFile.instances[0]
      expect(firstInstance.exists).toBe(true)

      const result = await saveExpenseExportToFile(
        [makeExpense({ id: "second" })],
        "same-day.csv"
      )

      expect(result.success).toBe(true)
      expect(MockFile.instances.length).toBe(2)
      expect(MockFile.instances[1].writtenContent).toContain("second")
    })

    it("returns error on write failure", async () => {
      MockFile.failNextWrite = true
      const result = await saveExpenseExportToFile([makeExpense()])
      expect(result.success).toBe(false)
      expect(result.uri).toBeNull()
      expect(result.error).toMatch(/disk full/)
    })
  })

  describe("downloadExpensesToCsv", () => {
    it("returns direct save result when save succeeds", async () => {
      const result = await downloadExpensesToCsv([makeExpense({ id: "direct" })])

      expect(result.success).toBe(true)
      expect(result.uri).toMatch(/file:\/\//)
      expect(mockShareAsync).not.toHaveBeenCalled()
    })

    it("falls back to share sheet when direct save fails but share succeeds", async () => {
      // Force first write (save fallback) to fail, second write (share fallback) to succeed
      let callCount = 0
      const originalWrite = MockFile.prototype.write
      MockFile.prototype.write = async function (this: MockInstance, content: string) {
        callCount++
        if (callCount === 1) throw new Error("disk full")
        return originalWrite.call(this, content)
      }

      const result = await downloadExpensesToCsv([makeExpense()])

      expect(result.success).toBe(true)
      expect(result.fallbackShared).toBe(true)
      expect(mockShareAsync).toHaveBeenCalled()

      MockFile.prototype.write = originalWrite
    })

    it("does not fall back to share when direct save succeeds", async () => {
      // Ensure share is not called when save succeeds (happy path already verifies, but explicit)
      MockFile.failNextWrite = false
      const result = await downloadExpensesToCsv([makeExpense({ id: "no-fallback" })])
      expect(result.success).toBe(true)
      expect(mockShareAsync).not.toHaveBeenCalled()
    })
  })
})
