/* Keep the toolbar button a convenient sidebar toggle. No API calls. */
browser.action.onClicked.addListener(() => {
  browser.sidebarAction.toggle().catch(() => browser.sidebarAction.open());
});
