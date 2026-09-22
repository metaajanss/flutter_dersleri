// Reklam sayısı değiştikçe action badge'ini günceller.
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message && message.type === "FB_ADS_COUNT_UPDATED") {
    const tabId = sender.tab && sender.tab.id;
    chrome.action.setBadgeText({ text: String(message.count), tabId });
    chrome.action.setBadgeBackgroundColor({ color: "#1877F2", tabId });
  }
});
