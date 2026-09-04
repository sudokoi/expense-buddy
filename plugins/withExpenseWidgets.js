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
    app.activity = app.activity || []

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

    const systemReceiver = `${WIDGET_PACKAGE}.WidgetSystemReceiver`
    if (!app.receiver.some((r) => r.$["android:name"] === systemReceiver)) {
      app.receiver.push({
        $: {
          "android:name": systemReceiver,
          "android:exported": "false",
        },
        "intent-filter": [
          {
            action: [
              { $: { "android:name": "android.intent.action.DATE_CHANGED" } },
              { $: { "android:name": "android.intent.action.TIME_SET" } },
              { $: { "android:name": "android.intent.action.TIMEZONE_CHANGED" } },
              { $: { "android:name": "android.intent.action.BOOT_COMPLETED" } },
              { $: { "android:name": "android.intent.action.MY_PACKAGE_REPLACED" } },
            ],
          },
        ],
      })
    }

    // Launched explicitly by the widget host during placement, so it must
    // be exported. Benign screen: writes only its own widget-id prefs.
    const configActivity = `${WIDGET_PACKAGE}.WidgetConfigActivity`
    if (!app.activity.some((a) => a.$["android:name"] === configActivity)) {
      app.activity.push({
        $: {
          "android:name": configActivity,
          "android:exported": "true",
          "android:theme": "@android:style/Theme.Material.Light.Dialog.NoActionBar",
          "android:windowSoftInputMode": "stateHidden",
        },
      })
    }

    return config
  })
}

module.exports = withExpenseWidgets
