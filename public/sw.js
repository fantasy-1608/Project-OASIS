// Background service worker for OASIS extension
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'OPEN_SIDE_PANEL' && sender.tab) {
    chrome.sidePanel.open({ windowId: sender.tab.windowId });
  }
});
