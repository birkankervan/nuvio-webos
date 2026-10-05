> Güncel aktif mimari planı: [plans/2026-10-05-webos-nihai-mimari.md](plans/2026-10-05-webos-nihai-mimari.md).
> Saf modellerin teslimi ve runtime/TV kabulü [iş takibinde](WEBOS_IS_TAKIBI.md) ayrı durumlar taşır.

# webOS test ve ölçüm planı

## Mevcut durum

Gerçek LG OLED55CS3VA'ya kayıtlı Developer Mode bağlantısıyla erişildi. SDK
`11.2.0`, firmware `43.21.71`, Chromium `132.0.6834.207`, Nuvio `1.2.2`.
Kullanıcı uygulama ve video açılışında akıcılık sorunu bildirdi. Boşta ve
sentetik gezinme baseline ölçümleri analiz raporunda kayıtlı; açılış/video
ölçümü ve değiştirilmiş build'in TV karşılaştırması henüz yapılmadı.

## Yerel doğrulama

```sh
npm ci --ignore-scripts
node --test js/ui/navigation/*.test.mjs js/ui/screens/home/homePerformance.test.mjs js/ui/screens/stream/streamPerformance.test.mjs
npm run lint
npm run build
```

Upstream `npm test` komutu `tests/test-plugin-system.mjs` ve
`tests/test-plugin-localization.mjs` çağırıyor; klonlanan depoda bu klasör yok ve
`.gitignore` içinde `tests/` var. Bu komut tek başına genel regresyon doğrulaması
olarak kullanılamaz. Yeni testler takip edilen navigation/Home/stream klasörlerinde tutuluyor.

## TV ölçümü

Developer Mode ve mevcut webOS araçlarıyla TV bağlandıktan sonra:

```sh
npm run inspect:webos -- --device TV_DEVICE_NAME
```

Inspector Performance kaydında aynı hesap ve layout ile aşağıdaki senaryoları
önce upstream build, sonra değiştirilmiş build üzerinde çalıştır:

1. Soğuk açılış ve ilk Home görünümü.
2. Bir satırda 30 sağ/30 sol; uzun basılı sağ ve sol.
3. 10 aşağı/10 yukarı ve uzun basılı dikey gezinme.
4. Kataloglar arka planda gelirken aynı tuş dizisi.
5. Büyük collection/CW listesi ve split Upcoming açıkken gezinme.
6. Uzak karttan detail'a girip geri dönme; sidebar aç/kapat.
7. Magic Remote hover ve wheel ile gezinme.
8. Player'a geçiş/geri dönüş; 10 kez route değişiminden sonra listener/timer ve
   bellek durumu.

Her senaryoyu üç kez tekrarla. İlk çalışmayı cache/ısınma açısından ayrıca
işaretle; aynı ağ koşulları, içerik, görsel ayarları ve profil kullanılmalı.

Kaydedilecekler: mounted kart/satır sayısı, uzun task sayısı ve süresi,
scripting/layout/paint süreleri, frame gecikmeleri, heap destekleniyorsa bellek,
odak kaybı ve kumanda tepki süresi. Başarı kıstası yalnız ortalama FPS değil;
uzun gezinmede DOM'un sabit bütçede kalması ve odak regresyonu olmamasıdır.

## Kimlik doğrulama ve kurulum

Klonun backend yapılandırması üretim hesabına giriş için ayrıca gereklidir.
Şifre/anahtarlar rapora yazılmayacak. Ara optimizasyon sürümü TV'ye kuruldu;
nihai mimarinin yeni modülleri henüz TV runtime'ına bağlı değil.
Upstream uygulama kimliği `space.nuvio.webos`; ayrı kurulum istenirse app/service
kimlikleri birlikte ele alınmalı.

## İlk tur kontrolleri — tarihsel

- **7/7 Node testi başarılı**. Lazy import cache/retry ve navigation yarışı,
  snapshot sınırı/recency, Home repeat/görsel kuyruğu ve stream batch/abort/stale
  rejection/cleanup davranışları kontrol edildi.
- **11/11 gerçek TV tarayıcısı DOM kontrolü başarılı**. Geçici harness dosyası
  `scripts/performance-dom-check.js`; mevcut uygulama dosyalarını değiştirmeden
  Inspector'da çalıştırıldı ve test DOM'u finally içinde kaldırıldı.
- `npm run lint`, `npm run package:webos`, `node scripts/check-performance-build.mjs`
  ve `git diff --check`: başarılı. Build graph testi ağır UI ekranlarının başlangıç
  graph'ına girmediğini, tüm chunk çıktılarını ve eski bundle fallback'ini kontrol eder.
- Modern başlangıç JS yaklaşık 1.264.000 byte; legacy bundle yaklaşık 3.215.000
  byte; başlangıç uygulama JS'inde %60,7 azalma. 64 ilk module dosyası, toplam 102 çıktı.
  Core-js, CSS ve görseller bu byte karşılaştırmasına dahil değil.
- Yerel IPK üretildi: `space.nuvio.webos_1.2.2_all.ipk`.
  Staged webOS HTML yeni loader'ı çağırır, chunk'lar paket içine kopyalanır.
- `local.properties` olmadığı için örnek config kullanıldı. Paket mevcut hesapla
  girişe hazır sayılmamalı. İlk test sırasında TV'ye yeni paket kurulmamıştı; son kurulum kaydı aşağıda.
- Yeni kodun tam uygulama entegrasyonu, gerçek kumanda ve açılış/ilk video karesi
  A/B ölçümleri henüz yapılmadı.

## Cihaz ölçümü sınırları

Sentetik gezinme gerçek kumanda taraması değildir. rAF gecikmesi doğrudan
ekrana piksel sunumunu ölçmez. Baseline tek tekrar, cache/ısınma etkisi olan
örneklerdir. Warm reload için document-start instrumentation denemesi veri
üretmedi; cold-start başarısı olarak raporlanmadı.

## TV kurulumu — 5 Ekim 2026

Kullanıcının kurulum isteğiyle `space.nuvio.webos_1.2.2_all.ipk` kayıtlı
LG OLED55CS3VA cihazına başarıyla kuruldu ve uygulama açıldı.
Inspector'da document readyState complete ve module app.module.js script'i doğrulandı.
Home görünümünde **3 aktif katalog satırı, 42 kart, 28 spacer** gözlendi.
Önceki baseline 31 satır/462 karttı; bu açılış örneği DOM penceresinin gerçek
uygulamada çalıştığını gösterir. Aynı içerik/odakla kontrollü FPS veya video
ilk-kare karşılaştırması yapılmadığından hızlanma yüzdesi iddiası yoktur.

## İkinci tur kontrol seti — tarihsel

```sh
node --test js/ui/navigation/*.test.mjs js/ui/screens/home/homePerformance.test.mjs js/ui/screens/stream/streamPerformance.test.mjs js/ui/screens/detail/detailPerformance.test.mjs
npm run lint
npm run package:webos
node scripts/check-performance-build.mjs
git diff --check
```

9 test geçer. `scripts/performance-dom-check.js` TV Inspector'da geçici bundle
olarak çalıştırıldığında 21 DOM kontrolü geçer. İkinci tur ölçümleri ve kapsam
sınırları `WEBOS_DERIN_INCELEME.md` son bölümündedir.

Son idle preload paketi de TV’ye kuruldu; ekran nesnesinde preload tamamlandı durumu doğrulandı. Hero metadata grupları tek, skeleton animasyonu none.

## Nihai mimari temelleri — 5 Ekim 2026 güncel doğrulama

```sh
node --test js/ui/navigation/*.test.mjs js/ui/screens/home/*.test.mjs js/ui/screens/stream/*.test.mjs js/ui/screens/detail/*.test.mjs
npm run lint
npm run package:webos
node scripts/check-performance-build.mjs
git diff --check
```

**30/30 test ve bütün yukarıdaki kontroller başarılı.** Saf pencere, odak,
Modern adapter ve değişken satır ölçümleri; eski route/Home/stream/detail
regresyonları; yeni stale Detail section callback sahipliği birlikte kontrol edildi.

Yerel paket üretildi, bu tur TV'ye kurulmadı. Dört saf Home modülü mevcut
renderer'a bağlı değil. Yeni testlerin geçmesi gerçek ana sayfa akıcılığı veya
nihai mimarinin tamamlanması anlamına gelmez. Son bilinen TV kontrolü önceki
21 DOM harness kontrolüdür; kontrollü cold/warm/video ilk karesi ölçümleri açık.

## Modern runtime entegrasyonu — güncel doğrulama

Önceki temeller bölümü tarihsel: Modern renderer artık uygulamaya bağlı ve TV'ye kurulu.

```sh
node --test js/ui/navigation/*.test.mjs js/ui/screens/home/*.test.mjs js/ui/screens/stream/*.test.mjs js/ui/screens/detail/*.test.mjs js/core/util/boundedCache.test.mjs
npm run lint
npm run package:webos
node scripts/check-performance-build.mjs
git diff --check
```

35/35 test ve bütün kontroller başarılı. Yeni `scripts/performance-data-window-check.js`
TV tarayıcısında77/77; eski `scripts/performance-dom-check.js`21/21 başarılı.
Fixture20x100 ilk8markup/2row8cards; uzakitem200 Back/scroll/remove/cleanup ve
wrapped collection header sabit ölçüm/noRAFloop doğrulandı.

Yeni paket TV'ye kuruldu/açıldı. Modern logical31row/769cards, mounted2row13cards;
legacy detached cache kapalı, mountedmap13 ve trackhandlers2, birkan etiketi var.
Gerçek route20.kart→detail→Back aynırow/index/item ile döndü ve focus bağlı kaldı.

Tek warm sentetik10right10left aynılogicalodağa döndü, maxindex10; inputhandler
p9517.1ms, rAFp9533.3ms/max50ms,longtasks0. Handler16.7mshedefinin altında kabul
edilmedi. Network/cache/layout farklı olduğundan eski ölçümlerle hızlanma yüzdesi
çıkarılmaz. Gerçekkumanda, soğukaçılış, videoilkkaresi, tekrarlı heap/bellek ve
Classic/Grid kabulü açık. NAV mountedviewprojection ve PATCHshellcommit daraltması
aktif plan backlog'udur; Modern entegrasyonu nihai mimarinin tamamı değildir.

## Kaynak şeridi tekrar regresyonu

Aynı toplu komutlarla 36/36 test geçti; lint, paket/build graph, diffcheck başarılı.
Yeni scripts/stream-chips-dom-check.js gerçek TV tarayıcısında 17/17 geçti.
Partial chip replacement sonrasında full keyed render, loading/success/error
geçişi, filter/focus korunumu ve tekrar etmeyen chip identity kontrol edilir.
Kurulu pakette aynı gerçek film akışı 58 stream ile tamamlandı; duplicate DOM
buton sayısı eski 2'den 0'a indi, model duplicate 0. Fixture ve gerçek route
kontrolü ayrı kanıttır; genel performans kabulünün yerine geçmez.
