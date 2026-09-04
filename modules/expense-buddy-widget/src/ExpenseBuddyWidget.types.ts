export interface ExpenseBuddyWidgetNativeModule {
  refreshWidgets(): Promise<void>
  persistAssist(assistJson: string): Promise<void>
}
