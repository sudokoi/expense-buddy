package expo.modules.expensebuddywidget

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpenseBuddyWidgetModule : Module() {
    override fun definition() =
        ModuleDefinition {
            Name("ExpenseBuddyWidget")

            AsyncFunction("refreshWidgets") {
                val ctx = appContext.reactContext?.applicationContext ?: return@AsyncFunction null
                WidgetRefresh.broadcastAll(ctx)
            }

            AsyncFunction("persistAssist") { assistJson: String ->
                val ctx = appContext.reactContext?.applicationContext ?: return@AsyncFunction null
                WidgetAssistStore(ctx).save(assistJson)
            }
        }
}
