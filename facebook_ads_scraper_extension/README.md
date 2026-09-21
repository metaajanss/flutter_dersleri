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

## Jumpix'e otomatik lead gönderme (webhook)

Toplanan her reklam vereni, Jumpix'in webhook adresine otomatik olarak
JSON POST ile "lead" gibi gönderebilirsiniz.

1. Popup'ta **Jumpix Webhook URL** kutusuna Jumpix'ten aldığınız webhook
   adresini yapıştırın.
2. **Yeni reklam veren bulundukça otomatik olarak Jumpix'e lead gönder**
   kutucuğunu işaretleyin (isterseniz sadece elle "Şimdi Gönder" ile
   kullanmak için işaretlemeden de bırakabilirsiniz).
3. **Webhook Ayarını Kaydet** butonuna basın. Chrome, o adrese veri
   gönderme izni ister (tarayıcı CORS kısıtlamasını aşmak için bu izin
   gereklidir) — **İzin Ver**e tıklayın.
4. Bundan sonra otomatik kaydırma sırasında bulunan **her yeni** (daha önce
   gönderilmemiş) reklam veren, bulunur bulunmaz Jumpix'e gönderilir.
5. Daha önce toplanmış ama henüz gönderilmemiş kayıtları toplu göndermek
   isterseniz **Toplanan Tüm Kayıtları Şimdi Gönder** butonunu kullanın.
6. Bir kayıt Jumpix'e başarıyla gönderildiğinde `jumpixSent: true` olarak
   işaretlenir ve **aynı reklam veren için lead bir daha gönderilmez**
   (aynı tekilleştirme anahtarı — Sayfa ID veya reklam veren adı — kullanılır).

### Gönderilen JSON alanları

Jumpix'in tam olarak hangi alan adlarını beklediğini bilmediğimiz için
(genel bir API dokümantasyonuna ulaşamadım), her ihtimale karşı yaygın
CRM/lead alan adlarıyla genel bir JSON gönderiliyor (`background.js` →
`buildJumpixPayload`):

```json
{
  "source": "facebook_ads_library",
  "name": "Reklam Veren Adı",
  "lead_name": "Reklam Veren Adı",
  "company_name": "Reklam Veren Adı",
  "facebook_page_url": "https://facebook.com/...",
  "facebook_page_id": "1234567890",
  "library_id": "9876543210",
  "ad_status": "Active",
  "started_running": "20 Sep 2026",
  "platforms": "Facebook, Instagram",
  "search_keyword": "spor ayakkabı",
  "collected_from_page": "https://www.facebook.com/ads/library/?...",
  "collected_at": "2026-09-21T10:00:00.000Z"
}
```

Jumpix webhook'unuz farklı alan adları bekliyorsa (örn. `ad`, `unvan`,
`firma_adi` gibi), `background.js` içindeki `buildJumpixPayload`
fonksiyonunu kendi alan adlarınıza göre güncellemeniz yeterlidir — istekle
birlikte bu eşlemeyi de güncelleyebilirim.

## Toplanan alanlar

- Reklam Veren Adı
- Sayfa Bağlantısı (facebook.com/... profil linki)
- Sayfa ID (varsa, `view_all_page_id` parametresinden)
- Library ID
- Durum (Active/Inactive)
- Başlangıç Tarihi ("Started running on ...")
- Platformlar
- Toplandığı sayfanın URL'si
- Toplanma zamanı

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
