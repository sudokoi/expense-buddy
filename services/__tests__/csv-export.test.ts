import { exportExpensesToCsv, buildExpenseExportFilename } from "../csv-export"
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
}

jest.mock("expo-file-system", () => {
  class MockFile {
    static instances: MockInstance[]
    static failNextWrite = false
    uri: string
    name: string
    writtenContent: string | null

    constructor(_dir: unknown, name: string) {
      this.name = name
      this.uri = `file://cache/${name}`
      this.writtenContent = null
      MockFile.instances.push(this)
    }

    async write(content: string): Promise<void> {
      if (MockFile.failNextWrite) {
        throw new Error("disk full")
      }
      this.writtenContent = content
    }
  }

  return {
    File: MockFile,
    Paths: { cache: "file://cache/" },
  }
})

// Access the mock class through the mocked module to keep one source of truth
import * as FileSystem from "expo-file-system"
const MockFile = FileSystem.File as unknown as {
  instances: MockInstance[]
  failNextWrite: boolean
  new (
    dir: unknown,
    name: string
  ): MockInstance & { write(content: string): Promise<void> }
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
    MockFile.failNextWrite = false
    mockIsAvailable.mockResolvedValue(true)
    mockShareAsync.mockResolvedValue(undefined)
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
})
