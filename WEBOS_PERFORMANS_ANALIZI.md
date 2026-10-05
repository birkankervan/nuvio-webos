# webOS performans analizi

Tarih: 5 Ekim 2026. İncelenen kaynak: `NuvioMedia/NuvioTVSmart`,
`358d08c` (1.2.2). Depo bu klasörün köküne klonlandı.

## Kapsam ve kanıt sınırı

Bu rapor kaynak kod incelemesini ve kullanıcının TV'sinden alınan ilk ölçümleri
birleştirir. IPTV ve React dönüşümü bu aşamanın kapsamı dışındadır. İlk yerel
düzeltmeler henüz TV'ye kurulmadı; aşağıdaki cihaz sonuçları mevcut uygulamanın
baseline'ıdır. Sanallaştırma henüz uygulanmadı.

## Gerçek cihazda doğrulanan durum

- Model: LG OLED55CS3VA. Developer Mode açık; kayıtlı bağlantıyla erişim sağlandı.
- Cihazın bildirdiği SDK sürümü: `11.2.0`; firmware: `43.21.71`.
- Uygulama: `space.nuvio.webos`, sürüm `1.2.2` (paket metadata'sından okundu).
  Sürüm aynı olsa da kurulu paketin commit hash'i doğrulanmadı.
- Çalışan web motoru: `Chrome/132.0.6834.207` (uygulamanın user-agent'ından).
  TV'de `performance-constrained` sınıfı yok; modern sidebar blur açık.
- Layout: Modern, tam ekran hero backdrop açık.
- DOM: **31 Home satırı, 462 kart, toplam 5.267 öğe**. Örnek anında viewport
  ile kesişen yalnız **iki satır** vardı.
- Mevcut uygulamanın ana bundle'ı: **3.143.906 byte**. HLS ve DASH bu örnek
  anında yüklenmişti; bu veri ilk açılışta yüklendikleri anlamına gelmez.

| Ölçüm | Boşta, 3 saniye | Sentetik 8 aşağı + 8 yukarı |
| --- | --- | --- |
| Frame p95 | 16,8 ms | 133,3 ms |
| En uzun frame | 16,8 ms | 266,6 ms |
| 33,4 ms üzeri frame | 0 / 182 | 42 / 104 |
| Long task (50 ms üzeri) | 0 | 7 |
| En uzun long task | 0 | 96 ms |
| Keydown handler p95 | — | 81,5 ms |
| Keydown'dan sonraki rAF callback'ine p95 | — | 202,9 ms |

Gezinme örneğinde tuşlar arasında en az 180 ms beklenip sonrasında 700 ms
settle süresi tanındı. Olaylar JavaScript `KeyboardEvent` ile üretildi; native
kumanda input gecikmesi ve ekrana gerçek piksel sunum süresi ölçülmedi. Test
sonunda odak başlangıçtaki DOM düğümüne döndü. Tek tekrar ve sıcak/cache'li
durumda alınan bu sonuçlar kalıcı benchmark değildir.

**Yorum:** Boşta akıcılık korunurken gezinmede belirgin frame kaybı var. DOM
bütçesinin görünür alandan çok büyük olduğu da doğrudan ölçüldü. Bu ikisi
sanallaştırmayı önceliklendirir; DOM'un tek neden olduğunu ispatlamaz. Profiling
ile scripting, layout, paint ve hero değişimi ayrı değerlendirilmeli.

Kullanıcının belirttiği uygulama/video açılışı için henüz geçerli bir cold-start
veya first-video-frame ölçümü yok. Inspector üzerinden warm reload sırasında
erken instrumentation denendi, fakat örnek verisi oluşmadı; sonuç raporlanmadı.

## Öncelikli bulgular

| Öncelik | Bulgu | Kanıt ve etki | Durum |
| --- | --- | --- | --- |
| P1 | Home gerçek anlamda sanallaştırılmıyor | `modernHomeLayout.js` her dolu satırı üretir. İlk kart sınırı 8/10/15; `homeScreenMethods-29-setup-modern-track-scroll-pagination.js` sağa ilerledikçe DOM'a kart ekler, eski kartları çıkarmaz. DOM maliyeti katalog/sayfa sayısıyla büyür. | Mimari olarak doğrulandı; TV etkisi ölçülecek. |
| P1 | Collection satırları başlangıç sınırını atlıyor | `modernHomeLayout.js` içinde `isCollectionRow ? rowItems : rowItems.slice(...)` var. Büyük koleksiyon başlangıçta bütün kartlarını üretir. | Kodda doğrulandı. |
| P1 | Geri dönüşte baştan odaklanan karta kadar tüm kartlar üretiliyor | Aynı dosyada `Math.max(maxItems, focusedItemLimit)`; örneğin 200. karta dönüş en az 201 kartı tekrar üretir. | Kodda doğrulandı. |
| P2 | Eski TV kumanda tekrar sınırı çalışmıyor | `homeScreenMethods-03-is-scroll-animation-active.js/getDirectionalRepeatThrottleMs`: `!Platform.isBrowser()` erken dönüşü, aşağıdaki legacy/constrained koşullarını webOS/Tizen için erişilemez yapar. Legacy yatay gezinme 120 ms yerine 80 ms aralığı kullanır. Bu TV'nin modern profili doğrudan etkilenmez. | Yerelde düzeltildi. |
| P2 | Görsel kuyruğu ekleme maliyeti gereksiz büyüyor | `homeScreenMethods-24-schedule-home-lazy-image-hydration.js/commitHomeLazyImageSources`: her yeni görsel için `pending.findIndex`; N bekleyen ve M yeni görsel için O(N×M) arama. Bu yol legacy profilde çalışır; bu TV'nin modern profilindeki ana sorunu açıklamaz. | Yerelde Map ile düzeltildi; arama O(N+M), sıralama maliyeti ayrıca devam ediyor. |
| P2 | Modern webOS'ta arka plan render girişle çakışabilir | `homeScreenMethods-04-get-hero-focus-delay.js/shouldDeferHomeRenderForInput` 800 ms korumayı sadece constrained/legacy cihazlara uygular. Modern classic/grid ve animasyonsuz modern gezinme aynı korumadan yararlanmaz. | Yerelde modern TV için 250 ms giriş bekleme aralığı eklendi; cihazda etkisi henüz ölçülmedi. |
| P3 | Debug kapalıyken de focus ölçüm argümanları hesaplanıyor | `focusNode` ve `syncMainFocusToViewport` debug zaman hesabını ve veri nesnesini koşulsuz üretir; `logHomePerf` ancak fonksiyona girdikten sonra döner. | Yerelde debug koşuluna alındı. Küçük maliyet; tek başına frame kaybını çözmesi beklenmez. |
| P2 | Diğer katalog ekranları da birikimli render yapıyor | See All `renderedItemsLimit` büyütür; bu bir pencere değil, baştan genişleyen bir dilimdir. Library/Search render akışlarında tüm içerik için markup/DOM oluşturma yolları var. | İkinci inceleme/sanallaştırma hedefleri. |

## Zaten iyi olanlar

- TV nesli/Chromium sürümüne göre performans profili mevcut
  (`js/platform/tvRuntimePerformance.js`). Bilinmeyen TV constrained sayılıyor.
- Home ilk katalog yüklemesi TV'de kısıtlı; kalan kataloglar gruplarla geliyor.
- TV Home görsel hydration alanı sınırlı; legacy cihazda kare başına iki görsel
  atanıyor. Görsel gecikmeli yükleme, kart DOM sanallaştırmasıyla aynı şey değil.
- Home keyed incremental DOM güncellemesi ve odak koruması mevcut
  (`homeDomUpdate.js`); her güncelleme tamamen `innerHTML` değiştirmiyor.
- Stream listesi ve altyazı seçeneklerinde gerçek pencere/spacer sanallaştırması
  mevcut. Bunları yeniden yazmaya gerek yok.
- HLS/DASH ana uygulama paketinden ayrı. Ana JS tek IIFE bundle; ekran düzeyinde
  code splitting yok. Bu daha çok açılış/parsing adayını açıklıyor; kumanda
  gezinmesindeki takılmanın ölçülmüş nedeni olarak kabul edilmemeli.
- `css/components-60.css` eski/constrained TV'de birçok blur, gölge ve animasyonu
  zaten kapatıyor.

## TV üzerinde incelenecek adaylar

1. Modern LG modellerinde genişleyen posterin width animasyonu ve hero/trailer
   değişimi layout/paint süresini artırıyor mu?
2. Arka planda katalog/CW güncellemesi sırasında markup üretimi, DOM
   reconciliation ve navigation modeli yenilemesi uzun task oluşturuyor mu?
3. Uzun yatay gezinmeden sonra mounted kart sayısı ve bellek ne kadar artıyor?
4. Görsel hydration sırasında decode/raster ile odak hareketi aynı kareye
   yığılıyor mu?

Yeni webOS sürümünü yalnız tarayıcı sürümü nedeniyle hızlı saymak donanım
garantisi değildir. Ancak ölçüm olmadan bütün LG cihazlarını legacy saymak da
doğru başlangıç değildir.

## Sonuç

Önce kumanda/render çakışması ve kuyruk maliyetini düzelt; ardından Home için
hem dikey satır hem yatay kart penceresi uygula. React dönüşümü gerekli değil.
Sanallaştırmanın önkoşulu odağı DOM sırasından ayırmaktır; yalnız `slice` eklemek
veya uzak kartları silmek geri dönüşü, kumandayı ve pagination'u bozabilir.

## Üretici kaynakları

- [LG OLED55CS3VA ürün bilgisi](https://www.lg.com/tr/tv-soundbar/oled-evo/oled55cs3va/): çıkış platformu webOS 23. Kurulu güncel sürüm bundan farklı olabilir.
- [LG web motoru tablosu](https://webostv.developer.lge.com/develop/specifications/web-api-and-web-engine): Chromium 132, webOS TV 26 platformuna karşılık geliyor. Bu TV için motor ayrıca user-agent ile doğrulandı.
