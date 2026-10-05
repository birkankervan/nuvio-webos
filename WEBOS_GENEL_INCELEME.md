# webOS genel kod incelemesi: performans ve bellek (REVIEW-01)

5 Ekim 2026. Dört read-only ajan inceledi: rev_home, rev_player, rev_screens ve
rev_core. Kaynak kodda değişiklik yapılmadı. Root, örneklenen bulguları kodda
doğruladı; doğrulananlar ✔ ile işaretli. TV'de ölçüm yapılmadı. Bu dosyadaki
hiçbir bulgu runtime veya TV kabulü sayılmaz.

## Öncelikli bulgular

| ID | Alan | Dosya | Tür | Sorun | Önerilen minimal düzeltme |
| --- | --- | --- | --- | --- | --- |
| R-01 ✔ | Player/platform | platform/webos/webosPlayerExtensions.js:157,210 | perf | Her `timeupdate` (yaklaşık 4/sn) refreshKeepAwake'i çalıştırır. Bu, durum değişmese de 2–4 native `setWindowProperty("blockScreenSaver")` çağrısı yapar. | Yalnız durum değişince çağır. `timeupdate`'i listeden çıkar; 15 sn'lik timer zaten yeniliyor. |
| R-02 ✔ | Core/data | data/local/profileScopedStore.js:68-78,236 | perf | Her `getForProfile`, localStorage'dan okur ve JSON.parse yapar. Ardından tüm profilleri normalize eder, iki kez stringify karşılaştırır ve clone'lar. Player tick'i bunu 5–8 kez, Home hero ve CW yolları da tekrar tekrar çağırır. | Raw string anahtarlı parse memo (watchProgressStore deseni). persistEnvelope'ta invalidate et. |
| R-03 | Player | screens/player/…-26-copy-subtitle-cue-presentation.js:126 | perf | Her `cuechange`'de tüm track'in cue'ları yeniden yazılır ve HTML overlay cue listesi baştan kurulur. | cuechange'de yalnız `activeCues` işlenir. Tam geçiş yalnız delay, offset veya track değişince yapılır. |
| R-04 | Player | …-32-update-ui-tick.js; 29:137; 45:111 | perf | `updateUiTick` timeupdate, progress ve 1 sn'lik interval ile çalışır. Kontroller açıkken her tick'te getBoundingClientRect ile forced layout yapar. | Ölçümü kontrol açılışında veya resize'da cache'le. `progress` bağını kaldır ya da throttle et. |
| R-05 ✔ | Home | home/homeDataWindow.js:133-139,213-260 | perf | Her `sync()` görünür pencerenin tüm markup'ını yeniden üretir. Satır başına `querySelector(".is-expanded"/".focused")` ve offsetWidth okur. Ardından tüm satırları ve kartları ölçer. Spring scroll sırasında sync her frame çalışır. | Önce aralık imzasını karşılaştır, değişmediyse markup ve ölçümü atla. Sorguları sync başına bir kez yap. |
| R-06 ✔ | Library | library/libraryScreen.js:171; methods-03:133 | perf | Grid pencerelenmemiş; tüm kartlar inline background-image ile çiziliyor. Ardından her kart için getBoundingClientRect okunuyor ve sort comparator rect'i tekrar okuyor. | Satır/sütun indeks ve sütun sayısından hesaplanır. Discover/Stream'deki hydration deseni burada da uygulanır. |
| R-07 | Core/data | data/repository/addonRepository.js:315,400,645 | perf | `isAddonEnabled` filter içinde URL başına envelope parse eder. `getInstalledAddons` cache'e ulaşmadan 3+N parse yapar. | States bir kez okunur; R-02 memo'su kullanılır. |
| R-08 | Core/data | data/local/watchedItemsStore.js:66; watchedItemsRepository:540 | perf | `listAll` memo'suz: her çağrıda 5000 öğeye kadar parse, dedupe ve sort. `isWatched` tek ID için tam `getAll` çalıştırır. | Raw-string memo eklenir. `isWatched` Set ile bakar. |
| R-09 | Detail | detail/…-16-render-comments-section.js:347 | perf | Rating-season chip'ine focus geldiğinde tüm detail ekranı innerHTML ile yeniden çizilir. D-pad hareketi başına bir tam render olur. | Yalnız ratings grid'i yenilenir (refreshEpisodeTrack deseni). |
| R-10 | Core/TMDB | core/tmdb/* (yaklaşık 13 çıplak fetch) | perf | Timeout ve abort yok. Takılan bir soket enrichment'ı süresiz bekletir; dedup aynı askıdaki promise'i paylaştırır. | Mevcut `withRequestTimeout` kullanılır. |
| R-11 | Core/data | data/repository/metaRepository.js:172 | perf | Addon meta adayları sırayla denenir ve varsayılan timeout 60 sn'dir. Ölü bir addon detail'i 60 sn geciktirir. | Yaklaşık 8 sn timeout ve kısa süreli negatif cache. |
| R-12 | Home | home/homeScreenHelpers-10:209,240 | perf | CW enrichment sırasında her öğe için tam blob parse, sort, stringify ve setItem yapılır. | Batch başına bir okuma ve bir yazma. |

## Bellek ve sızıntı bulguları

| ID | Dosya | Sorun | Düzeltme |
| --- | --- | --- | --- |
| M-01 ✔ | data/repository/watchProgressRepository.js:657; libraryRepositoryHelpers-01:71 | `enrichedMetaCache` ve `enrichedLibraryMetaCache` sınırsız Map'ler; series videos dahil tam meta tutarlar. TTL yalnız okuma sırasında kontrol edilir ve hiçbir yerde delete/clear yok. LOAD-03 bütçesinin dışında kalırlar. | `BoundedCache` ile sınırlanır ve session teardown'da temizlenir. |
| M-02 ✔ | core/profile/profileSelectionScreenMethods-01-mount.js:75-97 | Await'lerden sonra `isMounted` kontrolü yapılmadan subscribe ediliyor. Cleanup bu await'ler sırasında çalışırsa abonelikler hiç bırakılmaz. | Subscribe'dan önce `if (!this.isMounted) return;`. |
| M-03 ✔ | services/webos/src/bitmapSubtitles.js:2185 | `clearBitmapSubtitleCaches` export ediliyor ama çağıranı yok. Playback bittikten sonra servis onlarca MB'a kadar cue, window ve frame tutabilir. | Player exit veya keepalive cancel sırasında çağrılır, ya da TTL sweep eklenir. |
| M-04 | services/webos/plugin/src/index.js:127 | Loopback `http.request` timeout'suz; takılırsa socket ve Luna mesajı açık kalır. | `request.setTimeout` + `destroy`. |
| M-05 ✔ | collection/folderDetailScreenMethods-03-render.js:283 | Folder ekranı Home'un truncation resize listener'ını ekliyor ama kendi cleanup'ında kaldırmıyor. Tek bir listener kalıcı olarak kalır ve kapanış folder ekranını tutar. Prototype mirası Home state'ini sızdırır. | Folder cleanup'ında listener kaldırılır; flag'ler own property olarak başlatılır. |
| M-06 | account/authQrSignInScreenMethods-02:226 | QR polling'de generation sayacı yok. Eski in-flight `finally` ikinci bir poll döngüsü kurabilir. | `pollGeneration` sayacı. |
| M-07 | home/…-18-focus-node.js:15 → 12:255 | Basılı tutulan tuş sırasında trailer cleanup timer'ı sürekli yeniden kurulur; duraklatılmış iframe ve video elemanları sökülmez. | Populated layer Set'i tutulur; bekleyen timer resetlenmez. |
| M-08 | navigation/focusEngine.js:256 | `lastPointerFocusTarget` route değişince detached node'u tutmaya devam eder. | Navigate ve keydown sırasında temizlenir. |
| M-09 | navigation/routerMethods-02:128 | Router stack sınırsız; detail→detail zinciri büyür. | Stack'e üst sınır konur veya tekrar eden entry'ler collapse edilir. |

Temiz olduğu doğrulanan alanlar:

- Player video listener'ları, blob URL revoke ve native stop sırası.
- hls/dash teardown, Luna abonelikleri ve ASS renderer.
- Home cleanup listesi.
- Search: debounce ve abort.
- Stream ve Detail cleanup.
- i18n ve avatar cache'leri.

## Diğer orta/düşük perf bulguları

- **Player:**
  - `resolveNextEpisodeInfo` tick başına en az 4 kez tüm bölüm listesinde çalışır (memo yok).
  - Overlay her timeupdate'te cue dizisini kopyalar.
  - HTML altyazı overlay'i 120 ms'lik poll ile pause'da da tüm cue'ları filter'lar.
  - Torrent stats açıkken her tick'te `/stats` fetch yapılır.
  - `renderNextEpisodeCard` gizliyken innerHTML yazar.
  - `postPlay getState` her çağrıda state kopyalar.
- **Home:**
  - Yatay tuş başına 2+ forced layout (offsetWidth ve rect).
  - classic `homeRowVirtualizer` önce yazıp sonra okuyor.
  - lazy image hydration her onChange'de querySelectorAll ve rect ile çalışır.
  - Binary-search truncation reflow yapar; yeni webOS'ta da açık.
  - Grid sticky header scroll handler'ı throttle'sız.
- **Ekranlar:**
  - Discover ve SeeAll pencereleri yalnız büyür ve her genişlemede tamamen yeniden çizilir.
  - Library picker açılıp kapanınca tam render yapılır.
  - Library `setState` her UI patch'inde facet ve sort'u yeniden hesaplar.
  - Cloud search debounce'suz.
  - Settings, `innerHTML !==` karşılaştırması nedeniyle her seferinde yeniden yazar.
  - Settings, folder ve scroll handler'ları throttle'sız.
- **Core:**
  - streamBadgeRules her stream için tüm kuralları stableStringify eder.
  - pluginCodeStore.get, lastUsedAt için tüm kodu IndexedDB'ye geri yazar.
  - TMDB enrichment'ında bağımsız fetch'ler sırayla yapılır.
  - Simkl snapshot her çağrıda parse edilir.
  - Periyodik sync gizli app'te de çalışır.
- **CSS:** 60 zincirli `@import`. Sidebar `width` animasyonu her frame'de layout yapar.

## Kalite ve güvenlik notları

- Sidebar avatar `alt`/`src` ve detail `renderError` escape edilmiyor. Profil adında tırnak olursa attribute injection mümkün.
- Ölü bileşenler: trailerPlayer, heroCarousel, contentCard, catalogRow ve continueWatchingSection hiçbir yerden import edilmiyor.
- authManager listener'ları try/catch'siz; bir throw diğer listener'ları atlatır.
- catalogOrderScreen'de hardcode İngilizce metinler var; detail'de İtalyanca hata metni var.

## Mimari değerlendirme

- Ekranlar singleton object literal. 30–70 adet `xxxMethods-NN` mixin spread ile birleştiriliyor ve dosya adları içerikle uyuşmuyor. Mount/cleanup çiftlerini denetlemek zor; override'lar sessizce gerçekleşir.
- State yüzlerce mutable `this` alanından oluşur. Cleanup elle tutulan uzun bir liste ve şu an büyük ölçüde doğru. Kalıcı çözüm, mount başına AbortController veya disposer listesi.
- Render her yerde template-string innerHTML ile yapılıyor; patch stratejisi ekran başına farklı. Ortak pencereli grid primitive'i yok: Library, Discover, SeeAll ve catalogOrder ayrı ayrı yazmış.
- Kalıcılık her erişimde senkron localStorage JSON blob okuma, normalize ve yazma şeklinde. Profile-scoped envelope mantığı 3 kez kopyalanmış. Düşük donanımlı TV'de en büyük perf borcu bu.
- Katmanlar yalnız isimde var: core/profile UI ekranı içeriyor ve ThemeManager import ediyor.
- İyi yanlar: async token guard'lar tutarlı; in-flight dedup var; httpClient'ta timeout, cooldown ve retry var; bağımlılık yok.

## Önerilen sıra

1. R-01 ve R-02: küçük diff, playback ve Home'un hepsine etki eder.
2. R-05: ileride PATCH-01 ve NAV-01 ile birleşir.
3. M-01, M-02, M-03 ve M-05: kısa, tek dosyalık düzeltmeler.
4. R-03 ve R-04: player tick bütçesi.
5. R-10 ve R-11: ağ timeout'ları.
6. R-06: Library pencereleme.

Her düzeltme test, lint ve paket kontrolünden sonra TV'de doğrulanır.
