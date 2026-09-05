package expo.modules.expensebuddywidget

import android.appwidget.AppWidgetManager
import android.content.Context
import android.view.View
import android.widget.RemoteViews

class SummaryWidgetProvider : WidgetProviderBase() {
    internal override val kind = WidgetKind.SUMMARY

    override suspend fun render(
        context: Context,
        manager: AppWidgetManager,
        widgetId: Int,
        snapshot: () -> ExpenseWidgetStore.Snapshot,
    ) {
        val filter = WidgetFilterStore(context, widgetId).load()
        val assist = assistFor(context)
        val copy = assist.toCopy(context)
        val theme = WidgetTheme.resolve(context)
        val categoryStyles =
            WidgetCategoryStyles.parse(
                MmkvAndroidReader(context).getString(WidgetKeys.SETTINGS),
                assist,
            )
        val views = RemoteViews(context.packageName, R.layout.expense_widget_summary)
        theme.applyCard(
            context,
            views,
            R.id.widget_root,
            primaryTextIds = intArrayOf(R.id.widget_today_total),
            mutedTextIds = intArrayOf(R.id.widget_label, R.id.widget_subtitle),
        )
        views.setInt(R.id.widget_add, "setBackgroundResource", theme.addBackground)
        views.setInt(R.id.widget_add, "setColorFilter", theme.color(context, theme.accentForeground))
        views.setContentDescription(R.id.widget_add, copy.addExpense)
        filter.category?.let { category ->
            views.setViewVisibility(R.id.widget_category_dot, View.VISIBLE)
            views.setInt(
                R.id.widget_category_dot,
                "setColorFilter",
                categoryStyles.color(category, theme.color(context, theme.accent)),
            )
            views.setTextViewText(R.id.widget_label, "${copy.today} · ${copy.displayCategory(category)}")
        } ?: run {
            views.setViewVisibility(R.id.widget_category_dot, View.GONE)
            views.setTextViewText(R.id.widget_label, copy.today)
        }
        views.setOnClickPendingIntent(
            R.id.widget_root,
            WidgetIntents.openApp(context, "", widgetId),
        )
        views.setOnClickPendingIntent(
            R.id.widget_add,
            WidgetIntents.openApp(context, "add", widgetId + ADD_OFFSET),
        )

        when (
            val result =
                store(context).read(
                    snapshot = snapshot(),
                    filter = filter,
                    assistCurrency = assist?.currency,
                    assistVersion = assist?.dataVersion,
                )
        ) {
            is WidgetResult.Ready -> {
                val data = result.data
                val today = WidgetFormat.maskedAmount(data.todayTotal, data.currency, filter.hideAmounts)
                val month = WidgetFormat.maskedAmount(data.monthTotal, data.currency, filter.hideAmounts)
                views.setTextViewText(R.id.widget_today_total, today)
                views.setTextViewText(
                    R.id.widget_subtitle,
                    "${copy.expensesToday(data.todayCount)} · ${copy.monthTotal(month)}",
                )
                manager.updateAppWidget(widgetId, views)
            }
            WidgetResult.Empty -> {
                val currency = displayCurrency(context)
                views.setTextViewText(
                    R.id.widget_today_total,
                    WidgetFormat.maskedAmount(0.0, currency, filter.hideAmounts),
                )
                views.setTextViewText(R.id.widget_subtitle, copy.empty)
                manager.updateAppWidget(widgetId, views)
            }
            WidgetResult.Unavailable -> {
                // Leave existing content; storage may appear on next update.
            }
        }
    }

    private companion object {
        const val ADD_OFFSET = 1_000_000
    }
}
