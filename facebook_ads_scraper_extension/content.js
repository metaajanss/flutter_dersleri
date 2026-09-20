// Facebook Ads Library sayfasında dolaşarak reklam kartlarını bulur,
// reklam veren bilgilerini çıkarır ve chrome.storage.local'e tekilleştirerek kaydeder.
// Facebook sayfayı sonsuz kaydırma (infinite scroll) ile yeniden render ettiği için
// bir MutationObserver ile DOM değişiklikleri izlenir ve yeni eklenen kartlar taranır.

(() => {
  const STORAGE_KEY = "fbAdsLibraryData";
  const SEEN_KEYS_IN_MEMORY = new Set(); // bu sekmede zaten işlenmiş kart elemanlarını tutar (WeakSet yerine Set+WeakMap)
  const PROCESSED_ELEMENTS = new WeakSet();
  let scanScheduled = false;
  let totalCountCache = 0;

  function textOf(el) {
    return (el && el.innerText ? el.innerText : "").replace(/\s+/g, " ").trim();
  }

  function escapeForMatch(s) {
    return s;
  }

  // Sayfadaki "Library ID:" metnini içeren yaprak düğümlerden yola çıkarak
  // en yakın "kart" konteynerini bulur.
  function findAdCards() {
    const cards = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.nodeValue && node.nodeValue.includes("Library ID")
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      },
    });

    let textNode;
    while ((textNode = walker.nextNode())) {
      let el = textNode.parentElement;
      let candidate = null;
      for (let depth = 0; el && depth < 10; depth++, el = el.parentElement) {
        const hasProfileLink = el.querySelector && el.querySelector('a[href*="facebook.com"]');
        const wideEnough = el.offsetWidth === 0 || el.offsetWidth > 220; // gizli elemanlarda offsetWidth 0 olabilir
        if (hasProfileLink && wideEnough) {
          candidate = el;
          break;
        }
      }
      if (candidate) cards.add(candidate);
    }
    return [...cards];
  }

  function extractAdvertiser(card) {
    const links = [...card.querySelectorAll("a[href]")];

    // Reklam veren sayfasının kimliği genelde "view_all_page_id=" parametresiyle geçer,
    // bu en güvenilir tekilleştirme anahtarıdır.
    let pageId = null;
    for (const a of links) {
      const m = a.href.match(/view_all_page_id=(\d+)/);
      if (m) {
        pageId = m[1];
        break;
      }
    }

    // Reklam veren adı: Facebook Ads Library dahili linkleri olmayan,
    // içinde metin bulunan ilk facebook.com bağlantısı.
    const advertiserLink = links.find((a) => {
      const href = a.href || "";
      const label = textOf(a);
      return (
        href.includes("facebook.com") &&
        !href.includes("/ads/library") &&
        !href.includes("/policies/") &&
        !href.includes("/help/") &&
        label.length > 0 &&
        label.length < 120
      );
    });

    const advertiserName = advertiserLink ? textOf(advertiserLink) : null;
    const advertiserUrl = advertiserLink ? advertiserLink.href.split("?")[0] : "";

    return { advertiserName, advertiserUrl, pageId };
  }

  function extractAdData(card) {
    const fullText = textOf(card);
    if (!fullText.includes("Library ID")) return null;

    const { advertiserName, advertiserUrl, pageId } = extractAdvertiser(card);
    if (!advertiserName) return null;

    const libraryIdMatch = fullText.match(/Library ID:\s*([0-9]+)/i);
    const startedMatch = fullText.match(/Started running on\s*([^\n·|]+?)(?:\s{2,}|·|$)/i);
    const statusMatch = fullText.match(/\b(Active|Inactive|Aktif|Devre dışı)\b/);
    const platformsMatch = fullText.match(/Platforms\s*([^\n]+)/i);

    return {
      advertiserName: advertiserName.trim(),
      advertiserUrl,
      pageId: pageId || "",
      libraryId: libraryIdMatch ? libraryIdMatch[1] : "",
      status: statusMatch ? statusMatch[1] : "",
      startedRunning: startedMatch ? startedMatch[1].trim() : "",
      platforms: platformsMatch ? platformsMatch[1].trim() : "",
      pageUrl: location.href,
      scrapedAt: new Date().toISOString(),
    };
  }

  function dedupeKey(record) {
    return record.pageId ? `id:${record.pageId}` : `name:${record.advertiserName.toLowerCase()}`;
  }

  async function saveRecords(newRecords) {
    if (newRecords.length === 0) return;

    const result = await chrome.storage.local.get(STORAGE_KEY);
    const store = result[STORAGE_KEY] || {};
    let added = 0;

    for (const record of newRecords) {
      const key = dedupeKey(record);
      if (!store[key]) {
        store[key] = record;
        added++;
      }
    }

    if (added > 0) {
      await chrome.storage.local.set({ [STORAGE_KEY]: store });
      totalCountCache = Object.keys(store).length;
      chrome.runtime.sendMessage({ type: "FB_ADS_COUNT_UPDATED", count: totalCountCache }).catch(() => {});
    }
  }

  function scanNow() {
    scanScheduled = false;
    const cards = findAdCards();
    const fresh = [];

    for (const card of cards) {
      if (PROCESSED_ELEMENTS.has(card)) continue;
      const data = extractAdData(card);
      if (data) {
        PROCESSED_ELEMENTS.add(card);
        const key = dedupeKey(data);
        if (!SEEN_KEYS_IN_MEMORY.has(key)) {
          SEEN_KEYS_IN_MEMORY.add(key);
          fresh.push(data);
        }
      }
    }

    if (fresh.length > 0) saveRecords(fresh);
  }

  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    setTimeout(scanNow, 700); // sayfa kaydırılırken gelen çoklu DOM değişikliklerini tek seferde işlemek için debounce
  }

  const observer = new MutationObserver(() => scheduleScan());
  observer.observe(document.body, { childList: true, subtree: true });

  // İlk yüklemede mevcut kartları da tara.
  scheduleScan();
})();
