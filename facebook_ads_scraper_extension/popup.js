const STORAGE_KEY = "fbAdsLibraryData";
const AUTO_CONFIG_KEY = "fbAdsAutoConfig";
const AUTO_STATUS_KEY = "fbAdsAutoStatus";
const ENRICH_CONFIG_KEY = "fbAdsEnrichConfig";
const ENRICH_STATUS_KEY = "fbAdsEnrichStatus";

const countEl = document.getElementById("count");
const exportBtn = document.getElementById("exportBtn");
const clearBtn = document.getElementById("clearBtn");
const statusEl = document.getElementById("status");
const keywordInput = document.getElementById("keyword");
const countInput = document.getElementById("countInput");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const autoStatusEl = document.getElementById("autoStatus");
const modeRadios = document.querySelectorAll('input[name="mode"]');
const enrichBtn = document.getElementById("enrichBtn");
const enrichStopBtn = document.getElementById("enrichStopBtn");
const enrichStatusEl = document.getElementById("enrichStatus");
const enrichStatusMsgEl = document.getElementById("enrichStatusMsg");

// Jumpix şablonuyla birebir eşleşen sütun sırası. last_name FB Ads
// Library'nin sağlamadığı bir bilgi olduğu için boş bırakılıyor;
// email/phone "Zenginleştir" ile dolduysa dolu, değilse boş gider.
// Reklam veren (sayfa) adı hem first_name hem company sütununa,
// web_link sayfa bağlantısına, facebook_ads_library_id Library ID'ye
// yazılıyor.
const HEADERS = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "company",
  "web_link",
  "facebook_ads_library_id",
];

function recordToRow(record) {
  return [
    record.advertiserName || "",
    "",
    record.email || "",
    record.phone || "",
    record.advertiserName || "",
    record.advertiserUrl || "",
    record.libraryId || "",
  ];
}

function showStatus(message, kind) {
  statusEl.textContent = message;
  statusEl.className = `status ${kind || ""}`.trim();
}

async function getRecords() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return Object.values(result[STORAGE_KEY] || {});
}

async function refreshCount() {
  const records = await getRecords();
  countEl.textContent = records.length;
  exportBtn.disabled = records.length === 0;
  return records;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename, saveAs: true }, () => {
    URL.revokeObjectURL(url);
  });
}

function buildAdsLibraryUrl(keyword) {
  const params = new URLSearchParams({
    active_status: "active",
    ad_type: "all",
    country: "ALL",
    is_targeted_country: "false",
    media_type: "all",
    q: keyword,
    search_type: "keyword_unordered",
  });
  return `https://www.facebook.com/ads/library/?${params.toString()}`;
}

function currentMode() {
  return [...modeRadios].find((r) => r.checked)?.value || "all";
}

function updateModeUi() {
  countInput.disabled = currentMode() !== "count";
}

// Bir durum kutusuna (autoStatusEl / enrichStatusEl) etiket metni ve
// isteğe bağlı bir ilerleme çubuğu çizer. innerHTML yerine DOM
// düğümleriyle oluşturulur (basit ama güvenli).
function setStatusBox(el, label, percent, extraClass) {
  el.hidden = false;
  el.className = `auto-status ${extraClass || ""}`.trim();
  el.textContent = "";

  const labelEl = document.createElement("div");
  labelEl.textContent = label;
  el.appendChild(labelEl);

  if (percent !== null) {
    const bar = document.createElement("div");
    bar.className = "progress-bar";
    const fill = document.createElement("div");
    fill.className = "progress-bar-fill";
    fill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    bar.appendChild(fill);
    el.appendChild(bar);
  }
}

function renderAutoStatus(status, config) {
  if (!status) {
    autoStatusEl.hidden = true;
    startBtn.hidden = false;
    stopBtn.hidden = true;
    return;
  }

  const isCountMode = config && config.mode === "count";

  if (status.running) {
    let label;
    let percent = null;

    if (isCountMode) {
      const remaining = Math.max((config.targetCount || 0) - status.collected, 0);
      percent = config.targetCount ? (status.collected / config.targetCount) * 100 : 0;
      label = `Otomatik kaydırma çalışıyor... Toplanan: ${status.collected}/${config.targetCount} · Kalan: ${remaining}`;
    } else {
      const idleStreak = (config && config.idleStreak) || 0;
      label = `Otomatik kaydırma çalışıyor... Toplanan: ${status.collected} · Yeni sonuç gelmezse durur: ${idleStreak}/6 dener`;
    }

    setStatusBox(autoStatusEl, label, percent);
    startBtn.hidden = true;
    stopBtn.hidden = false;
  } else if (status.finished) {
    setStatusBox(
      autoStatusEl,
      `Tamamlandı (${status.reason || ""}). Toplanan: ${status.collected}.`,
      null,
      "finished"
    );
    startBtn.hidden = false;
    stopBtn.hidden = true;
  } else {
    autoStatusEl.hidden = true;
    startBtn.hidden = false;
    stopBtn.hidden = true;
  }
}

async function refreshAutoStatus() {
  const result = await chrome.storage.local.get([AUTO_STATUS_KEY, AUTO_CONFIG_KEY]);
  renderAutoStatus(result[AUTO_STATUS_KEY], result[AUTO_CONFIG_KEY]);
}

modeRadios.forEach((radio) => radio.addEventListener("change", updateModeUi));
updateModeUi();

startBtn.addEventListener("click", async () => {
  const keyword = keywordInput.value.trim();
  if (!keyword) {
    showStatus("Lütfen bir anahtar kelime girin.", "error");
    return;
  }

  const mode = currentMode();
  const targetCount = mode === "count" ? parseInt(countInput.value, 10) : 0;
  if (mode === "count" && (!Number.isFinite(targetCount) || targetCount <= 0)) {
    showStatus("Lütfen geçerli bir adet girin.", "error");
    return;
  }

  const url = buildAdsLibraryUrl(keyword);

  // Arama, kendi ayrı penceresinde açılır ama artık görünmeden/odağı
  // çalmadan (küçültülmüş) çalışıyor: background.js, chrome.alarms +
  // chrome.scripting.executeScript ile sekmeyi tabId üzerinden doğrudan
  // tetikler. Bu yüzden pencerenin görünür, odaklı, hatta küçültülmemiş
  // olmasına bile gerek yok — sekmeye hiç bakılmasa da toplama durmaz.
  const existing = await chrome.storage.local.get("fbAdsAutoWindowId");
  let tabId = null;

  if (existing.fbAdsAutoWindowId) {
    try {
      await chrome.windows.get(existing.fbAdsAutoWindowId);
      await chrome.windows.update(existing.fbAdsAutoWindowId, {
        state: "minimized",
      });
      const [tab] = await chrome.tabs.query({
        active: true,
        windowId: existing.fbAdsAutoWindowId,
      });
      if (tab) {
        await chrome.tabs.update(tab.id, { url });
        tabId = tab.id;
      }
    } catch (e) {
      // Pencere artık yok; aşağıda yeni bir tane açılacak.
    }
  }

  if (tabId === null) {
    const win = await chrome.windows.create({
      url,
      type: "normal",
      focused: false,
      state: "minimized",
    });
    await chrome.storage.local.set({ fbAdsAutoWindowId: win.id });
    tabId = win.tabs && win.tabs[0] ? win.tabs[0].id : null;
  }

  await chrome.storage.local.set({
    [AUTO_CONFIG_KEY]: {
      keyword,
      mode,
      targetCount: mode === "count" ? targetCount : 0,
      running: true,
      startedAt: Date.now(),
      tabId,
      iterations: 0,
      idleStreak: 0,
    },
    [AUTO_STATUS_KEY]: {
      running: true,
      finished: false,
      collected: 0,
      target: mode === "count" ? targetCount : null,
      reason: "",
    },
  });

  showStatus(
    "Arama başlatıldı. Sekmeye/pencereye bakmasanız, başka bir pencerenin " +
      "arkasında kalsa bile otomasyon arka planda devam eder.",
    "success"
  );
  await refreshAutoStatus();
});

stopBtn.addEventListener("click", async () => {
  const result = await chrome.storage.local.get(AUTO_CONFIG_KEY);
  const config = result[AUTO_CONFIG_KEY];
  if (config) {
    await chrome.storage.local.set({
      [AUTO_CONFIG_KEY]: { ...config, running: false },
    });
  }
  showStatus("Otomasyon durduruluyor...", "success");
});

exportBtn.addEventListener("click", async () => {
  const records = await getRecords();
  if (records.length === 0) {
    showStatus("Aktarılacak veri yok.", "error");
    return;
  }

  try {
    const rows = records.map(recordToRow);
    const blob = XlsxWriter.build({
      sheetName: "Reklam Verenler",
      headers: HEADERS,
      rows,
    });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadBlob(blob, `facebook_ads_library_${stamp}.xlsx`);
    showStatus(`${records.length} kayıt dışa aktarıldı.`, "success");
  } catch (err) {
    console.error(err);
    showStatus("Dışa aktarma sırasında hata oluştu.", "error");
  }
});

clearBtn.addEventListener("click", async () => {
  await chrome.storage.local.remove(STORAGE_KEY);
  await refreshCount();
  showStatus("Tüm veriler temizlendi.", "success");
});

function showEnrichMsg(message, kind) {
  enrichStatusMsgEl.textContent = message;
  enrichStatusMsgEl.className = `status ${kind || ""}`.trim();
}

function renderEnrichStatus(status) {
  if (!status) {
    enrichStatusEl.hidden = true;
    enrichBtn.hidden = false;
    enrichStopBtn.hidden = true;
    return;
  }

  if (status.running) {
    const remaining = Math.max((status.total || 0) - status.processed, 0);
    const percent = status.total ? (status.processed / status.total) * 100 : 0;
    setStatusBox(
      enrichStatusEl,
      `Zenginleştiriliyor... İşlenen: ${status.processed}/${status.total} · Kalan: ${remaining} · Bulunan: ${status.found}`,
      percent
    );
    enrichBtn.hidden = true;
    enrichStopBtn.hidden = false;
  } else if (status.finished) {
    setStatusBox(
      enrichStatusEl,
      `Tamamlandı (${status.reason || ""}). İşlenen: ${status.processed}/${status.total} · Bulunan: ${status.found}`,
      null,
      "finished"
    );
    enrichBtn.hidden = false;
    enrichStopBtn.hidden = true;
  } else {
    enrichStatusEl.hidden = true;
    enrichBtn.hidden = false;
    enrichStopBtn.hidden = true;
  }
}

async function refreshEnrichStatus() {
  const result = await chrome.storage.local.get(ENRICH_STATUS_KEY);
  renderEnrichStatus(result[ENRICH_STATUS_KEY]);
}

enrichBtn.addEventListener("click", async () => {
  const records = await chrome.storage.local.get(STORAGE_KEY);
  const store = records[STORAGE_KEY] || {};
  const keys = Object.keys(store).filter((key) => !store[key].enrichedAt && store[key].advertiserUrl);

  if (keys.length === 0) {
    showEnrichMsg("Zenginleştirilecek yeni kayıt yok (liste boş ya da hepsi zaten işlendi).", "error");
    return;
  }

  // Zenginleştirme, arama otomasyonundan ayrı, kendi penceresinde çalışır
  // ki ikisi aynı anda çalışırken birbirinin sekmesini ele geçirmesin.
  const existing = await chrome.storage.local.get("fbAdsEnrichWindowId");
  let tabId = null;

  if (existing.fbAdsEnrichWindowId) {
    try {
      await chrome.windows.get(existing.fbAdsEnrichWindowId);
      const [tab] = await chrome.tabs.query({
        active: true,
        windowId: existing.fbAdsEnrichWindowId,
      });
      if (tab) tabId = tab.id;
    } catch (e) {
      // Pencere artık yok; aşağıda yeni bir tane açılacak.
    }
  }

  if (tabId === null) {
    const win = await chrome.windows.create({
      url: "https://www.facebook.com/",
      type: "normal",
      focused: false,
      state: "minimized",
    });
    await chrome.storage.local.set({ fbAdsEnrichWindowId: win.id });
    tabId = win.tabs && win.tabs[0] ? win.tabs[0].id : null;
  } else {
    try {
      await chrome.windows.update(existing.fbAdsEnrichWindowId, { state: "minimized" });
    } catch (e) {
      // önemli değil
    }
  }

  await chrome.storage.local.set({
    [ENRICH_CONFIG_KEY]: {
      running: true,
      tabId,
      queue: keys,
      phase: "navigate",
      currentKey: null,
      processed: 0,
      found: 0,
      total: keys.length,
    },
    [ENRICH_STATUS_KEY]: {
      running: true,
      finished: false,
      processed: 0,
      total: keys.length,
      found: 0,
      reason: "",
    },
  });

  showEnrichMsg(`Zenginleştirme başlatıldı: ${keys.length} kayıt işlenecek.`, "success");
  await refreshEnrichStatus();
});

enrichStopBtn.addEventListener("click", async () => {
  const result = await chrome.storage.local.get(ENRICH_CONFIG_KEY);
  const config = result[ENRICH_CONFIG_KEY];
  if (config) {
    await chrome.storage.local.set({
      [ENRICH_CONFIG_KEY]: { ...config, running: false },
    });
  }
  showEnrichMsg("Zenginleştirme durduruluyor...", "success");
});

refreshCount();
refreshAutoStatus();
refreshEnrichStatus();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes[STORAGE_KEY]) refreshCount();
  if (changes[AUTO_STATUS_KEY] || changes[AUTO_CONFIG_KEY]) refreshAutoStatus();
  if (changes[ENRICH_STATUS_KEY]) refreshEnrichStatus();
});
