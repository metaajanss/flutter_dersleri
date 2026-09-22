# Facebook Ads Library Reklam Veren Çekici (Chrome Eklentisi)

Facebook Ads Library'de verdiğin bir anahtar kelimeyle otomatik arama açar,
sayfayı kendi kendine aşağı kaydırarak aktif reklamların reklam veren
bilgilerini toplar, aynı reklam vereni tekrar kaydetmez ve toplanan veriyi
tek tıkla Excel (.xlsx) dosyası olarak dışa aktarır.

## Kurulum

1. Chrome'da `chrome://extensions` adresine gidin.
2. Sağ üstten **Geliştirici modu**'nu açın.
3. **Paketlenmemiş öğe yükle** butonuna tıklayın ve bu klasörü
   (`facebook_ads_scraper_extension`) seçin.

## Kullanım

1. Eklenti simgesine tıklayın, **Anahtar Kelime** kutusuna arama teriminizi
   yazın (örn. "spor ayakkabı").
2. **Toplama Miktarı** olarak "Tüm sonuçları çek" ya da "Belirli adet çek"
   (adet girerek) seçin.
3. **Aramayı Başlat ve Topla** butonuna basın: eklenti otomatik olarak
   `facebook.com/ads/library` üzerinde aktif reklamlar için o anahtar
   kelimeyle arama açar (**ayrı bir pencerede**) ve sayfayı kendi kendine
   aşağı kaydırmaya başlar.
4. Kaydırma arka planda devam eder (popup'ı kapatsanız bile durmaz).
   Popup'ı tekrar açtığınızda güncel "toplanan / hedef" durumunu görürsünüz.
   İstediğiniz an **Otomasyonu Durdur** ile durdurabilirsiniz.

   **⚠️ Önemli — tarayıcı kısıtlaması:** Chrome, seçili olmayan sekmelerde
   (aynı pencerede başka sekmeye geçtiğinizde) ve küçültülmüş pencerelerde
   JavaScript zamanlayıcılarını durdurur; Facebook da sayfa görünür değilken
   yeni reklam yüklemeyi keser. Bu yüzden otomasyon **ayrı bir pencerede**
   çalışır — o pencereyi **küçültmeden** arkada/kenarda bırakıp başka bir
   pencerede (veya sekmede, farklı bir Chrome penceresinde) çalışmaya devam
   edebilirsiniz; otomasyon durmaz. Ancak o pencereyi küçültürseniz veya
   içindeki sekmeyi değiştirirseniz kaydırma duracaktır — bu Chrome/Facebook
   kaynaklı bir davranıştır, eklenti tarafından aşılamaz.
5. "Tüm sonuçları çek" seçiliyse, art arda birkaç kaydırmada yeni reklam
   veren gelmeyince (sayfanın sonuna gelindiği anlaşılınca) otomasyon kendi
   kendine durur. "Belirli adet" seçiliyse hedef adede ulaşınca durur.
6. **Excel'e Aktar (.xlsx)** butonuna basarak veriyi indirin.
7. Gerekirse **Verileri Temizle** ile birikmiş veriyi sıfırlayın.

Not: Sayfayı manuel olarak `facebook.com/ads/library` adresinde gezinirken
de (arama başlatmadan) eklenti gördüğü reklamları arka planda otomatik
tarar — anahtar kelimeli otomatik kaydırma isteğe bağlı bir kolaylıktır.

## Toplanan alanlar (dahili depolama)

Eklenti, sayfayı tararken her reklam veren için şu bilgileri toplayıp
tarayıcı içinde saklar:

- Reklam Veren Adı
- Sayfa Bağlantısı (facebook.com/... profil linki)
- Sayfa ID (varsa, `view_all_page_id` parametresinden)
- Library ID
- Durum (Active/Inactive)
- Başlangıç Tarihi ("Started running on ...")
- Platformlar
- Aranan anahtar kelime
- Toplandığı sayfanın URL'si
- Toplanma zamanı

## Excel export şablonu

Dışa aktarılan `.xlsx` dosyası, aşağıdaki sabit şablon sütun sırasıyla
üretilir:

| # | Sütun | Kaynak | Örnek |
|---|-------|--------|-------|
| 1 | `first_name` | Reklam veren (sayfa) adı | Example Inc |
| 2 | `last_name` | (boş) | |
| 3 | `email` | (boş — FB Ads Library'de e-posta yok) | |
| 4 | `phone` | (boş) | |
| 5 | `company` | Reklam veren (sayfa) adı | Example Inc |
| 6 | `web_link` | Sayfa bağlantısı | https://example.com |
| 7 | `facebook_ads_library_id` | Library ID | 123456789012345 |

Reklam veren (sayfa) adı hem `first_name` hem `company` sütununa
yazılır. `last_name`, `email`, `phone` sütunları Facebook Ads
Library'nin sağlamadığı bilgiler olduğu için boş bırakılır; dışa
aktarılan dosyada bu sütunlar CRM'e elle veya başka bir kaynaktan
doldurulmak üzere yer tutar.

## Tekilleştirme mantığı

Her reklam kartı için önce **Sayfa ID** (Facebook'un `view_all_page_id`
parametresi) aranır; bulunamazsa **reklam veren adı** (küçük harfe çevrilip
boşluklar kırpılarak) anahtar olarak kullanılır. Bir anahtar daha önce
kaydedilmişse o reklam veren bir daha eklenmez — yalnızca ilk görülen kaydı
tutulur.

## Notlar / Sınırlamalar

- Facebook, Ads Library sayfasının DOM yapısını zaman zaman değiştirebilir.
  Eklenti, "Library ID:" metnini ve reklam veren profiline giden linkleri
  temel alan sağlam (heuristic) bir tarama yapar; sayfa yapısı çok köklü
  şekilde değişirse `content.js` içindeki `findAdCards` / `extractAdData`
  fonksiyonlarının güncellenmesi gerekebilir.
- Veriler tarayıcının yerel depolamasında (`chrome.storage.local`) tutulur;
  eklenti/tarayıcı verileri temizlenirse kayıtlar da silinir.
- `.xlsx` dosyası harici bir kütüphane kullanılmadan (SheetJS vb. yüklenmeden)
  doğrudan bu eklenti içinde (`xlsx-writer.js`) üretilir; ağ bağlantısı veya
  uzak betik gerektirmez.
- Otomatik arama URL'i varsayılan olarak tüm ülkeleri (`country=ALL`) hedefler
  ve yalnızca aktif reklamları (`active_status=active`) getirir. Belirli bir
  ülkeyle sınırlamak isterseniz `popup.js` içindeki `buildAdsLibraryUrl`
  fonksiyonunda `country` parametresini (örn. `TR`) değiştirebilirsiniz.
- "Tüm sonuçları çek" modunda bitiş tespiti, art arda birkaç kaydırmada yeni
  benzersiz reklam veren gelmemesine dayanır (heuristic); Facebook'un
  sonsuz kaydırması gerçekten bittiyse otomasyon kendini durdurur, ancak çok
  yavaş yüklenen bağlantılarda nadiren erken durabilir — bu durumda sayfayı
  elle biraz kaydırıp yeniden "Aramayı Başlat" ile devam edilebilir.
- Otomatik kaydırma her adımda ~1.5-2 saniye bekler; çok büyük sonuç
  kümelerinde (binlerce reklam) tüm veriyi toplamak zaman alabilir.
