# PATCH-01 ajan checkpoint

Güncelleme: 5 Ekim 2026. Sahip: Luna 6/max (`luna_patch01`). Root kod review,
paketleme ve TV kabulünün sahibi. Commit/stage/push yok.

## Kontrol noktası — akış haritası ve karar

- Önce AGENTS.md, WEBOS_PERFORMANS_PLANI.md, WEBOS_IS_TAKIBI.md,
  WEBOS_DEVAM_NOTLARI.md checkpoint 17 ve aktif
  `plans/2026-10-05-home-bolgesel-guncelleme.md` okundu. Ponytail kod becerisi
  uygulandı: mevcut vanilla JS/DOM yapı taşlarını kullan, yeni bağımlılık ekleme.
- Başlangıç ağacı mevcut çok sayıda uncommitted Home/runtime değişikliği içeriyor.
  Home dışında dosya temizlenmedi; source baseline
  `/private/tmp/nuvio-patch01-baseline` read-only karşılaştırma noktası.
- Veri yolu: `homeScreenMethods-21-load-data.js` progressive/deferred catalog,
  watched snapshot ve profil sonucunu `requestBackgroundRender()` ile yayınlar;
  CW load `homeScreenMethods-04-get-hero-focus-delay.js` içindeki aynı isteği
  kullanır. İlk `loadData()` final adımı doğrudan `render()` çağırır. Hero’nun
  hedefli `applyHeroToDom()` patch’i mevcut. Paginated sonuç
  `homeScreenMethods-31-data-window.js` içinden `refreshDataHomeWindow()`a gider.
- Darboğaz: `requestRender()` sonunda her zaman `render()` çağırır; Modern
  `render()` da `createDataHomeWindow()` içinde önceki renderer’ı yok eder ve
  yenisini kurar. Ayrı olarak `HomeDataWindow.sync()` her sync’te görünür tüm
  kartlar için `renderCard()` çağırır. Bu yüzden keyed DOM aynı düğümleri tutsun
  bile kart markup işi tekrar edilir.
- Uygulama kararı: mounted Modern Home için veri commit yolunu ayır; mevcut
  renderer/viewport/shell kalsın. Renderer’a explicit dirty row/item hints ver;
  catalog/CW/watched güncellemesinde yalnız dirty ve görünür markup üret. Raw
  mutable object identity tek invalidation olmayacak; bütün logical item'ları
  her sync/keypress anında tarama veya JSON stringify etme. Dirty cache’i DOM’un
  o anki mounted working-set’i ile sınırlı tut. İlk mount, Back restore,
  layout/settings veya loading-shell geçişi, öncelikli ilk-focus işi ve route
  departure mevcut full-render/ownership fallback’inde kalacak.
- Profil imzası değişirse sidebar UI yenilemesini atlama; mümkünse mevcut
  sidebar renderer/event-binding pattern’ini hedefli kullan, aksi halde yalnız
  seyrek profile fallback’ini kontrollü full render yap. Pagination aynı
  renderer ve `homeLoadToken`/route/request sahipliğiyle ilerlemeli.
- Uygulama daraltıldı: `requestBackgroundRender()` değişiklik ipuçlarını
  birleştirir; katalog callers row key, CW callers CW/upcoming bölgeleri,
  watched callers mounted poster working-set invalidation verir. Bilinmeyen
  reason güvenli full render fallback’i olur. `HomeDataWindow.setRows()` dirty
  key'lerle yalnız geçersiz görünür kart HTML'ini üretir; track/focus/geometry
  aynı renderer'da tutulur. Bu karar root ile koordine edildi.

## Durum ve sonraki adım

- Bu checkpoint anında source/test edit'i veya kontrol çalıştırması yapılmadı.
  Sadece akış ve mevcut sınırlamalar okundu.
- Çalışan ajan/tool: `luna_patch01`; root ayrı olarak plan, ana iş panosu,
  devam checkpoint’i, entegrasyon review ve TV testini yürütüyor.
- Açık risk: row/item invalidation hint’leri render callers boyunca kaybolmamalı;
  focused item removal/reorder, CW loading-to-content ve sidebar profile update
  davranışı explicit test edilmeli. Real DOM acceptance root TV harness’indedir.
- Tam sonraki adım: explicit dirty data change batching/wiring, existing
  `HomeDataWindow` state-preserving row commit, visible markup cache, sonra
  Home factory Node regression + `scripts/performance-data-window-check.js`
  real-DOM checks. Sonunda bu raporu test/risk/sonraki adımla güncelle.

## Kontrol noktası — ilk source patch

- Ajan source edit'i başladı: `homeDataWindow.js` görünür kart HTML cache’i,
  explicit dirty-row/item invalidation, current-window cache prune, stable media
  focus identity ve scroll anchor koruması aldı. Collection horizontal ölçümü
  duplicate identity çakışmaması için index key'i kullanır ve dirty collection
  satırında yeniden ölçülür; `homeRowMetrics.js` tek satır ölçüm temizleme API’si
  aldı.
- `homeScreenMethods-31-data-window.js` aynı data renderer’da row commit ve
  Modern fast-path eligibility ekledi. `homeScreenMethods-04` aynı bekleyen
  dirty Set’lerini frame/delay boyunca birleştirir; `homeScreenMethods-23` fast
  path’i teardown’dan önce deniyor. Initial/Back/layout/settings/loading
  fallback’i yerinde. Pagination yeni item ID’lerini dirty olarak verir.
- Catalog, CW ve watched callers dirty hint veriyor. CW-only update iki CW row
  key’ini işaretler; watched-title seti değişmediyse no-op render isteği yok.
  Profile/sidebar değişikliği full render’a düşüyor. Cleanup pending hint’leri
  temizliyor. Bu, koddan tek başına geçici durumdur; testsiz kabul değildir.
- Editlenen kod üzerinde `node --check` **başarılı**. Node suite/DOM fixture henüz
  çalıştırılmadı; burada sonuç iddiası yok.
- Etkilenen dosyalar: `homeDataWindow.js`, `homeRowMetrics.js`,
  `homeScreenMethods-04-get-hero-focus-delay.js`, `homeScreenMethods-20-mount.js`,
  `homeScreenMethods-21-load-data.js`, `homeScreenMethods-22-pick-initial-hero.js`,
  `homeScreenMethods-23-render.js`, `homeScreenMethods-30-cleanup.js`,
  `homeScreenMethods-31-data-window.js`, `homeContinueWatchingLoad.js`.
- Aktif ajan/tool: `luna_patch01`, Home kaynak ve test dosyaları. Root erken source
  review yapıyor; test/DOM fixture sahibi hâlâ bu ajan. TV kurulum/Inspector bu
  ajanın kapsamında değil.
- Açık risk: mutation callers’ın her biri doğru dirty scope vermeli; unknown
  `setRows()` tüm kart cache’ini temizleyerek güvenli kalmalı; duplicate media
  kimlikleri aynı row’da cache/ölçüm çakışması yaratmamalı; UI acceptance bekliyor.
- Tam sonraki adım: root review bulgularını al, caller wiring’i sonlandır, gerçek
  `requestRender → render` Node regression ve `performance-data-window-check.js`
  DOM senaryolarını ekle/çalıştır, lint et ve bu rapora son test/risk yaz.

## Kontrol noktası — source freeze / root doğrulamasına teslim

- Root review bulguları uygulandı: card cache key/check artık logical index ile
  birlikte `itemIndex`, `sourceIndex` ve `sourceRowIndex` alanlarını ayırıyor;
  duplicate media identity aynı row’da iki logical slotu ezmiyor. Hint’siz
  `setRows()` markup cache’i yanında measured row/collection geometry’yi de
  konservatif temizliyor. Focused node silinip logical focus kalmadığında fast
  path `false` döndürüp tam render fallback’ine bırakıyor.
- `scripts/performance-data-window-check.js` gerçek DOM fixture’ına aynı
  renderer/shell/window/unchanged row-card node korunumu, değişen görünür row’da
  metadata güncellemesi, unchanged row için `renderCard` 0, offscreen markup
  yokluğu, CW upcoming source-index kayması, duplicate identity cache, unknown
  collection geometry reset, row reorder sırasında focus/vertical anchor ve tek
  satırın focused son kartıyla kaldırılması eklendi. Pagination append testi
  yalnız logical extent artışını ve offscreen markup oluşmamasını doğrular.
- `homeDataWindowRuntime.test.mjs` focused son row kaldırıldığında logical focus
  kalmaması ve komple render fallback’ine dönülmesi için Node regression aldı.
  Home test paketi **30/30** geçti; editlenen Home JS/test dosyalarına ESLint
  geçti; fixture ile runtime testinin syntax kontrolü geçti.
- Bu ajan gerçek DOM fixture’ını tarayıcı/TV üzerinde çalıştırmadı. Root, source
  freeze sonrası TV Inspector’da genişletilmiş fixture ve gerçek Home kabulini
  çalıştıracak; bu aşamanın sonucu burada iddia edilmiyor.
- Teslim edilen dosyalar: `homeDataWindow.js`, `homeRowMetrics.js`,
  `homeScreenMethods-04-get-hero-focus-delay.js`,
  `homeScreenMethods-20-mount.js`, `homeScreenMethods-21-load-data.js`,
  `homeScreenMethods-22-pick-initial-hero.js`,
  `homeScreenMethods-23-render.js`, `homeScreenMethods-30-cleanup.js`,
  `homeScreenMethods-31-data-window.js`, `homeContinueWatchingLoad.js`,
  `homeDataWindowRuntime.test.mjs`, `scripts/performance-data-window-check.js`.
- Aktif ajan/tool: `luna_patch01` source teslimini dondurdu; root source review,
  tam test/lint/build/paket ve TV Inspector kabulinden sorumlu.
- Açık risk: genişletilmiş gerçek DOM fixture ve gerçek runtime install root
  tarafından henüz çalıştırılmadı; duplicate identity DOM diff, focus/reorder ve
  ölçüm davranışı o kontrolde doğrulanmalı. Başarısızlıkta root revizyon için bu
  ajana dönecek.
- Tam sonraki adım: root fixture/runtime kabulini çalıştırıp sonucu gözden
  geçirsin; failure varsa bulguyu bu rapora ekleyip yalnız gerekli source/test
  revizyonunu uygula. Başarılıysa root final paket/TV raporunu tamamlasın.

## Kontrol noktası — bottom prepend scroll anchor düzeltmesi

- Root’un TV Inspector ölçümü `oldTop=7176`, CW başa eklendikten sonra beklenen
  `7482` ve gerçek `7176` olarak bottom-anchor kaymasını doğruladı. Kalıcı DOM
  fixture’a aynı regresyon eklendi: eski içerik en altta iken üste CW satırı
  eklenir ve önceki görünür row aynı intra-row offset’te kalmalı.
- `HomeDataWindow.setRows()` anchor’ı viewport row key + row içi offset olarak
  saklıyor. `sync()` pending anchor varsa yeni vertical extent ve doğru visible
  window markup’ını hesaplıyor; DOM güncellendikten sonra browser scrollTop’unu
  uyguluyor. Bir sonraki setRows bu pending anchor’ı devam ettirir; destroy’da
  temizlenir.
- Düzeltme sonrası Home Node suite **30/30**, ilgili Home ESLint, fixture/source
  syntax ve `git diff --check` geçti. Root’un tüm Node suite’i bu üretim source
  değişikliği öncesi **39/39** geçmişti; tam suite gerekirse root tekrar çalıştırır.
- Root extended TV fixture’ı yeniden çalıştıracak. Kaynak freeze geçici olarak
  kaldırıldı; bekleyen kabul bu yeni bottom prepend anchor senaryosunun ve önceki
  fixture kontrollerinin TV üzerinde geçmesidir.
- Düzenlenen dosya: `homeDataWindow.js` ve
  `scripts/performance-data-window-check.js`. Üretim patch’i bu anchor bug’ını
  düzeltmek için gerekli oldu; başka kaynak dosyası değişmedi.
- Aktif ajan/tool: `luna_patch01` source revizyonu tamamladı ve TV yeniden
  doğrulamasını bekliyor; root Inspector/paket kabulini yürütüyor.
- Açık risk: DOM ölçüm ve browser scroll clamping davranışı yalnız gerçek
  browser/TV fixture’ında doğrulanır. Sonraki adım: root fixture’ı baştan sona
  tekrar çalıştırsın; anchor veya başka assertion başarısızsa bu ajana dönsün.

## Kontrol noktası — gerçek TV fixture kabulü / source freeze

- Root genişletilmiş `scripts/performance-data-window-check.js` fixture’ını
  gerçek TV tarayıcısında baştan sona çalıştırdı: **114/114 geçti**. Bottom CW
  prepend anchor, reorder/scroll/focus, source-index shifts, aynı identity
  metadata mutation, unchanged visible row `renderCard` 0, duplicate identity,
  unknown geometry reset, offscreen markup ve önceki virtual-window
  regressions doğrulandı.
- Root son source diff’i inceledi ve kabul etti. Bu ajan source/test edit’ini
  dondurdu; bundan sonra revizyon gerekirse root’un yeni bulgusuna göre yapılır.
- Son durumdaki test kanıtı: bu source revizyonundan sonra Home Node suite
  **30/30**, ilgili Home ESLint, fixture/source syntax ve `git diff --check`
  geçti; gerçek TV DOM fixture **114/114**. Root kendi final Node/lint/buildgraph,
  paket ve kurulu runtime smoke kontrollerini yürütüyor; onların sonucu bu
  ajanın henüz iddia etmediği sonraki kontrol aşamasıdır.
- Son dosya kapsamı: bu rapora ek olarak `homeDataWindow.js`,
  `homeRowMetrics.js`, `homeScreenMethods-04-get-hero-focus-delay.js`,
  `homeScreenMethods-20-mount.js`, `homeScreenMethods-21-load-data.js`,
  `homeScreenMethods-22-pick-initial-hero.js`,
  `homeScreenMethods-23-render.js`, `homeScreenMethods-30-cleanup.js`,
  `homeScreenMethods-31-data-window.js`, `homeContinueWatchingLoad.js`,
  `homeDataWindowRuntime.test.mjs` ve `scripts/performance-data-window-check.js`.
- Aktif ajan/tool: `luna_patch01` source/test dondurdu; root final paket,
  buildgraph ve TV runtime smoke sahibi.
- Açık risk: root final paket/buildgraph/runtime smoke henüz sonuçlanmadı; bu
  ajan tarafındaki sonraki adım yok. Root başarısız kontrol için somut revizyon
  isterse yalnız ilgili değişikliği yap.
