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

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === TICK_ALARM) tick();
});

// Popup, fbAdsAutoConfig.running değerini true/false yaptığında alarmı
// buradan başlatıp durduruyoruz; böylece tetikleyici tek bir yerde.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[AUTO_CONFIG_KEY]) return;
  const newValue = changes[AUTO_CONFIG_KEY].newValue;
  const oldValue = changes[AUTO_CONFIG_KEY].oldValue;

  if (newValue && newValue.running && !(oldValue && oldValue.running)) {
    startTicking();
  } else if (oldValue && oldValue.running && (!newValue || !newValue.running)) {
    chrome.alarms.clear(TICK_ALARM);
  }
});

// Tarayıcı yeniden başlatıldığında otomasyon hâlâ "running" ise alarmı
// yeniden kurar (service worker sonlanmış olsa da alarm kendisi hayatta
// kalır, ama emin olmak için burada da kontrol ediyoruz).
chrome.runtime.onStartup.addListener(async () => {
  const config = await getAutoConfig();
  if (config && config.running) startTicking();
});

// Reklam sayısı değiştikçe action badge'ini günceller.
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message && message.type === "FB_ADS_COUNT_UPDATED") {
    const tabId = sender.tab && sender.tab.id;
    chrome.action.setBadgeText({ text: String(message.count), tabId });
    chrome.action.setBadgeBackgroundColor({ color: "#1877F2", tabId });
  }
});
