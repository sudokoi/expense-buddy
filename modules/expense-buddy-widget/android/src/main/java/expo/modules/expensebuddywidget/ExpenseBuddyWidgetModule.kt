package expo.modules.expensebuddywidget

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpenseBuddyWidgetModule : Module() {
    override fun definition() =
        ModuleDefinition {
            Name("ExpenseBuddyWidget")

            AsyncFunction("refreshWidgets") {
                val ctx = appContext.reactContext?.applicationContext ?: return@AsyncFunction
                WidgetRefresh.broadcastAll(ctx)
            }

            AsyncFunction("persistAssist") { assistJson: String ->
                val ctx = appContext.reactContext?.applicationContext ?: return@AsyncFunction
                WidgetAssistStore(ctx).save(assistJson)
            }
        }
}
