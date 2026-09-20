# Facebook Ads Library Reklam Veren Çekici (Chrome Eklentisi)

`facebook.com/ads/library` sayfasında gezinirken, aşağı kaydırdıkça yüklenen
reklamlardan reklam veren (sayfa) bilgilerini otomatik olarak toplar, aynı
reklam vereni tekrar kaydetmez ve toplanan veriyi tek tıkla Excel (.xlsx)
dosyası olarak dışa aktarır.

## Kurulum

1. Chrome'da `chrome://extensions` adresine gidin.
2. Sağ üstten **Geliştirici modu**'nu açın.
3. **Paketlenmemiş öğe yükle** butonuna tıklayın ve bu klasörü
   (`facebook_ads_scraper_extension`) seçin.

## Kullanım

1. `https://www.facebook.com/ads/library/...` adresinde bir arama açın.
2. Sayfayı aşağı kaydırdıkça yeni reklamlar yüklenir; eklenti bunları arka
   planda otomatik tarar (araç çubuğundaki simgede sayaç görünür).
3. Eklenti simgesine tıklayıp toplanan **benzersiz reklam veren sayısını**
   görün.
4. **Excel'e Aktar (.xlsx)** butonuna basarak veriyi indirin.
5. Gerekirse **Verileri Temizle** ile birikmiş veriyi sıfırlayın.

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
