const STORAGE_KEY = "fbAdsLibraryData";
const AUTO_CONFIG_KEY = "fbAdsAutoConfig";
const AUTO_STATUS_KEY = "fbAdsAutoStatus";

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

// Jumpix şablonuyla birebir eşleşen sütun sırası. Facebook Ads Library
// kazıması kişi adı/e-posta/telefon vermediği için first_name, last_name,
// email, phone alanları boş bırakılıyor; company = reklam veren (sayfa) adı,
// web_link = sayfa bağlantısı, facebook_ads_library_id = Library ID.
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
    "",
    "",
    "",
    "",
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

function renderAutoStatus(status, config) {
  if (!status) {
    autoStatusEl.hidden = true;
    startBtn.hidden = false;
    stopBtn.hidden = true;
    return;
  }

  const targetLabel =
    config && config.mode === "count" ? `${config.targetCount} adet` : "tüm sonuçlar";

  if (status.running) {
    autoStatusEl.hidden = false;
    autoStatusEl.className = "auto-status";
    autoStatusEl.textContent = `Otomatik kaydırma çalışıyor... Toplanan: ${status.collected} / Hedef: ${targetLabel}`;
    startBtn.hidden = true;
    stopBtn.hidden = false;
  } else if (status.finished) {
    autoStatusEl.hidden = false;
    autoStatusEl.className = "auto-status finished";
    autoStatusEl.textContent = `Tamamlandı (${status.reason || ""}). Toplanan: ${status.collected}.`;
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

  await chrome.storage.local.set({
    [AUTO_CONFIG_KEY]: {
      keyword,
      mode,
      targetCount: mode === "count" ? targetCount : 0,
      running: true,
      startedAt: Date.now(),
    },
    [AUTO_STATUS_KEY]: {
      running: true,
      finished: false,
      collected: 0,
      target: mode === "count" ? targetCount : null,
      reason: "",
    },
  });

  // Otomasyon, kendi ayrı penceresinde çalışır. Böylece kullanıcı başka bir
  // sekmeye/pencereye geçse bile bu pencere "görünür" (visible) sayılmaya
  // devam eder; Chrome ve Facebook, yalnızca seçili olmayan bir SEKMEYİ
  // (aynı pencere içinde başka sekmeye geçildiğinde) veya küçültülmüş bir
  // pencereyi "arka planda" kabul edip zamanlayıcıları/içerik yüklemeyi
  // durdurur. Ayrı pencere odak dışı kalsa bile bu kısıtlamaya girmez.
  const existing = await chrome.storage.local.get("fbAdsAutoWindowId");
  let reused = false;

  if (existing.fbAdsAutoWindowId) {
    try {
      await chrome.windows.get(existing.fbAdsAutoWindowId);
      await chrome.windows.update(existing.fbAdsAutoWindowId, {
        state: "normal",
        focused: true,
      });
      const [tab] = await chrome.tabs.query({
        active: true,
        windowId: existing.fbAdsAutoWindowId,
      });
      if (tab) {
        await chrome.tabs.update(tab.id, { url });
        reused = true;
      }
    } catch (e) {
      // Pencere artık yok; aşağıda yeni bir tane açılacak.
    }
  }

  if (!reused) {
    const win = await chrome.windows.create({
      url,
      type: "normal",
      focused: true,
    });
    await chrome.storage.local.set({ fbAdsAutoWindowId: win.id });
  }

  showStatus(
    "Arama başlatıldı. Bu pencereyi küçültmeden arkada bırakabilir, başka " +
      "sekme/pencerede çalışmaya devam edebilirsiniz.",
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

refreshCount();
refreshAutoStatus();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes[STORAGE_KEY]) refreshCount();
  if (changes[AUTO_STATUS_KEY] || changes[AUTO_CONFIG_KEY]) refreshAutoStatus();
});
