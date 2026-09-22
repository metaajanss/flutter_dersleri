// Otomatik kaydırma döngüsünün "kalp atışı" burada, servis çalışanında
// (service worker) yürütülür — chrome.alarms ile tetiklenip
// chrome.scripting.executeScript ile hedef sekmede content.js'in
// window.__fbAdsTick fonksiyonunu çağırır. Bu döngü content script'in
// kendi setTimeout'una dayansaydı, sekme başka bir pencere tarafından
// tamamen kapatıldığında (occlusion) veya kullanıcı başka bir sekmeye/
// pencereye geçtiğinde Chrome sayfanın zamanlayıcılarını durdurduğu için
// otomasyon dururdu. Alarms + executeScript kombinasyonu buna tabi değildir.

const STORAGE_KEY = "fbAdsLibraryData";
const AUTO_CONFIG_KEY = "fbAdsAutoConfig";
const AUTO_STATUS_KEY = "fbAdsAutoStatus";
const TICK_ALARM = "fbAdsAutoTick";
const MAX_IDLE_STREAK = 6; // art arda bu kadar taramada yeni reklam veren gelmezse sonuna gelinmiş sayılır
const MAX_ITERATIONS = 4000; // sonsuz döngüye karşı güvenlik sınırı

const ENRICH_CONFIG_KEY = "fbAdsEnrichConfig";
const ENRICH_STATUS_KEY = "fbAdsEnrichStatus";
const ENRICH_ALARM = "fbAdsEnrichTick";

async function getAutoConfig() {
  const result = await chrome.storage.local.get(AUTO_CONFIG_KEY);
  return result[AUTO_CONFIG_KEY] || null;
}

async function patchAutoConfig(patch) {
  const current = (await getAutoConfig()) || {};
  await chrome.storage.local.set({ [AUTO_CONFIG_KEY]: { ...current, ...patch } });
}

async function setAutoStatus(status) {
  await chrome.storage.local.set({ [AUTO_STATUS_KEY]: status });
}

async function getCollectedCount() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return Object.keys(result[STORAGE_KEY] || {}).length;
}

async function stopAutomation(reason) {
  await chrome.alarms.clear(TICK_ALARM);
  await patchAutoConfig({ running: false });
  const collected = await getCollectedCount();
  await setAutoStatus({ running: false, finished: true, collected, reason });
}

async function startTicking() {
  await patchAutoConfig({ iterations: 0, idleStreak: 0 });
  // periodInMinutes çok küçük (yaklaşık 3 saniye); Chrome normalde alarmları
  // 1 dakikanın altına indirmeye izin vermez, ANCAK paketlenmemiş
  // (geliştirici modunda yüklenmiş) eklentilerde bu alt sınır uygulanmaz.
  await chrome.alarms.create(TICK_ALARM, { periodInMinutes: 0.05 });
}

async function tick() {
  const config = await getAutoConfig();
  if (!config || !config.running || !config.tabId) {
    await stopAutomation("durduruldu");
    return;
  }

  const before = await getCollectedCount();

  try {
    await chrome.scripting.executeScript({
      target: { tabId: config.tabId },
      func: () => {
        if (typeof window.__fbAdsTick === "function") {
          return window.__fbAdsTick();
        }
        return null;
      },
    });
  } catch (err) {
    // Sekme kapatılmış veya erişilemez durumda.
    await stopAutomation("sekme kapatıldı veya erişilemedi");
    return;
  }

  const after = await getCollectedCount();
  const iterations = (config.iterations || 0) + 1;
  const idleStreak = after === before ? (config.idleStreak || 0) + 1 : 0;

  await patchAutoConfig({ iterations, idleStreak });
  await setAutoStatus({
    running: true,
    finished: false,
    collected: after,
    target: config.mode === "count" ? config.targetCount : null,
    reason: "",
  });

  if (config.mode === "count" && after >= config.targetCount) {
    await stopAutomation("hedef adede ulaşıldı");
    return;
  }

  if (config.mode === "all" && idleStreak >= MAX_IDLE_STREAK) {
    await stopAutomation("tüm sonuçlar tarandı");
    return;
  }

  if (iterations >= MAX_ITERATIONS) {
    await stopAutomation("maksimum deneme sınırına ulaşıldı");
  }
}

// ---- Zenginleştirme: toplanan sayfalara gidip e-posta/telefon arama ----
// Aynı "alarm + executeScript" deseniyle çalışır, ama iki fazlı: bir tikte
// hedef sekmeyi reklam verenin "İletişim ve Temel Bilgiler" sayfasına
// yönlendirir, bir SONRAKİ tikte (sayfanın render olması için birkaç
// saniye geçtikten sonra) o sayfadan e-posta/telefon çıkarır. Bu, sayfa
// yüklemesini beklemek için servis çalışanı içinde uzun bir "sleep"
// kullanmaktan kaçınır (servis çalışanı uzun beklemelerde sonlanabilir).

function buildAboutContactUrl(pageUrl) {
  try {
    const u = new URL(pageUrl);
    if (u.pathname.includes("profile.php")) {
      const id = u.searchParams.get("id");
      if (!id) return null;
      return `${u.origin}/profile.php?id=${id}&sk=about_contact_and_basic_info`;
    }
    const path = u.pathname.replace(/\/$/, "");
    return `${u.origin}${path}/about_contact_and_basic_info`;
  } catch (err) {
    return null;
  }
}

async function getEnrichConfig() {
  const result = await chrome.storage.local.get(ENRICH_CONFIG_KEY);
  return result[ENRICH_CONFIG_KEY] || null;
}

async function patchEnrichConfig(patch) {
  const current = (await getEnrichConfig()) || {};
  await chrome.storage.local.set({ [ENRICH_CONFIG_KEY]: { ...current, ...patch } });
}

async function setEnrichStatus(status) {
  await chrome.storage.local.set({ [ENRICH_STATUS_KEY]: status });
}

async function stopEnrichment(reason) {
  await chrome.alarms.clear(ENRICH_ALARM);
  const config = await getEnrichConfig();
  await patchEnrichConfig({ running: false });
  await setEnrichStatus({
    running: false,
    finished: true,
    processed: config ? config.processed : 0,
    total: config ? config.total : 0,
    found: config ? config.found : 0,
    reason,
  });
}

function extractContactInfoFromPage() {
  const text = document.body.innerText || "";
  const mailtoLinks = [...document.querySelectorAll('a[href^="mailto:"]')].map((a) =>
    decodeURIComponent(a.href.replace("mailto:", "")).split("?")[0].trim()
  );
  const telLinks = [...document.querySelectorAll('a[href^="tel:"]')].map((a) =>
    decodeURIComponent(a.href.replace("tel:", "")).trim()
  );
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = text.match(/(\+?\d[\d\s().-]{7,}\d)/);
  return {
    email: mailtoLinks[0] || (emailMatch ? emailMatch[0] : ""),
    phone: telLinks[0] || (phoneMatch ? phoneMatch[0].trim() : ""),
  };
}

async function enrichTick() {
  const config = await getEnrichConfig();
  if (!config || !config.running || !config.tabId) {
    await stopEnrichment("durduruldu");
    return;
  }

  if (config.phase === "navigate") {
    if (config.queue.length === 0) {
      await stopEnrichment("tüm kayıtlar işlendi");
      return;
    }

    const [nextKey, ...rest] = config.queue;
    const dataResult = await chrome.storage.local.get(STORAGE_KEY);
    const store = dataResult[STORAGE_KEY] || {};
    const record = store[nextKey];
    const url = record && record.advertiserUrl ? buildAboutContactUrl(record.advertiserUrl) : null;

    if (!url) {
      await patchEnrichConfig({ queue: rest, processed: config.processed + 1 });
      return;
    }

    try {
      await chrome.tabs.update(config.tabId, { url });
    } catch (err) {
      await stopEnrichment("sekme kapatıldı veya erişilemedi");
      return;
    }

    await patchEnrichConfig({ queue: rest, phase: "extract", currentKey: nextKey });
    return;
  }

  // phase === "extract": önceki tikte açılan sayfanın artık render olmuş
  // olması beklenir; oradan bilgi çıkarılır.
  let extracted = null;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: config.tabId },
      func: extractContactInfoFromPage,
    });
    extracted = results && results[0] ? results[0].result : null;
  } catch (err) {
    extracted = null;
  }

  const dataResult = await chrome.storage.local.get(STORAGE_KEY);
  const store = dataResult[STORAGE_KEY] || {};
  const key = config.currentKey;
  let found = config.found;

  if (key && store[key]) {
    store[key].email = (extracted && extracted.email) || store[key].email || "";
    store[key].phone = (extracted && extracted.phone) || store[key].phone || "";
    store[key].enrichedAt = new Date().toISOString();
    if (extracted && (extracted.email || extracted.phone)) found++;
    await chrome.storage.local.set({ [STORAGE_KEY]: store });
  }

  const processed = config.processed + 1;
  await patchEnrichConfig({ phase: "navigate", currentKey: null, processed, found });
  await setEnrichStatus({
    running: true,
    finished: false,
    processed,
    total: config.total,
    found,
    reason: "",
  });

  if (config.queue.length === 0) {
    await stopEnrichment("tüm kayıtlar işlendi");
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === TICK_ALARM) tick();
  if (alarm.name === ENRICH_ALARM) enrichTick();
});

// Popup, fbAdsAutoConfig.running / fbAdsEnrichConfig.running değerini
// true/false yaptığında ilgili alarmı buradan başlatıp durduruyoruz;
// böylece tetikleyici tek bir yerde.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;

  if (changes[AUTO_CONFIG_KEY]) {
    const newValue = changes[AUTO_CONFIG_KEY].newValue;
    const oldValue = changes[AUTO_CONFIG_KEY].oldValue;
    if (newValue && newValue.running && !(oldValue && oldValue.running)) {
      startTicking();
    } else if (oldValue && oldValue.running && (!newValue || !newValue.running)) {
      chrome.alarms.clear(TICK_ALARM);
    }
  }

  if (changes[ENRICH_CONFIG_KEY]) {
    const newValue = changes[ENRICH_CONFIG_KEY].newValue;
    const oldValue = changes[ENRICH_CONFIG_KEY].oldValue;
    if (newValue && newValue.running && !(oldValue && oldValue.running)) {
      // periodInMinutes ~5 saniye; sayfanın render olması için tik başına
      // bir faz (navigate/extract) ilerler, bkz. enrichTick().
      chrome.alarms.create(ENRICH_ALARM, { periodInMinutes: 0.08 });
    } else if (oldValue && oldValue.running && (!newValue || !newValue.running)) {
      chrome.alarms.clear(ENRICH_ALARM);
    }
  }
});

// Tarayıcı yeniden başlatıldığında otomasyon/zenginleştirme hâlâ "running"
// ise alarmı yeniden kurar (service worker sonlanmış olsa da alarm
// kendisi hayatta kalır, ama emin olmak için burada da kontrol ediyoruz).
chrome.runtime.onStartup.addListener(async () => {
  const config = await getAutoConfig();
  if (config && config.running) startTicking();

  const enrichConfig = await getEnrichConfig();
  if (enrichConfig && enrichConfig.running) {
    chrome.alarms.create(ENRICH_ALARM, { periodInMinutes: 0.08 });
  }
});

// Reklam sayısı değiştikçe action badge'ini günceller.
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message && message.type === "FB_ADS_COUNT_UPDATED") {
    const tabId = sender.tab && sender.tab.id;
    chrome.action.setBadgeText({ text: String(message.count), tabId });
    chrome.action.setBadgeBackgroundColor({ color: "#1877F2", tabId });
  }
});
