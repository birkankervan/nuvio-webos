# webOS derin inceleme ve uygulama kaydı

5 Ekim 2026. Önceki değişiklikler korunarak Home, router/build, detail kaynak
geçişi, stream üretimi/render ve player lifecycle yolları satır düzeyinde izleniyor.
Bu dosya tüm deponun her satırının incelendiği iddiası değildir; kapsanan dosyalar
ve doğrulanan sonuçlar aşağıda kayıtlıdır.

## Doğrulanan bulgular ve çözümler

| Alan | Bulgu | Çözüm | Doğrulama durumu |
| --- | --- | --- | --- |
| Router/build | Bütün ekranlar statik import; IIFE build içinde dynamic import tek başına code splitting sağlamaz. | Modern webOS için ESM chunk build ve talep üzerine ekran import; eski motor için mevcut IIFE fallback. | Uygulandı; doğrulama ayrıntıları aşağıda. TV'nin packaged file scheme dynamic import desteği mevcut QR script'iyle doğrulandı. |
| Home | Bütün satırlar DOM'da; 31 satır/462 kart gerçek cihazda doğrulandı. | Görünür satır + overscan penceresi; uzak satır yerine boyut koruyan spacer; hedef satırı focus öncesi mount et. | Uygulandı; doğrulama ayrıntıları aşağıda. İlk katman satır DOM'unu cache'ler; heap tasarrufu iddiası yok. |
| Stream | Sanallaştırma ancak 100 kaynaktan sonra; 30–100 kaynakta tam liste her sonuç grubunda yeniden çizilir. | TV'de daha erken pencere kullan; pencere minimumunu ve focus davranışını koru. | Uygulandı; doğrulama ayrıntıları aşağıda. |
| Stream | Her addon chunk'ı bütün stream dizisini merge/sort eder. Render debounce bu işi azaltmaz. | İlk sonuç hemen, sonraki sonuçlar kısa gruplama aralığında topluca merge/sort. | Uygulandı; doğrulama ayrıntıları aşağıda. |
| Stream lifecycle | Aynı mount içinde yeniden yükleme aynı loadToken'ı kullanır; abort'u dikkate almayan eski üretici yeni sonuçları kirletebilir. | Her load için token artır; timer/abort/controller sahipliğini cleanup'ta bırak. | Uygulandı; doğrulama ayrıntıları aşağıda. |
| Stream render | Değişen liste tüm backdrop/chip/panel kabuğunu innerHTML ile değiştirir; odak ve scroll tekrar kuruluyor. | Mevcut keyed DOM reconciliation'ı stream kabuğuna da uygula; kaynak kimliğiyle satırları koru. | Uygulandı; doğrulama ayrıntıları aşağıda. |
| Stream cleanup | Gizlenen DOM temizlense bile singleton streams/filter cache/param referansları retained data tutar. Debrid preparation timeout'unun handle'ı tutulmaz. | Timeout'u iptal et; geçersiz load'u bloke et; route state yakalandıktan sonra büyük dizileri/cache'leri bırak. | Uygulandı; doğrulama ayrıntıları aşağıda. |
| Detail cleanup | Token geç sonuçları blokluyor ama meta/episodes/pending stream selection referansları singleton'da kalıyor. | Request generation'ı geçersiz kıl ve ekran verisi/DOM referanslarını bırak. | Uygulandı; doğrulama ayrıntıları aşağıda. |
| Player cleanup | UI kaldırılıyor; streamCandidates ve episode/track dizilerinin bazıları singleton'da kalıyor. | Teardown bittikten sonra büyük route verisini bırak; native player stop sırasını koru. | Uygulandı; doğrulama ayrıntıları aşağıda. |
| Başlangıç | Profil girişinde bütün badge kuralları için görsel warmup yapılıyor; Home için gerekmiyor. | Görselleri stream yolunda görünen kaynaklara göre talep üzerine yükle. | Uygulandı; doğrulama ayrıntıları aşağıda. |

## Yanlış teşhislerden kaçınma

- Generated helper dosyalarındaki kullanılmayan import listeleri kaynakta gürültü;
  esbuild tree shaking bunları otomatik atabilir. Silinmeleri tek başına runtime
  hızlanması veya leak giderimi sayılmayacak.
- Home'un display:none back-stack cache'i bilinçli davranış; doğrudan leak denmez.
  İlk satır penceresi layout/paint maliyetini azaltır, cache'teki toplam DOM heap'ini
  azaltmaz. Yatay kart birikimi ve ilk markup üretimi ayrıca ele alınmalı.
- Detail'in `openMovieStreamChooser/openEpisodeStreamChooser` metotları aktif
  akışta ayrı Stream route'una gidiyor. Eski inline chooser render kodu var diye
  kullanıcının kasmasını o koddan geldi kabul etmiyoruz.
- Long task ve frame gecikmesi DOM ile birlikte gözlendi; bunlar tek başına
  DOM'un yegâne neden olduğunu ispatlamaz.
- Yeni build'in TV'ye kurulumu ve A/B doğrulaması ayrı adım; mevcut TV paketine
  kaynak değişiklikleri sessizce yazılmayacak.

## Ek lifecycle bulguları

- RouteStateStore Map'inin boyut sınırı yoktu. Farklı içerik detaylarının büyük
  snapshot'ları süre sınırı olmadan tutulabiliyordu. Son kullanılan 12 snapshot
  ile sınırlandı; erişim sırası LRU, silinen kayda dönüşte normal yeniden yükleme.
- Home truncation resize listener'ı ekran dışında da çalışabiliyordu; artık
  cleanup'ta kaldırılıyor. fonts.ready callback'i route ve load token ile korunuyor.
- Eski stream üreticisinin rejection yolu yeni yüklemenin ortak timer'ını
  iptal edebilirdi. Flush önce generation kontrolü yapıyor; regresyon testi
  yeni batch timer'ının korunduğunu doğruluyor.
- Home spacer boyutu ilk gerçek tarayıcı kontrolünde kaydırma yüksekliğini
  değiştirdi. Ölçülen border-box yüksekliği ve computed margin korunarak düzeltildi.

## Uygulanan eşikler ve kapsam

- TV kaynak listesinde pencere eşiği 100 yerine 24 kaynak. Browser eşiği 100.
- İlk kaynak grubu hemen yayınlanır; sonraki gruplar 120 ms içinde birleştirilir.
- Home Modern/Classic TV layout'larında dikey satır penceresi var; görünür alanın
  çevresinde en az 240 px overscan, odaklı satır her zaman korunur. Grid kapsam dışı.
- Hedef satır focus öncesi mount edilir; navigation modeli detached satırların
  kimliklerini korur. Render/geri dönüş/cleanup satırları restore eder.
- Detail, stream, player, settings ve diğer ikincil ekranlar talep üzerine
  import edilir. Home ve giriş ekranları başlangıçta kalır. Tizen eski bundle'ı kullanır.
- Stream kabuğu ve aynı kimlikli kaynak satırları korunur; virtualization'ın
  küçük liste penceresi kendi render yolunu kullanmaya devam eder.
- Player/detail/stream teardown büyük dizileri ve DOM referanslarını bırakır.
  Router history/params ve Home geri dönüş cache'i ayrıca veri tutabilir;
  heap'in tümü boşalıyor iddiası yoktur.

## Doğrulama

- Yedi Node testi başarılı: lazy import tekilleştirme/retry, geç gelen lazy
  navigation, snapshot LRU, Home repeat/image queue ve stream chunk lifecycle.
- LG TV Chromium 132'de geçici, izole DOM harness: **11/11 kontrol başarılı**.
  30 satırın **5'i mounted**, 3000 px toplam yükseklik korunuyor; yatay kaydırma,
  hedef mount/focus, cleanup restore ve kaynak kabuğu/satır kimliği kontrol edildi.
  Bu yeni uygulamanın bütün gezinme entegrasyonunun veya FPS'inin testi değildir.
- Modern başlangıç import graph'ında detail/stream/player/settings UI yok.
  İlk JS yaklaşık **1,264 MB**, eski tek bundle **3,215 MB**: **%60,7 daha az**.
  Bu sıkıştırılmamış uygulama JS'i; core-js/CSS/görseller dahil değil. 64 statik
  module dosyasının yükleme maliyeti TV A/B testinde ölçülecek.
- Lint, build, webOS IPK üretimi ve diff whitespace kontrolü başarılı.
  Paket loader/chunk dosyaları staging'e dahil; bu doğrulama sırasında yeni paket henüz TV'ye kurulmamıştı; son kurulum kaydı aşağıda.

## Açık işler ve ölçüm sınırları

1. Yeni build ile gerçek kumanda, hızlı gezinme, hover/wheel, pagination ve
   detail'dan geri dönüş A/B testleri. Mevcut TV baseline değişmiş build sonucu değildir.
2. Soğuk açılış, detail → kaynak → ilk video karesi zamanlaması; ağ bekleme,
   JS/main-thread ve decoder hazırlığının ayrı ölçülmesi.
3. Home ilk markup hâlâ bütün satırları oluşturuyor; detached DOM cache toplam
   heap'i azaltmaz. Yatay kart penceresi aşağıdaki ek turda uygulandı; veri üzerinden remount sonraki adım.
4. Grid, Search, Library, See All ve player alt panelleri aynı ayrıntıda
   incelenmedi. Tüm repo satır satır bitmiş kabul edilmemeli.
5. Gerçek hesaba uygun local.properties olmadan örnek config ile paket üretiliyor.
   IPTV çalışması performans doğrulamasından sonra.

## TV kurulumu — 5 Ekim 2026

Kullanıcının kurulum isteğiyle `space.nuvio.webos_1.2.2_all.ipk` kayıtlı
LG OLED55CS3VA cihazına başarıyla kuruldu ve uygulama açıldı.
Inspector'da document readyState complete ve module app.module.js script'i doğrulandı.
Home görünümünde **3 aktif katalog satırı, 42 kart, 28 spacer** gözlendi.
Önceki baseline 31 satır/462 karttı; bu açılış örneği DOM penceresinin gerçek
uygulamada çalıştığını gösterir. Aynı içerik/odakla kontrollü FPS veya video
ilk-kare karşılaştırması yapılmadığından hızlanma yüzdesi iddiası yoktur.

## Hero, iki eksenli pencere ve detail yükleme — ikinci iyileştirme turu

### Bulgu ve uygulama

- `applyHeroToDom` innerHTML/textContent ile yeni düğümler oluşturuyordu.
  Keyed updater bunları kayıtsız runtime media sanıp korurken yeni markup'ı da
  ekleyebiliyordu. Hero title/meta/secondary/chip/description/indicator düğümleri
  güncelleme sonrasında kaydediliyor. Truncation'ın değiştirdiği Text düğümleri
  updater'da managed copy olarak ele alınıyor; trailer/transition media korunuyor.
- Home Modern/Classic satırlarında **yatay kart penceresi** eklendi. Görünmeyen
  kart yerine ölçülü inert spacer var. Mantıksal kart listesi nav/pagination için
  korunuyor; hedef kart focus öncesi mount ediliyor. Scroll listener'ları cleanup'ta
  kaldırılır, append sonrasında pencere listesi yenilenir.
- CW/catalog pagination sayımı artık connected DOM sayısına bağlı değil.
  Focus snapshot mantıksal navCol saklar. Row geometry bağlı temsilci karttan
  okunur; pencere dışındaki ilk kartın offset'i kullanılmaz.
- Ölçüm ve DOM yazmaları gruplandı; satır yeniden attach edilince entrance
  animasyonu tekrar başlamaz. Vertical gezinmede hero görsel preload'u settle bekler.
- Detail skeleton TV'de sabit düz renktir; 12 bloğun sürekli animasyonu kapatıldı.
  Loading shell paint edildikten sonra metadata load başlar; base detail paint
  edildikten sonra yardımcı background enrichment işleri başlatılır. Route token
  değiştiyse bekleyen iş başlamaz. Cast fallback sonrası eksik token guard eklendi.
- Detail UI module dosyaları, Home'da 1500 ms giriş olmadığında idle callback ile
  bir kez preload edilir. D-pad beklemeyi yeniler; cleanup timer/idle işi iptal eder.
  Bu kod prefetch'idir; film verisi veya bütün katalogların network prefetch'i değildir.

### Kontroller

- **9/9 Node testi**, lint, build, IPK üretimi ve build graph/package kontrolleri başarılı.
- TV Chromium'da genişletilmiş izole DOM harness: **21/21 kontrol**.
  30 satırdan 5 mounted, 3000 px yükseklik; 40 karttan 5 mounted, 4468 px genişlik.
  Uzak hedef focus, append sonrası 42 mantıksal kart, cleanup restore, hero metadata,
  başlık ve truncation sonrası açıklama tekilleştirmesi doğrulandı.
- İlk kurulan iki eksenli sürümün gerçek Home'u: **3 satır/28 kart**, 28 row spacer,
  14 card spacer. Önceki yalnız dikey sürüm aynı açılışta 42 kart gösteriyordu.
- Aynı sürümde 10 sağ/10 sol sentetik giriş: aynı kart/focus'a döndü; handler p95
  8,5 ms, rAF p95 16,8 ms, maksimum frame aralığı 116,7 ms. Tek warm örnek;
  gerçek kumanda testi veya tüm kasmanın çözümü iddiası değildir.
- İlk detail UI import'unun cold açılış örneğinde skeleton 651,5 ms'de göründü,
  animationName none, base detail 1465 ms'de yüklendi. Bu gözlem idle module
  prefetch eklenmeden önce alındı; eski upstream ile kontrollü A/B değildir.
- Son paket idle module prefetch'i de içerir. Sağ üst birkan etiketi korunur.

### Sınırlar

İki eksenli pencere aktif layout/paint/görsel DOM'unu azaltır. Cached detached
kartlar, ilk full markup ve logical navigation dizileri bellek tutmaya devam eder.
Grid ve tam veri üzerinden remount bu turda yapılmadı. Decoder/ağ nedeniyle
video ilk kare gecikmesi ayrı ölçüm konusu olmaya devam ediyor.

### Son paket TV doğrulaması

Son paket başarıyla TV'ye kuruldu ve açıldı. Ekran nesnesinden
`detailScreenPrefetchComplete=true`, bekleyen preload timer/idle işi olmadığı
okunarak idle UI preload'unun tamamlandığı doğrulandı. Film detayında skeleton
animationName none; aynı oturumdaki örnekte skeleton 549,1 ms, base detail
1285 ms'de görüldü. Önceki cold örnekle cache/ağ koşulları eşitlenmedi; fark
kontrollü hızlanma ölçümü olarak sunulmuyor.

8 aşağı/8 yukarı sentetik denemesi listenin alt bölümünden başladı ve aynı
karta dönmedi. Uç sınırlar ve eşzamanlı kumanda etkileşimi izole edilmediği için
bu örnek odak regresyonu veya A/B başarısı olarak yorumlanamaz. Gerçek TV'de
kesintisiz, sabit başlangıçlı uzun basma testi hâlâ gerekli. İzole DOM odak,
scroll genişliği ve cleanup testleri geçmektedir.
