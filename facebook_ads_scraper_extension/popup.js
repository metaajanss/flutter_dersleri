const STORAGE_KEY = "fbAdsLibraryData";

const countEl = document.getElementById("count");
const exportBtn = document.getElementById("exportBtn");
const clearBtn = document.getElementById("clearBtn");
const statusEl = document.getElementById("status");

const HEADERS = [
  "Reklam Veren Adı",
  "Sayfa Bağlantısı",
  "Sayfa ID",
  "Library ID",
  "Durum",
  "Başlangıç Tarihi",
  "Platformlar",
  "Toplandığı Sayfa",
  "Toplanma Zamanı",
];

function recordToRow(record) {
  return [
    record.advertiserName || "",
    record.advertiserUrl || "",
    record.pageId || "",
    record.libraryId || "",
    record.status || "",
    record.startedRunning || "",
    record.platforms || "",
    record.pageUrl || "",
    record.scrapedAt || "",
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
  chrome.downloads.download(
    { url, filename, saveAs: true },
    () => {
      URL.revokeObjectURL(url);
    }
  );
}

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

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[STORAGE_KEY]) {
    refreshCount();
  }
});
