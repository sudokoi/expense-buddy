const { withAndroidManifest } = require("expo/config-plugins")

const WIDGET_PACKAGE = "expo.modules.expensebuddywidget"

const PROVIDERS = [
  { name: "SummaryWidgetProvider", xml: "@xml/expense_widget_summary_info" },
  { name: "TrendWidgetProvider", xml: "@xml/expense_widget_trend_info" },
  { name: "RecentWidgetProvider", xml: "@xml/expense_widget_recent_info" },
]

function withExpenseWidgets(config) {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest

    if (!Array.isArray(manifest.application)) {
      manifest.application = [manifest.application]
    }

    const app = manifest.application[0]
    app.receiver = app.receiver || []
    app.service = app.service || []

    for (const { name, xml } of PROVIDERS) {
      const fqcn = `${WIDGET_PACKAGE}.${name}`
      if (!app.receiver.some((r) => r.$["android:name"] === fqcn)) {
        app.receiver.push({
          $: {
            "android:name": fqcn,
            "android:exported": "false",
          },
          "intent-filter": [
            {
              action: [
                { $: { "android:name": "android.appwidget.action.APPWIDGET_UPDATE" } },
              ],
            },
          ],
          "meta-data": [
            {
              $: {
                "android:name": "android.appwidget.provider",
                "android:resource": xml,
              },
            },
          ],
        })
      }
    }

    const serviceName = `${WIDGET_PACKAGE}.RecentWidgetService`
    if (!app.service.some((s) => s.$["android:name"] === serviceName)) {
      app.service.push({
        $: {
          "android:name": serviceName,
          "android:exported": "false",
          "android:permission": "android.permission.BIND_REMOTEVIEWS",
        },
      })
    }

    return config
  })
}

module.exports = withExpenseWidgets
