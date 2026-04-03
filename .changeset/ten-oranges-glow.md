---
"expense-buddy": minor
---

Add a configurable math-entry mode for expense amounts and reorganize the settings screen.

- Add a persisted `enableMathExpressions` setting that lets amount fields switch between expression parsing and numeric keypad entry.
- Apply the amount-entry mode across add, history edit, and analytics amount range inputs, with validation updated to match the selected mode.
- Reorganize settings into clearer groups, moving payment management together and refining the general, GitHub sync, localization, and app info sections.
- Add locale strings and test coverage for the new settings schema and amount-input behavior.
