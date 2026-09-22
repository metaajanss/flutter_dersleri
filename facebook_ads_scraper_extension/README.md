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
   kelimeyle arama açar (**ayrı, küçültülmüş bir pencerede** — ekranınıza
   çıkmaz, odağınızı almaz) ve sayfayı kendi kendine aşağı kaydırmaya
   başlar.
4. Kaydırma arka planda devam eder (popup'ı kapatsanız, başka bir sekmeye/
   pencereye geçseniz, hatta o pencere tamamen başka bir pencerenin
   arkasında kalsa bile durmaz). İlerlemeyi iki yerden takip edebilirsiniz:
   - **Araç çubuğundaki eklenti simgesinin rozeti (badge)**: toplama
     sırasında toplanan sayıyı, zenginleştirme sırasında kalan kayıt
     sayısını (`K12` gibi) her an gösterir — popup'ı açmanıza gerek yok.
   - **Popup'ı tekrar açtığınızda**: "Toplanan/Hedef · Kalan" bilgisini ve
     bir ilerleme çubuğunu görürsünüz. İstediğiniz an **Otomasyonu
     Durdur** ile durdurabilirsiniz.

   **Bu nasıl mümkün oluyor?** Kaydırma döngüsü sayfanın kendi
   JavaScript'i içinde değil, eklentinin arka plan servisinde
   (`background.js`) çalışır: `chrome.alarms` ile periyodik olarak
   tetiklenip `chrome.scripting.executeScript` ile doğrudan sekmeye
   "kaydır ve tara" komutu gönderir. Chrome'un sekme görünürlüğüne bağlı
   zamanlayıcı kısıtlaması (arka plandaki/görünmeyen sekmelerde
   `setTimeout`/`requestAnimationFrame`'i durdurması) yalnızca SAYFANIN
   KENDİ zamanlayıcılarını etkiler; eklentinin dışarıdan tetiklediği tekil
   komutlar bu kısıtlamaya tabi değildir. Bu yüzden pencereyi hiç
   görmeseniz de otomasyon ilerlemeye devam eder.
5. "Tüm sonuçları çek" seçiliyse, art arda birkaç kaydırmada yeni reklam
   veren gelmeyince (sayfanın sonuna gelindiği anlaşılınca) otomasyon kendi
   kendine durur. "Belirli adet" seçiliyse hedef adede ulaşınca durur.
6. **Excel'e Aktar (.xlsx)** butonuna basarak veriyi indirin.
7. Gerekirse **Verileri Temizle** ile birikmiş veriyi sıfırlayın.

Not: Sayfayı manuel olarak `facebook.com/ads/library` adresinde gezinirken
de (arama başlatmadan) eklenti gördüğü reklamları arka planda otomatik
tarar — anahtar kelimeli otomatik kaydırma isteğe bağlı bir kolaylıktır.

## Zenginleştirme: e-posta/telefon bulma

Toplama bittikten sonra **Zenginleştir (E-posta/Telefon Bul)** butonuna
basarsanız, eklenti toplanan her reklam verenin Facebook sayfasındaki
**"İletişim ve Temel Bilgiler"** (`about_contact_and_basic_info`)
bölümüne sırayla gider ve orada herkese açık olarak görünen e-posta/
telefon varsa çeker:

1. Önce sayfadaki `mailto:` / `tel:` linklerine bakar (en güvenilir kaynak).
2. Bulamazsa sayfa metninde basit bir e-posta/telefon deseni arar.
3. Bilgi bulunamazsa (çoğu sayfa bu bilgiyi paylaşmaz) ilgili hücreler boş
   kalır — bu normaldir.

Bu işlem, **sizin zaten giriş yapmış olduğunuz tarayıcı oturumunuzla**
sayfaları ziyaret ederek çalışır (tıpkı sizin o sayfaları elle
ziyaret etmeniz gibi); eklenti başka bir hesaba giriş yapmaz, şifre
istemez, gizli/özel bilgiye erişmez — yalnızca sayfanın herkese açık
gösterdiği bilgiyi okur.

Zenginleştirme de arama otomasyonuyla aynı `chrome.alarms` +
`chrome.scripting.executeScript` mekanizmasını kullanır (kendi ayrı
penceresinde), bu yüzden o pencereye bakmasanız da arka planda ilerler.
Bulunan e-posta/telefon, Excel export şablonundaki `email`/`phone`
sütunlarına otomatik olarak yazılır. **Zenginleştirmeyi Durdur** ile
istediğiniz an durdurabilir, kalan kayıtları daha sonra tekrar
**Zenginleştir**'e basarak kaldığı yerden (zaten işlenmiş kayıtları
atlayarak) devam ettirebilirsiniz.

⚠️ Bu, Facebook'un normalde tek tek elle yapacağınız bir gezinmeyi
otomatikleştirir; çok sayıda sayfayı hızlı art arda ziyaret etmek
Facebook'un hız sınırlama/otomasyon tespiti mekanizmalarını
tetikleyebilir. Büyük listelerde makul aralıklarla (varsayılan ~5
saniye/sayfa) çalıştırmanız ve gerekirse ara vermeniz önerilir.

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
| 3 | `email` | "Zenginleştir" ile bulunursa, yoksa boş | ornek@firma.com |
| 4 | `phone` | "Zenginleştir" ile bulunursa, yoksa boş | +90 555 555 55 55 |
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
- Otomatik kaydırma yaklaşık her ~3 saniyede bir adım atar; çok büyük sonuç
  kümelerinde (binlerce reklam) tüm veriyi toplamak zaman alabilir.
- Kaydırma döngüsü `chrome.alarms` ile 1 dakikanın çok altında bir periyotta
  çalışır. Chrome normalde alarmları 1 dakikadan sık çalıştırmaya izin
  vermez; bu kısıtlama yalnızca **paketlenmemiş (geliştirici modunda
  yüklenmiş) eklentiler** için kaldırılmıştır. Bu eklentiyi Chrome Web
  Store'a paketleyip yayımlarsanız kaydırma periyodu otomatik olarak
  1 dakikaya çıkar ve toplama çok yavaşlar — eklenti "Paketlenmemiş öğe
  yükle" ile kullanılmak üzere tasarlanmıştır.
- Sekme kapatılırsa veya kaydedilen `tabId` artık geçerli değilse
  otomasyon kendini otomatik olarak durdurur.
