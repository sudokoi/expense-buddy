import { moveCategory } from "./category-order"

describe("moveCategory", () => {
  const labels = ["Food", "Travel", "Rent", "Other"]
  it("moves in either direction without modifying the source", () => {
    expect(moveCategory(labels, "Travel", -1)).toEqual([
      "Travel",
      "Food",
      "Rent",
      "Other",
    ])
    expect(moveCategory(labels, "Travel", 1)).toEqual(["Food", "Rent", "Travel", "Other"])
    expect(labels).toEqual(["Food", "Travel", "Rent", "Other"])
  })
  it.each([
    ["Food", -1],
    ["Rent", 1],
    ["Other", -1],
    ["missing", 1],
  ] as const)("ignores boundary or unavailable moves for %s", (label, direction) => {
    expect(moveCategory(labels, label, direction)).toEqual(labels)
  })
  it("supports empty lists and lists without a fallback", () => {
    expect(moveCategory([], "Food", 1)).toEqual([])
    expect(moveCategory(["Food", "Travel"], "Food", 1)).toEqual(["Travel", "Food"])
  })
})
