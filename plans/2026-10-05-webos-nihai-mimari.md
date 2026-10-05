# Nuvio webOS nihai performans mimarisi

Durum: aktif plan, 5 Ekim 2026. Önceki planın yerine geçer:
[ara optimizasyon planı](2026-10-05-ara-optimizasyon-plani.md).
İş durumunun tek kaynağı: [WEBOS_IS_TAKIBI.md](../WEBOS_IS_TAKIBI.md).

## Amaç ve kapsam

LG OLED55CS3VA'da Home gezinmesi ve detail/stream geçişleri için ilk ekran
oluşturma, input, layout/paint ve retained DOM maliyetini sınırlamak. Modern
Home ilk uygulama hedefi; Classic, CW split, collections ve Grid aynı sözleşmeye
ayrı layout adapter'larıyla geçecek. Auth/profil/addon/native player davranışı
korunur. IPTV bu kabul tamamlandıktan sonra başlar.

## Mimari kararlar

1. İçerik ve navigasyon kaynağı veri modelidir: stable rowKey + media identity
   + logical index. Navigation model, route state, pagination ve cache DOM
   düğümlerini taşımaz. Modern hero dekoratif; Classic hero navigable.
2. Renderer yalnız görünür satır/kart aralıklarını ve küçük overscan'ı oluşturur.
   Odaklı uzak öğe gerektiğinde ayrı küçük aralıkla pin edilir; 200. karta
   dönmek 0..200 prefix'ini oluşturmamalı. Çıkan kartın DOM/observer/medya
   işi bırakılır; detached kart kütüphanesi tutulmaz.
3. Mantıksal veri sayısı API skip/nextSkip ve append sayımının kaynağıdır.
   Mounted DOM sayısı pagination kararı olamaz. Yatay ölçüler layout sizing'den;
   değişken dikey ölçüler tahmin + mounted ölçüm ledger'ından gelir.
4. Yeni veri ilgili satırı/hero/section'ı günceller. Her addon sonucunda full
   Home markup, full navigation rebuild veya focus sınıf taraması yapılmaz.
5. Kritik yükleme önce görünür Home ve base Detail'dır. UI chunk prefetch
   kısa girişsiz süre + idle ile yapılır; metadata mevcut repo dedup/cache ile
   paylaşılır. Cast/öneriler/ratings/trailer gibi opsiyonel işler sonra.
6. Paint sonrası iş main thread'dedir; background fetch ayrı CPU thread'i
   değildir. Büyük işler küçük bütçeli parçalar halinde, stale generation/abort
   kontrollü yürütülür. Cache boyut/TTL ve sahiplik açık olur.

## Aşamalar ve bağımlılıklar

| Aşama | İçerik | Bağımlılık | Çıkış ölçütü |
| --- | --- | --- | --- |
| A0 | Kaynak sözleşmeleri, DOM bağımlılık haritası, başlangıç testleri | Yok | Ajan raporları + takip tablosu |
| A1 | Saf pencere hesapları ve mantıksal odak modeli | A0 | Reorder/remove/empty/200. öğe/boundary/gap testleri |
| A2 | Row/item veri adapter'ı, ölçüm ledger'ı, renderer | A1 | İlk render 20×100 fixture'da bütün kartları oluşturmaz |
| A3 | Kumanda/scroll/return/hold/sidebar/pagination entegrasyonu | A2 | Nav ve snapshots DOM referansı tutmaz; kimlik dönüşü korunur |
| A4 | Full render yolunun kaldırılması, veri geldiğinde küçük güncelleme | A3 | Katalog chunk'ı yalnız etkilenen satırı değiştirir |
| A5 | Detail/stream öncelik, cancellation, bounded caches | A0 bulguları; A2 ile bağımsız alt işler | İlk paint opsiyonel veriyi beklemez; stale iş veri yazmaz |
| A6 | Classic/Grid/collections/CW split kapsamı ve gerçek TV kabulü | A3/A4/A5 | Kumanda, bellek ve frame ölçümleri + regresyonlar |

A1 modüllerinin testinin geçmesi A2/A3'ün uygulanması veya TV'nin iyileştiği
anlamına gelmez. Takipte her aşama ayrı durum taşır.

## Doğrulama ve kabul

- 20 satır × 100 kart: ilk markup üretimi ve canlı DOM görünen pencereyle
  sınırlı; uzak kartlar önce oluşturulup detach edilmez. Büyük veri artışıyla
  mounted/retained DOM sayısı artmamalı. Veri belleği ayrıca ölçülür.
- 200. öğe → detail → Back: aynı row/media identity, logical index ve track/main
  scroll; prefix remount yok. Reorder sonrası identity, silinince mantıksal fallback.
- Sona/başa, boş satır, append/duplicate API sayfası, CW/upcoming split,
  collections, hold menü, sidebar, Magic Remote hover/wheel ve hızlı dikey kaydırma.
- Navigation/cache/route state içinde Element/Node referansı yok; çıkan pencerenin
  image/trailer/observer/timer işi kalmaz. 20 Home-detail-stream geçişi sonrası
  kontrollü GC/heap varsa retained DOM karşılaştırması yapılır.
- TV'de aynı profil/veri/layout ile en az 3, tercihen 5 tekrar; warm ve cold
  ayrı. Kumanda ile sentetik event sonuçları ayrı yazılır. Tek rAF örneği gerçek
  piksel sunumu veya genel hızlanma kanıtı değildir.
- İlk hedef bütçeleri: input handler p95 <16,7 ms; gezinme rAF p95 ≤33,4 ms.
  Hedefler ölçüm kriteridir, mevcut başarım iddiası değildir. Max frame/long task,
  scripting/layout/paint ve ilk detail/video karesi ayrıca kaydedilir.
- Modern veri renderer'ı build/lint/test ve izole DOM kontrollerinden sonra
  TV'ye yüklendi; kurulu Home ve 20. karttan detail/Back smoke geçti. Classic/Grid
  eski cache yolundadır. Bu milestone tam TV performans kabulü değildir;
  yeni paketler aynı doğrulama ve somut cihaz senaryolarıyla ilerler.

## Ajan çalışma kuralları

Her işin sahibi, dosya sınırı, bağımlılığı, testi, sonucu ve sonraki adımı iş
panosunda tutulur. Ajanlar aynı dosyayı eşzamanlı değiştirmez. Root integration
ve nihai doğrulamadan sorumludur. Mevcut uncommitted değişiklikler korunur;
stage/commit/push istenmedi. Secret/hesap bilgileri rapora girmez.

## Devam kaydı protokolü

Aşama teslimi, anlamlı başarısız test, mimari karar ve context daralması öncesinde
[devam notları](../WEBOS_DEVAM_NOTLARI.md) güncellenir. Son adım, dosyalar, test
komut/sonuçları, pending tool/ajanlar, bilinen risk, tekrar yapılmaması gereken
iş ve tam sonraki komut yazılır. Compaction'da kaybolabilecek cihaz bağlantısı,
çalışan Inspector'ın yeniden bulunma yöntemi ve geçici testlerin rolü kaydedilir.
Terminal çıktısı ve credential dökülmez. Yeni ajan önce plan + iş panosu + devam
notlarını okur, eski planı aktif plan sanmaz.
