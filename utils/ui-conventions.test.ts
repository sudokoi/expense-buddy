import fs from "node:fs"
import path from "node:path"
import ts from "typescript"

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory()
      ? sourceFiles(file)
      : /\.(ts|tsx)$/.test(file)
        ? [file]
        : []
  })
}

const files = ["app", "components", "hooks", "providers"]
  .flatMap((directory) => sourceFiles(path.join(__dirname, "..", directory)))
  .filter((file) => !/\.test\./.test(file))

/** Guard the two regressions at their source: native alerts and unthemed button text. */
it("uses themed app confirmations and explicitly themed custom Button text", () => {
  const violations: string[] = []
  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true
    )
    const report = (node: ts.Node, message: string) => {
      violations.push(
        `${path.relative(path.join(__dirname, ".."), file)}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}: ${message}`
      )
    }
    const visit = (node: ts.Node, inButton = false) => {
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        node.moduleSpecifier.text === "react-native"
      ) {
        const bindings = node.importClause?.namedBindings
        if (bindings && ts.isNamedImports(bindings)) {
          for (const item of bindings.elements) {
            if ((item.propertyName ?? item.name).text === "Alert")
              report(item, "Use useAppDialog, not Alert")
          }
        }
      }
      if (ts.isJsxElement(node)) {
        const opening = node.openingElement
        if (opening.tagName.getText(source) === "Button") inButton = true
        if (inButton && opening.tagName.getText(source) === "Text") {
          const themed = opening.attributes.properties.some(
            (attribute) =>
              ts.isJsxAttribute(attribute) &&
              ["className", "style"].includes(attribute.name.getText(source))
          )
          if (!themed) report(node, "Use Button.Text or explicit theme styling")
        }
      }
      if (ts.isJsxText(node) && /[A-Za-z]/.test(node.text)) {
        report(node, "Move visible copy into a locale key")
      }
      if (ts.isJsxAttribute(node)) {
        const name = node.name.getText(source)
        const value = node.initializer
        const expression =
          value && ts.isJsxExpression(value) ? value.expression : undefined
        if (name === "size" && expression && ts.isNumericLiteral(expression)) {
          // Documented optical adjustment inside the decorative SettingsSection badge.
          if (!(file.endsWith("/SettingsSection.tsx") && expression.text === "22")) {
            report(node, "Use UI_ICON_SIZE for icon sizes")
          }
        }
        if (
          [
            "accessibilityLabel",
            "accessibilityHint",
            "title",
            "label",
            "placeholder",
          ].includes(name)
        ) {
          if (
            value &&
            ts.isStringLiteral(value) &&
            /[A-Za-z]/.test(value.text) &&
            value.text !== "main"
          ) {
            report(node, "Use a locale key for UI copy (main is a Git branch identifier)")
          }
          if (
            expression &&
            ts.isTemplateExpression(expression) &&
            /[A-Za-z]/.test(
              expression.head.text +
                expression.templateSpans.map((span) => span.literal.text).join("")
            )
          ) {
            report(node, "Move English template copy into a locale key")
          }
        }
      }
      ts.forEachChild(node, (child) => visit(child, inButton))
    }
    visit(source)
  }
  expect(violations).toEqual([])
})
