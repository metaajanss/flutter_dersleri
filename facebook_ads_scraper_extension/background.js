const STORAGE_KEY = "fbAdsLibraryData";
const JUMPIX_CONFIG_KEY = "fbAdsJumpixConfig";

// Reklam sayısı değiştikçe action badge'ini günceller.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return;

  if (message.type === "FB_ADS_COUNT_UPDATED") {
    const tabId = sender.tab && sender.tab.id;
    chrome.action.setBadgeText({ text: String(message.count), tabId });
    chrome.action.setBadgeBackgroundColor({ color: "#1877F2", tabId });
    return;
  }

  if (message.type === "JUMPIX_SEND_RECORDS") {
    sendItemsToJumpix(message.items || [])
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true; // async sendResponse
  }

  if (message.type === "JUMPIX_SEND_ALL") {
    sendAllToJumpix()
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true; // async sendResponse
  }
});

async function getJumpixConfig() {
  const result = await chrome.storage.local.get(JUMPIX_CONFIG_KEY);
  return result[JUMPIX_CONFIG_KEY] || null;
}

async function markSent(keys) {
  if (keys.length === 0) return;
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const store = result[STORAGE_KEY] || {};
  let changed = false;

  for (const key of keys) {
    if (store[key]) {
      store[key].jumpixSent = true;
      store[key].jumpixSentAt = new Date().toISOString();
      changed = true;
    }
  }

  if (changed) await chrome.storage.local.set({ [STORAGE_KEY]: store });
}

// Jumpix'in beklediği tam alan adları elimizde olmadığı için, yaygın CRM/lead
// alan isimlendirmelerine uyan genel bir JSON gönderiyoruz. Jumpix webhook'u
// farklı alan adları bekliyorsa bu fonksiyonu güncellemek yeterli.
function buildJumpixPayload(record) {
  return {
    source: "facebook_ads_library",
    name: record.advertiserName || "",
    lead_name: record.advertiserName || "",
    company_name: record.advertiserName || "",
    facebook_page_url: record.advertiserUrl || "",
    facebook_page_id: record.pageId || "",
    library_id: record.libraryId || "",
    ad_status: record.status || "",
    started_running: record.startedRunning || "",
    platforms: record.platforms || "",
    search_keyword: record.searchKeyword || "",
    collected_from_page: record.pageUrl || "",
    collected_at: record.scrapedAt || "",
  };
}

async function postToJumpix(webhookUrl, record) {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildJumpixPayload(record)),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
}

async function sendItemsToJumpix(items) {
  const config = await getJumpixConfig();
  if (!config || !config.webhookUrl) {
    return { sent: 0, failed: 0, reason: "no-webhook" };
  }

  let sent = 0;
  let failed = 0;
  const sentKeys = [];

  for (const { key, record } of items) {
    try {
      await postToJumpix(config.webhookUrl, record);
      sentKeys.push(key);
      sent++;
    } catch (err) {
      failed++;
    }
  }

  await markSent(sentKeys);
  return { sent, failed };
}

async function sendAllToJumpix() {
  const config = await getJumpixConfig();
  if (!config || !config.webhookUrl) {
    return { sent: 0, failed: 0, reason: "no-webhook" };
  }

  const result = await chrome.storage.local.get(STORAGE_KEY);
  const store = result[STORAGE_KEY] || {};
  const items = Object.entries(store)
    .filter(([, record]) => !record.jumpixSent)
    .map(([key, record]) => ({ key, record }));

  return sendItemsToJumpix(items);
}
