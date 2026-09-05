package expo.modules.expensebuddywidget

import android.appwidget.AppWidgetManager
import android.content.Context
import android.widget.RemoteViews

class TrendWidgetProvider : WidgetProviderBase() {
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
        val views = RemoteViews(context.packageName, R.layout.expense_widget_trend)
        theme.applyCard(
            context,
            views,
            R.id.widget_root,
            primaryTextIds = intArrayOf(R.id.widget_total),
            mutedTextIds = intArrayOf(R.id.widget_label),
        )
        // Home tab hosts the Analytics screen, so the chart deep-links there.
        views.setOnClickPendingIntent(
            R.id.widget_root,
            WidgetIntents.openApp(context, "", widgetId),
        )
        views.setTextViewText(R.id.widget_label, copy.last7Days)

        when (
            val result =
                store(context).read(
                    snapshot = snapshot(),
                    recentLimit = 0,
                    filter = filter,
                    assistCurrency = assist?.currency,
                    assistVersion = assist?.dataVersion,
                )
        ) {
            is WidgetResult.Ready -> {
                val data = result.data
                val total =
                    WidgetFormat.maskedAmount(
                        data.last7Days.sumOf { it.total },
                        data.currency,
                        filter.hideAmounts,
                    )
                views.setTextViewText(R.id.widget_total, total)
                views.setImageViewBitmap(
                    R.id.widget_chart,
                    TrendChartRenderer.render(
                        context,
                        data.last7Days,
                        manager.getAppWidgetOptions(widgetId),
                        theme,
                        categoryStyles,
                        assist?.locale?.let(java.util.Locale::forLanguageTag)
                            ?: java.util.Locale.getDefault(),
                    ),
                )
                views.setContentDescription(R.id.widget_chart, copy.trendDescription(total))
                manager.updateAppWidget(widgetId, views)
            }
            WidgetResult.Empty -> {
                val amount =
                    WidgetFormat.maskedAmount(
                        0.0,
                        displayCurrency(context),
                        filter.hideAmounts,
                    )
                views.setTextViewText(
                    R.id.widget_total,
                    amount,
                )
                views.setImageViewResource(R.id.widget_chart, 0)
                views.setContentDescription(R.id.widget_chart, copy.trendDescription(amount))
                manager.updateAppWidget(widgetId, views)
            }
            WidgetResult.Unavailable -> {
                // Leave existing content; storage may appear on next update.
            }
        }
    }
}
