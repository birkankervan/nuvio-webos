# webOS iş takibi

Güncel plan: [nihai mimari](plans/2026-10-05-webos-nihai-mimari.md).
Güncelleme: 6 Ekim 2026. Durumlar: planlandı → çalışılıyor → yerel doğrulandı →
runtime entegre → TV doğrulandı. Saf helper/test sonucu runtime tamamlandı sayılmaz.

| ID | İş | Sahip | Durum | Bağımlılık | Dosya / kanıt | Sonraki adım |
| --- | --- | --- | --- | --- | --- | --- |
| GITHUB-01 | Kullanıcının public GitHub reposuna yayın | root; publish_review salt okunur | yerel doğrulandı; push sırada | Kullanıcı yetkisi | birkankervan/nuvio-webos; 42 Node + lint; 101 dosya yayın kontrolü | Commit/push ve remote SHA doğrula |
| DOC-01 | Aktif plan, sahiplik ve checkpoint | root | yerel doğrulandı | Yok | Bu dosya, plan, devam notları | Ajan sonuçlarıyla güncelle |
| SRC-01 | Kaynak şeridinde tekrarlı düğmeler | load_review; root TV kabulü | TV doğrulandı | Yok | stream methods01/04/08; streamPerformance.test.mjs; scripts/stream-chips-dom-check.js | Düzeltme TV'ye kuruldu; gerçek akışta tekrar 0 |
| WIN-01 | Veri tabanlı saf pencere hesabı | window_model | yerel doğrulandı | Yok | homeVirtualWindow.js/test, WEBOS_SANALLASTIRMA_AJAN.md | 4 test/600 geometri; runtime renderer tüketimi bekliyor |
| FOC-01 | DOM bağımsız odak/navigasyon | focus_model | yerel doğrulandı | Yok | homeLogicalFocus.js/test, WEBOS_ODAK_AJAN.md | 3 test; runtime nav geçişi bekliyor |
| LOAD-01 | Detail/lazy/cancellation/cache incelemesi | load_review | yerel doğrulandı | Yok | WEBOS_YUKLEME_AJAN.md | 10 bulgu; stale rAF patch görevi LOAD-02 |
| RENDER-01 | Modern Home saf data adapter'ı | window_model | yerel doğrulandı | WIN-01, FOC-01 | homeVirtualRows.js/test, sanallaştırma raporu | 5 adapter testi; runtime renderer tüketimi bekliyor |
| MEASURE-01 | Değişken satır ölçüm ledger'ı | focus_model | yerel doğrulandı | WIN-01, FOC-01 | homeRowMetrics.js/test, odak raporu | 4 test geçti; runtime ölçüm bağlantısı bekliyor |
| RENDER-02 | Gerçek pencere renderer'ı | window_model | runtime entegre; TV smoke geçti | RENDER-01, MEASURE-01 | İlk markup + retained DOM bütçe testi | Modern layout'tan başla |
| NAV-01 | D-pad, return, sidebar, hold, pagination geçişi | window_model; focus_model inceleme | kısmi runtime entegre | RENDER-02 | Gerçek runtime regresyonları | DOM navModel yetkisini kaldır |
| SCROLL-01 | Home veri commit sırasında geometri/scroll kararlılığı | scroll_fix (Luna/max); scroll_nav_review salt okunur; root kabul | TV doğrulandı (dar kaydırma kabulü) | PATCH-02 | homeDataWindow.js + runtime testi; fixture133; installed max29→0px | Fiziksel kumanda ve geniş TV-01 kabulü ayrı; sıradaki LOAD-04..06 |
| PATCH-01 | Full Home render yerine bölgesel güncelleme | luna_patch01 (Luna 6 max); root inceleme | çalışılıyor | NAV-01 | Katalog chunk testleri | Row commit modelini uygula |
| LOAD-02 | Stale Detail sections rAF iptali | load_review | runtime entegre | LOAD-01 | methods08/methods27 + detailSectionsPerformance.test.mjs | Root 2/2 detail testi geçti; build/TV kabulü ayrıdır |
| LOAD-03 | Bounded metadata/TMDB cache | load_review | runtime entegre | LOAD-01 | YUK-B06 | Invalidation ve bütçe semantiğini test et |
| LOAD-04 | Hafif canonical ID dönüşümü | atanacak | planlandı | LOAD-01 | YUK-B04; mevcut tmdbToImdb helper | Enabled/timeout/shared signal farklarını koru |
| LOAD-05 | Base detail ve kişisel state bariyerini ayır | atanacak | planlandı | LOAD-02, LOAD-04 | YUK-B03 | Resume/Watched yanlış gösterilmesin |
| LOAD-06 | Route-owned abort, yorum dedup, dirty section patch | atanacak | planlandı | LOAD-05 | YUK-B05/B07/B10 | Shared in-flight tüketiciyi bozma |
| COMPAT-01 | Classic/Grid/CW split/collection adapter'ları | atanacak | planlandı | NAV-01 | Layout fixture'ları | Modern kabulünden sonra |
| TV-01 | Kontrollü cihaz performans/bellek kabulü | root | planlandı | PATCH-01, LOAD-02..06, COMPAT-01 | WEBOS_TEST_PLANI.md | Cold/warm/gerçek kumanda ayrımı |
| IPTV-01 | IPTV tek kaynak plan | root | yerel doğrulandı (plan) | Uygulama: TV-01 | plans/2026-10-06-iptv-plani.md | D1 ve 3 sn ilk kare hedefi onaylı; sonraki: TV-01 sonrası IPTV-S |
| IPTV-S | Transport/liste boyutu/akış formatı spike (webOS+Tizen) | root | planlandı; gate bekliyor | TV-01 | plans/2026-10-06-iptv-plani.md ön spike bölümü | S1-S3 sonuçlarını plana yaz |
| IPTV-02 | Xtream veri/credential/transport | atanacak data ajanı; root review | planlandı | IPTV-S | iptvSourcesStore/iptvRepository/adapter/test | Xtream sözleşmesi + izolasyon testleri |
| IPTV-03 | IPTV ekranı + TV hesap formu | atanacak UI ajanı | planlandı | IPTV-02 | js/ui/screens/iptv/* + CSS | Logical focus, kategori/arama/favori |
| IPTV-03R | Router/sidebar/i18n/config bayrağı entegrasyonu | root | planlandı | IPTV-03 | router, sidebar helpers, i18n, js/config.js | Sidebar sıra testi iki Discover modu |
| IPTV-04 | Live player izolasyonu | atanacak player ajanı; root review | planlandı | IPTV-02/03 | mount, controller -17/-20, scrobble start, test | Guard tek yerde; URL sızıntısı 0 |
| IPTV-05 | Xtream MVP TV kabulü (QR yok) | root | planlandı | IPTV-03R, IPTV-04 | Plan kabul matrisi | webOS + Tizen |
| IPTV-06 | M3U import | atanacak data/UI sahipleri | planlandı | IPTV-05 | Parser/test + kaynak formu | Gerçek M3U fixture/TV |
| IPTV-07 | EPG şimdi/sonraki ve günlük liste | atanacak data/UI sahipleri | planlandı | IPTV-06 | EPG adapter/test + UI | Timezone, tvg-id, bounded cache |
| IPTV-08 | Tam regresyon (Xtream+M3U+EPG) | root | planlandı | IPTV-07 | Plan kabul matrisi | İki platform + auth/profil/addon/VOD |
| IPTV-09 | QR/telefon kurulumu (ayrı iş) | atanacak service ajanı; UI/bridge ayrı | planlandı | IPTV-05 | Önce LAN listener spike (webOS+Tizen) | Spike sonrası dosya listesi |

## Dosya sahipliği

- window_model: yeni homeVirtualWindow.js/test, homeVirtualRows.js/test ve kendi raporu.
- focus_model: yeni homeLogicalFocus.js/test, homeRowMetrics.js/test ve kendi raporu.
- load_review: WEBOS_YUKLEME_AJAN.md; root atamasıyla detail methods08/methods27 ve yeni detailSectionsPerformance.test.mjs.
- root: aktif plan, bu tablo, devam notları, mevcut raporların index/status güncellemesi.

Ajanların ilk işi runtime'a bağlanmaz. Aynı anda mevcut Home dosyaları üzerinde
çakışan edit yapılmaz. Yeni sözleşmeler root tarafından birlikte kontrol edilir.

## Mevcut runtime — tarihsel tamamlanan işler

Home cache pencereleme, keyed stream update/batch, lazy route build, lifecycle,
hero copy fix, sabit TV skeleton, idle detail UI prefetch ve birkan marker
uygulandı ve TV'ye kuruldu. 9 yerel test + 21 izole TV DOM kontrolü son bilinen
sonuçtur. Nihai veri tabanlı renderer bu listeye dahil değildir.

## İş günlüğü

- 2026-10-05: Kullanıcı nihai mimarinin planlanmasını, subagent çalışmasını ve
  context daralması öncesi MD checkpoint istedi. Üç ajan yukarıdaki dosya sınırlarıyla başladı.

- 2026-10-05 / A1 teslim: WIN-01 ve FOC-01 modülleri root tarafından birlikte
  çalıştırıldı: 7/7 test geçti. Runtime import/wiring yapılmadı.
- 2026-10-05 / atama: window_model RENDER-01 Modern veri adapter'ına geçti;
  load_review doğrulanan stale Detail rAF bulgusunun minimal fix/testini uyguluyor.
- 2026-10-05 / checkpoint: AGENTS.md proje başlangıcı ve context öncesi checkpoint
  protokolünü kaydeder. Upstream .gitignore AGENTS.md'yi ignore eder; yerel dosya
  mevcut, diğer takip/plan MD'leri ignore edilmez. Commit/staging yapılmadı.

- 2026-10-05 / yükleme incelemesi: meta/all-progress bariyeri, TMDB canonical ID
  için tam enrichment beklemesi, sınırsız metadata cache ve stale section rAF
  bulguları kayıtlı. ScreenUtils.hide zaten DOM temizler; ek hidden-DOM leak iddiası
  kaynak doğrulamasıyla çıkarıldı.
- 2026-10-05 / LOAD-02: queued section işi cleanup'ta iptal edilir; token/route/frame
  sahipliği korunur. Root iki detay testini tekrar çalıştırdı: 2/2 başarılı.
- 2026-10-05 / RENDER-01 ilk teslim: adapter + dört test; root malformed identity/
  collection action edge'ini son incelemeye gönderdi. MEASURE-01 ayrı ajan işi başladı.

- 2026-10-05 / RENDER-01 son teslim: malformed ID/collection guard + tv/channel
  semantiği düzeltildi. Window ve adapter'ın toplam 9 testi geçti. Canonical item
  source index ile logical cursor array index farklı olabilir; renderer sözleşmesi
  raporda açık. Runtime bağlı değil.
- 2026-10-05 / LOAD-01 rapor reuse: canonical ID için TmdbService.tmdbToImdb mevcut.
  Full enrichment enabled gate ile helper'ın enabled/timeout/signal farkları
  uygulanmadan önce korunmalı. Root LOAD-03..06 ayrı backlog kalemleri ekledi.

- 2026-10-05 / toplu doğrulama: **30/30 Node testi**, lint, webOS paketleme,
  paket/build graph kontrolü ve diff whitespace kontrolü başarılı. Üç ajan
  tamamlandı. Saf modeller runtime'a bağlı değil; LOAD-02 patch'i yerel pakette
  var, bu tur TV'ye kurulmadı.
- Sonraki uygulama RENDER-02 Modern veri renderer'ı, ardından NAV-01.
  İlk tam markup, detached DOM saklama ve DOM navigasyon yetkisi kaldırılmadan
  nihai sanallaştırma tamamlandı sayılmaz.

- 2026-10-05 / devam: kullanıcı az token ve subagent istedi. Home runtime tek edit sahibi window_model; focus_model read-only nav haritası/review; load_review cache ownership incelemesi ve bağımsız patch. Root entegrasyon/test/MD sahibi. Kısa rapor sözleşmesi.

- NAV readonly harita tamamlandı: focus_model raporunda source/logical index,
  Back, hold, sidebar, hover ve pagination çağıranları var. Yeni browser harness
  scripts/performance-data-window-check.js sahibi focus_model; Home edit yok.
  Root TV Inspector bağlantısını yeniden açtı (terminal3228); salt-okunur,
  yeni paket kurulmadı. Port geçici; yeniden keşfet.

- LOAD-03 root testi1/1 geçti; suffix cache lookup recency korunuyor. Shared pending requests ve auth semantiği değişmedi. Bütçe entry sayısı, cihaz byte/heap optimumu değil. Runtime paket/TV doğrulaması bekliyor.

- İzole yeni renderer gerçek TV tarayıcı testi ilk restoreScroll kontrolünde
  başarısız: eski live scroll saved Back state'i eziyor. window_model düzeltme
  sahibi. Bütün senaryo geçti veya runtime kuruldu iddiası yok.

- Renderer fixture iki lifecycle düzeltmesinden sonra gerçek TV tarayıcısında
  59/59 geçti;20x100 veri ilk2satır/8kart. Installed Home/kumanda runtime kabulü
  ayrı; mevcut installed app değişmedi.

- Root Modern shell bypass testi eklendi: modernDataWindowLayout.test.mjs.
  virtualRowsMarkup 20x100 veride catalog/CW fullmarkup çağırmaz; boş window
  fallback değildir; SeeAll data payload ve eski nonwindow15limit korunur.1/1geçti.
- Runtime sahibi: Modern çekirdek odak/veri otoritesi renderer.rows/focus;
  navModel bazı eski görsel helper'lar için sadece mounted DOM projeksiyonu
  olarak kalıyor. NAV-01 strict projection temizliği ve PATCH-01 bölgesel data
  arrival güncellemesi açık. Bu aşamada nihai mimari tamamlandı denmeyecek.

- Final kontrol:35/35 Node, lint, webOS paketleme, build graph ve diffcheck geçti.
  Yeni data fixture77/77 +eskiDOM21/21 gerçek TV tarayıcısında başarılı.
- LG nuvio-lg-145'e close/install/launch başarılı. Installed Home Modern:
  dataWindow=true, legacyCache=false,31logicalrow/769cards;2mountedrow/13cards,
  map13/trackhandlers2; birkan marker mevcut, focus connected.
- Tek warm synthetic10right10left: aynılogicalfocus, maxindex10;24mountedcards,
  handlerp9517.1ms, rAFp9533.3ms/max50ms, longtasks0. Bu kontrollü A/B veya
  gerçekkumanda/FPS kabulü değil; handler hedef16.7ms henüz sağlandı denmez.
- Gerçek route smoke:20.kart→detail→Back aynı row/index/item, focusconnected;
  dataRendereraktif,25mountedcards. Skeleton o anda yoktu (animationnull).
- Sıradaki: PATCH01 dataarrival satırcommit; NAV01 mountedview projection
  strictDOM-free cleanup; Classic/Grid datawindow; LOAD04..06; ardından
  tekrar/soğuk/gerçekkumanda/video/bellek kabulü. IPTV hâlâ bekliyor.

- SRC-01 kaynak seçici tekrar bug inceleme/fix: load_review stream kaynak dosyaları/test sahibi; root TV repro, kabul/paket/MD. Home performans işleri bu bug sırasında kapsam dışı.

- SRC-01 tamamlandı: authoritative chip/window DOM replacement artık generated
  node kaydını yeniler; tam keyed render önceki düğmeleri tekrar eklemez. Aynı
  batch'teki bilinmeyen kaynak adı da yalnız bir kez eklenir.
- 36/36 Node testi, lint, paket/build graph ve diffcheck başarılı. İzole kaynak
  şeridi yenileme fixture'ı gerçek TV tarayıcısında 17/17 geçti. Yeni paket
  LG nuvio-lg-145'e kuruldu/açıldı. Aynı film manual source flow: 58 stream
  completed; önce 2 fazla duplicate button, sonra 0; model duplicate 0.
  Test sonunda Home'a ve önceki odağa dönüldü; autoplay kullanılmadı.

- PATCH-01 ataması: kullanıcı Luna 6/max modelini istedi. Adım planı plans/2026-10-05-home-bolgesel-guncelleme.md; source baseline /private/tmp/nuvio-patch01-baseline. Root yalnız bu tur farklarını okuyup inceleyecek, sorunları yeniden yazdıracak.

- PATCH-01 root erken inceleme: ölçüm Map alias, duplicate cache slot, unknown
  setRows stale metadata/geometry, sourceRowIndex ve upcoming sourceIndex cache
  imzası bulguları Luna'ya revizyona gönderildi. Kaynak henüz tamamlandı sayılmaz.
  Root gerçek TV'de renderer/shell/card identity ve markup çağrı sayımı kontrolünü
  hazırladı; kurulum yeni kaynak freeze ve testlerden sonra yapılacak.

- PATCH-01 kaynak Luna 6/max tarafından tamamlandı, root baseline diff ve callers
  incelemesi yaptı; bulgular aynı ajana yeniden yazdırıldı. 39/39 Node, lint,
  package/buildgraph/diff başarılı; genişletilmiş izole TV DOM fixture114/114 geçti.
  Yeni IPK nuvio-lg-145 TV'ye kuruldu ve açıldı; birkan marker mevcut.
- PATCH-01 gerçek uygulama kabulü TAMAMLANMADI: geri alınan aynı-ID metadata
  probe'u renderer/shell/sidebar/hero/card/focus/scroll kontrollerini geçti fakat
  'unchanged row cards rerendered' verdi. Eşzamanlı background callback mi,
  yeni viewport working-set mi, cache bug mı henüz ayırt edilmedi. Probe finally
  özgün payload ve metotları geri yükledi. Başarılı ölçüm diye raporlanmayacak.
- Diagnostic TV eval otomatik approval review tarafından çalıştırılmadı:
  kullanım limiti doldu; denetim tamamlanamadı, güvenlik reddi değildir.
  Yeniden TV tanılama/legacy21/source17/nav/detailBack smoke bekliyor; onay
  denetimi başka araç veya sandbox dışı yol kullanılarak aşılmayacak.

- SRC-02 Anthlogy kaynağı kaybolma araştırması: kullanıcı önce çalışan repo'nun
  güncellemelerden sonra kaynaklarda görünmediğini bildirdi. Tek Luna6/max ajan
  stream/plugin filtreleri, son stream/build diff ve regression test incelemesi
  sahibi; root TV read-only tanılama ve entegrasyon/review sahibi. Önce neden
  kanıtlanacak; henüz uygulama regression'ı veya upstream arızası kesin değil.

- SRC-02 neden gerçek TV'de doğrulandı: yeni paket local.example fallback ile
  boş TMDB_API_KEY taşıyor. IMDb -> TMDB null, plugin execution0/groups0,
  Anthology loading/error/absent; diğer addon128stream. Repo41provider/34enabled
  ve motor ready olduğu için repo silinmesi/worker sorunu değil. Root paketlemede
  eksik ayarı gözden kaçırdı. Araştırma tamam; doğru config yolu kullanıcıya
  soruldu. Plan plans/2026-10-05-anthology-kaynak-arastirmasi.md. Source edit yok.

- 2026-10-05 / REVIEW-01 başladı: kullanıcı subagent'larla tüm proje mimari,
  performans ve memory leak incelemesi istedi. Dört read-only ajan, kaynak edit yok:
  rev_home (home + navigation + bootstrap/app.js), rev_player (screens/player +
  core/player + platform), rev_screens (detail/stream/search/library/settings/
  diğer ekranlar + ui/components), rev_core (core/* hariç player, data/*, domain).
  Root birleştirme, doğrulama ve WEBOS_GENEL_INCELEME.md sahibi.

- SRC-02 tamam (2026-10-05): kullanıcı TMDB ayarıyla strict paket TV'ye kuruldu.
  Matrix: IMDb dönüşümü başarılı, Anthology loading→success, 15 grup/26 stream
  callback toplamı (benzersiz sayım değil). Aktif profil hafif ayarları uygulandı;
  CW/native altyazı korundu. Probe temizlendi, Home/focus/birkan doğrulandı.
  Dizi kabulü ayrıca yapılmadı; PATCH-01 ve REVIEW-01 ayrı açık.

- UI-01 (root): kullanıcı sağ üst birkan doğrulama yazısını kaldırmayı istedi.
  renderAppShell.js tek marker satırı silindi; AGENTS kuralı yeni isteğe göre
  güncellendi. Lint/strict paket ve TV kurulumu/doğrulaması sürüyor.
- UI-01 TV doğrulandı: lint, strict package, buildgraph ve diffcheck geçti.
  nuvio-lg-145 close/install/launch başarılı; gerçek TV markerAbsent=true,
  route=home. TMDB yapılandırması ve hafif profil yeniden açılışta korundu.
- 2026-10-05 / REVIEW-01 teslim: dört ajan tamamlandı. Rapor: WEBOS_GENEL_INCELEME.md
  (R-01..R-12 perf, M-01..M-09 bellek). Root örneklenen bulguları kodda doğruladı:
  R-01 keepAwake timeupdate native çağrısı, R-02 profileScopedStore parse, R-05
  homeDataWindow sync, R-06 Library rect, M-01 sınırsız enriched cache, M-02 profil
  subscribe, M-03 bitmap cache, M-05 folder resize listener. Kaynak edit yok; test
  çalıştırılmadı (kod değişmedi). Fix ataması kullanıcı onayı bekliyor.

- UI-02 TV doğrulandı: kullanıcı hero kapalıyken üstte kalan siyah alan nedeniyle
  kapatma kararını geri aldı. Aktif TV profilinde yalnız heroSectionEnabled=true
  kaydedildi; Home yenilendi, heroPresent/focusConnected=true. Kaynak edit veya
  yeni paket yok. Hero kapalı layout boşluğu ileride ayrıca incelenmeli.

- PATCH-02 başladı: kullanıcı Cavecrew/subagent ile sonraki performans adımını
  istedi. cave_home_review (Luna6/max) read-only Home PATCH-01/R-05 incelemesi;
  root gerçek TV tanılama/plan/entegrasyon sahibi. Amaç unchanged-row markup
  kabul açığını kapatmak; hero açık kullanıcı tercihi korunacak. Builder dosya
  sınırı kanıtlı inceleme sonrası atanacak. Credential dosyaları ajanlara kapalı.

- 2026-10-05 / IPTV-01 plan ataması: kullanıcı bütün repo MD dosyalarının okunmasını
  ve Luna/max subagent istedi. iptv_plan yalnız WEBOS_IPTV_AJAN.md sahibi; tüm
  MD ve IPTV/player/storage/router kaynakları salt okunur. Root timestamp plan,
  index, iş takibi ve devam notları sahibi. Kaynak/test/build/TV editi yok.
  Performans kabulü uygulama önkoşulu olarak korunur; bu tur plan hazırlanır.
- 2026-10-05 / REVIEW-02 başladı: kullanıcı mevcut uncommitted performans
  değişikliklerinin Sonnet 5.5 subagent'larla gerekçe + doğruluk incelemesini istedi.
  Üç read-only ajan, kaynak edit yok: rev2_home (Home data window/virtualizer/
  keyedDomUpdate + home diff), rev2_nav (router/lazyRoute/build/scripts/app/index/
  routeStateStore), rev2_load (stream/detail/player/tmdb/meta/boundedCache/css).
  Root sonuç dosyası WEBOS_DEGISIKLIK_INCELEMESI.md sahibi.

- IPTV-01 ara karar: root başlangıçtaki 21 repo MD dosyasını okudu. Kaynakta
  ayrı IPTV route/sidebar/parser bulunmadı; player live tip tanıması mevcut.
  Router history currentParams taşır; player progress live guard incelemesi
  gerekiyor. Kaynak sırası optional soruldu; yanıt gelmezse M3U → Xtream → EPG
  önerisi varsayım olarak kaydedilecek. iptv_plan Luna/max çalışıyor; tek MD sahibi.
- PATCH-02 gate: inceleyen ajan/root aynı minimal sorgu batching bulgusunu
  doğruladı. cave_home_builder yalnız homeDataWindow.js + yeni query regression
  testi sahibi. Geniş sync cache/measurement atlama ertelendi; invalidation,
  odak, genişleme, scroll davranışı korunur. Rapor WEBOS_HOME_SORGU_AJAN.md.
- 2026-10-05 / REVIEW-02 teslim: üç Sonnet ajanı tamamlandı; rapor
  WEBOS_DEGISIKLIK_INCELEMESI.md. 20 KEEP, 7 KEEP+FIX, 1 gerekçesiz (H8 hero
  preload), REVERT yok. Root doğruladı: N2 Back requestId yarışı, N1a load-app
  fallback yok, H1a ilk sync çift innerHTML, L8 rAF erken return. Testler
  Home30/30, nav4/4, load5/5, lint temiz. Kaynak edit yok; fix onayı bekliyor.

- IPTV-01 güncel MD uzlaştırması: paylaşılan çalışma ağacına REVIEW-02 raporu,
  Home sorgu ajan raporu ve PATCH-02 timestamp planı eklendi; root üç MD
  dosyasını da okudu. Checkpoint38 PATCH-01 stable runtime probe iki kez15/15
  geçtiğini kaydeder; eski açık unchanged-row durumu plan taslağında güncellendi.
  Geniş TV-01 kabulü açık. PATCH-02 kaynak sahipleri başka chat'tedir; IPTV
  bu dosyalara dokunmaz. Luna yalnız IPTV raporu sahibi olarak devam ediyor.

- IPTV-01 kullanıcı kararı: Xtream önce, M3U sonra; EPG üçüncü aşama. Root
  plan ve IPTV-02/05/06 panosunu buna göre güncelledi; Luna rapor sırası revize
  ediyor. Plan kaynak kodu uygulaması değildir; TV-01 gate korunuyor.

- PATCH-02 tamam/TV doğrulandı: iki Cavecrew Luna6/max ajanı, root kod review.
  HomeDataWindow geçiş başına2sorgu;20sync140→40. 41test/lint/package/buildgraph,
  isolatedTV114 geçti; yeniIPK kuruldu. Hero açık ve TMDB korunur. PATCH-01
  dirtyrow ölçüm resetindeki geçici pencere/scroll sapması ayrı açık.
  Sonraki minimal iş bu measurement invalidation repro/fix ve TV kabulü.

- 2026-10-05 / IPTV-01 teslim: Luna6/max raporu tamamlandı, root kaynak
  kanıtlarını ve kullanıcı sırasını inceledi. Xtream canlı MVP → M3U → EPG;
  sahiplik/dosya sınırları ve yerel/DOM/gerçek TV kabulü timestamp plana yazıldı.
  Repo MD'leri (başlangıç21 + eşzamanlı eklenen3) okundu; yeni plan ve rapor da
  gözden geçirildi. MD yerel link kontrolü/diffcheck geçti. Bu chat runtime
  kaynak/test/build/paket/TV değiştirmedi; test sonucu performans kabulü değildir.
  iptv_plan tamamlandı; aktif IPTV ajan/tool/probe yok. TV-01 uygulama gate
  korunur; sonraki iş gate sonrası IPTV-02 Xtream veri sözleşmesi.

- IPTV-01 UX kapsam revizyonu: kullanıcı sidebar'da Kütüphanem üstünde IPTV,
  TV'den hesap girişi ve isteğe bağlı QR/telefon formu → OK → TV'ye kayıt istedi.
  Nuvio tasarım dili ve modern kanal listesi kesin gereksinim. Root plan/pano/
  checkpoint sahibi; iptv_plan Luna/max yalnız WEBOS_IPTV_AJAN.md ek QR/service
  uygunluk incelemesi sahibi. Runtime/source/build/TV işlemi yok.

- SYNC-01 (root) başladı: kullanıcı yeni sürümü pull ve conflict çözümü istedi.
  HEAD358d08c/v1.2.2, origin/main25b984f/v1.2.3,10commit fast-forward.
  Mevcut dirty/untracked performans işleri stash yedeğiyle korunacak; ignored
  local.properties saklanır. Root merge/geriuygulama/test sahibi. Push yok.

- IPTV-01 UX ara teslim: timestamp plan IPTV menüsünü Kütüphanem üstüne sabitledi;
  hesap formu ve QR ilk Xtream MVP kapsamına alındı. IPTV-09 ayrı setup listener
  + mevcut QR/Luna bridge reuse, profile-bound TTL/token, telefon OK → TV persist
  ACK → kanal ekranı; Nuvio token/kart/sidebar/odak stilleri. Mevcut loopback
  privileged servisler LAN'a açılmaz. Gerçek LAN capability henüz ölçülmedi.
  Root LG JS Service Basics ağ/lifecycle kaynağını okudu; erişim garantisi değildir.
  Luna rapor revizyonunda aktif; runtime/source/test/build/TV işlemi yok.

- SYNC-01 tamam:1.2.3/25b984f pullff ve yerelstashapply, Gitconflict0.
  Home19/24/30automerged root+Cavecrewsemanticreview sorunsuz.49tracked ve
  51untrackedkorundu; stashbackup saklandı.41test/lint/strictpackage/buildgraph/
  pluginforwarding/diffcheckgeçti. YeniIPK hazır; TVkurulumu yapılmadı.

- SYNC-01 TV kurulumu tamam: kullanıcı1.2.3'ü TV'ye gönderme ve mevcut ayarları
  koruma istedi. nuvio-lg-145 close/install/launch başarılı. GerçekTV aktifprofil
  veHome açıldı; TMDBconfigured/hero/CW true; trailerAutoplay/optionalTMDB/
  postPlayRecommendations/streamLogos/posterExpansion false; subtitlesnative,
  markerAbsenttrue. Tercihstore'larına yazılmadı, uninstall/reset yapılmadı.

- IPTV-01 UX/QR revizyon teslimi: Luna/max raporu güncellendi, root okudu;
  planı değiştiren kritik blocker yok. IPTV etiketi/Kütüphanem üstü, TV formu,
  optional QR ilk Xtream MVP, Nuvio tasarım dili ve modern kanal ekranı kesin.
  IPTV-09→IPTV-05 dependency kaydedildi. MD link/kapsam/dependency ve diffcheck
  geçti. LAN capability henüz TV+telefon test edilmedi; runtime/test/build/TV
  editi yok. iptv_plan tamam, aktif IPTV ajan/tool yok.

- 2026-10-06 / SCROLL-01 başladı: kullanıcı önceliği Modern Home veri güncellemesi
  sırasında geçici satır yüksekliği/kaydırma sapması. Root kaynak ve test edit,
  plan/MD/TV entegrasyon sahibi; scroll_review Home geometri/callers salt okunur
  inceleme sahibi (kaynak edit yok). Dosya sınırı root: homeDataWindow.js,
  ilgili Home regression testi ve performance-data-window-check.js. Mevcut
  dirty değişiklikler korunur; kalan performans/IPTV işleri sırada bekler.

- SCROLL-01 yeni atama: scroll_fix gpt-6-luna/max yalnız homeDataWindow.js ve
  homeDataWindowRuntime.test.mjs edit sahibi; scroll_nav_review aynı model/max
  salt okunur geometri/Back/pagination inceleme. Root fixture/MD/build/TV sahibi.
  Eski scroll_review interrupted; eşzamanlı dosya editi yok.

- SCROLL-01 root DOM fixture: ölçülen 350px kart + 76.4px header; commit, ilk sync
  ve sonraki frame için satır konumu/scroll/focus kontrolü eklendi, henüz koşmadı.
  Inspector wrapper PATH ares-inspect bulamadı; mevcut bundled CLI ile bağlantı
  açıldı. Kaynak/ayar değişikliği yok; geçici bağlantı yeniden keşfedilir.

- SCROLL-01 gerçek TV izole DOM regression eski kaynakla başarısız: `metadata
  commit discarded measured geometry before sync`. 350px kart/76.4px header
  ölçüsü commit anında kayboluyor; sonraki frame ölçümü sorunu gizleyebilir.
  Fixture finally temizlendi. Ajan fix/review aktif; sonraki yeni kaynakla aynı
  fixture + Node/lint/strict paket ve installed Home kabulü.

- SCROLL-01 installed Home eski paket probe: 3 metadata update/17 örnekte
  yükseklik, anchor offset, scrollTop ve görsel satır konumu max29px sapıyor.
  Renderer/shell/focus/track korundu; geçici veri/metot/odak finally geri alındı.
  Kaynak baseline /private/tmp/nuvio-scroll-before.js; düzeltme henüz teslim değil.
  Read-only ajan kökü doğruladı, collection shrink/layout reset riski buildera
  iletildi. Sonraki fix review + aynı installed probe yeniden kabul.

- 2026-10-06 / IPTV-01 plan review: Sonnet read-only subagent reviewed
  plans/2026-10-05-iptv-plani.md + WEBOS_IPTV_AJAN.md against source. No files
  edited. Critical: Tizen absent from plan; IPTV-05 hard-depends on "optional"
  IPTV-09 QR (unproven LAN listener); Xtream player_api/user_info/output format
  and connection-limit missing; CORS/mixed-content transport undecided;
  credential storage decision deferred; 10k/20MiB cap vs category-lazy load;
  IPTV-05 definition differs plan vs agent report; 09/08 ordering. Plan not yet
  revised; next step awaits user decision on applying revisions. No active agent.

- SCROLL-01 aktif dar plan: plans/2026-10-06-home-kaydirma-kararliligi.md.
  Öncelik ve kalan altı aşama kullanıcı sırasıyla kaydedildi; IPTV TV-01 sonrası.
  İki yeni ajan Luna/max; fix teslimi bekleniyor, installed eski29px baseline
  ve fixture failure kayıtlı. Sonraki source review/Node/fixture/paket/TV.

- SCROLL-01 ara kaynak TV izole fixture131/131 geçti. Yeni17 kontrol metadata
  commit/ilk sync/ölçüm frame üç tekrar ve ölçülmüş400px collection track
  korumasını kapsar. 20x100 initial2row/8card;200.öğe/Back/reorder/removal/cleanup
  mevcut kontrolleri korundu. Installed Home hâlâ eski paket,29px baseline.
  Builder Node test ve readonly review aktif; root strictpaket/TVkurulum bekliyor.

- SCROLL-01 source freeze: homeDataWindow.js measurement signature snapshots,
  runtime test yeni measured geometry/loading/shape regression. Root42/42Node
  ve lint geçti; son renderer kaynağı TVfixture131/131. Erken review collection
  track reset ve snapshot cleanup bulguları aynı ajan tarafından düzeltildi.
  Readonly final review aktif; strict package çalışıyor. Installed TV değişmedi;
  sonraki buildgraph/diff ve review sonucu sonrası close/install/launch/probe.

- SCROLL-0142Node/lint/strictpaket/buildgraph/diff başarılı; root source/callers
  incelemesi tamam, readonly bağımsız son rapor bekliyor. TV close/install/launch
  işlemi başladı (tool19047); settings boolean baseline önceyle aynı: hero/CW/
  TMDBconfigured true, subtitles native, opsiyoneller false, marker yok. Ham
  ayar/credential okunmadı. Sonraki yeni Inspector keşfi, installed metadata
  3repeat probe, fixture131, sentetik nav/Back ve actual page; fiziksel kabul ayrı.

- 2026-10-06 / IPTV-01 consolidation: user decided Tizen is in scope (webOS +
  Tizen acceptance for every IPTV delivery) and QR is a separate job (IPTV-09,
  depends on IPTV-05, not on MVP). Review findings applied. Single source is now
  plans/2026-10-06-iptv-plani.md; plans/2026-10-05-iptv-plani.md and
  WEBOS_IPTV_AJAN.md were merged and deleted at user request (older log entries
  referencing them are historical). New IDs: IPTV-S (S1 transport, S2 list size,
  S3 stream format spikes) and IPTV-03R (root shared integration). Open: D1
  credential storage approval. Next: close TV-01, then run IPTV-S on both TVs.
  No active agent.

- SCROLL-01 final readonly review iki kabul açığı buldu: exact header title
  imzası aynı yüksekliğe rağmen section ölçüsünü siliyor; collection same-shape
  append/remove bütün ölçüleri siliyor. Builder aynı dosyalarda revizyon sahibi;
  root fixture title+append/prune kontrolü ekledi. İlk strict paket TVye kuruldu,
  fakat installed kabul tamamlanmadı; son revizyon yeniden42test/lint/paket/TV
  gerektirir. Önceki131DOM bu yeni iki durumu kapsamıyordu.

- SCROLL-01 ilk düzeltme installed Home aynı3metadata update:10örnek, height/
  offset/scroll/görseltop max0px (eski29px). Renderer/shell/focus/track true;
  probe finally özgün veri/metot/odağı geri aldı. Bu dar koşul düzeldi; review
  title/same-shape collection ek koşulları revizyonda, iş henüz kabul edilmedi.

- SCROLL-01 revizyon freeze: title imzası ve offscreen title rendering kaldırıldı;
  collection max shape height aynıysa ölçüler korunur, yalnız değişen existing
  indeksin ölçüsü temizlenir. Append/prune/tallest removal Node regression eklendi.
  Root42/42Node ve güncel TV izolefixture133/133 geçti; lint son tur çalışıyor.
  Son readonly review ve yeniden strictpaket/TVinstalled kabul bekliyor.

- 2026-10-06 / IPTV-01 decisions: user approved D1 (profile-scoped local store,
  seedFromPrimary:false, silentSync:true, not presented as a vault; source
  delete/logout/profile delete wipes that profile's IPTV data) and the
  channel-select to first real frame target p75 <= 3 s. Plan updated; no open
  plan decision left. Next: close TV-01, then IPTV-S spikes on webOS + Tizen.

- SCROLL-01 son review ciddi blocker yok.42Node/lint/strictpackage/buildgraph/
  diff geçti; sonrendererTVfixture133/133. Yeni final paket close/install/launch
  tool71294 çalışıyor. İki Luna/max ajan tamam; root installed kabul sahibi.
  Sonraki Inspector yeniden keşfi + metadata3repeat/nav/Back/page/settings.

- SCROLL-01 final paket TVde: metadata3update/10sample maxheight/offset/scroll/
  görseltop0px; externalInputDuringProbe=false; renderer/shell/focus/track true.
  Sentetik warm10sağ10sol aynılogicalfocus/maxindex10,focusconnected;21mounted/
  796logicalcards. Handlerp9518.8ms,rAFp9550ms,max66.7ms,15longtasks/max62ms.
  Performans hedefleri karşılanmadı; tek warm örnek genelhızlanma/gerçekkumanda
  veya TV-01 kabulü değildir. Root detailBack tool81872 aktif; actualpagination/
  settings ve finalcheckpoint sırada. Probe finally özgün state geri aldı.

## SCROLL-01 teslim — 6 Ekim 2026

- Son kaynak: homeDataWindow.js, homeDataWindowRuntime.test.mjs;
  root DOM fixture: scripts/performance-data-window-check.js.
- Metadata/header güncellemesinde ölçüler korunur; collection same-shape append/
  prune mevcut indeks ölçüsünü korur. Changed index, loading/kind/CW-style ve
  gerçek max shape height değişimi ilgili ölçüleri yeniler. Unknown update
  geniş reseti korunur; snapshot Map destroy ile temizlenir. Kaynakta yeni
  dependency yok; mevcut uncommitted değişiklikler korundu, stage/commit/push yok.
- İki Luna/max ajan teslim ve bağımsız review tamam; root inceleme/rewrite yaptı.
  42/42 Node, lint, strict package, build graph ve diffcheck geçti. TV izole
  fixture133/133;20×100 ilk2row/8card, distant200/Back/cleanup dahil.
- Final1.2.3 paket nuvio-lg-145 close/install/launch başarılı. Installed Home
  üç metadata update/10 örnek: height/offset/scroll/görseltop max0px (önce29px),
  external input false; shell/renderer/focus/track korundu.
- Sentetik10sağ10sol aynı logical focus/max10; Detail→Back aynı row/item/index10,
  main/track scroll delta0, focusconnected. Gerçek pagination40→58 logicalcard,
  nextSkip40→60, duplicate0, odak/renderer ve main/track scroll korundu; inFlight0.
- Profil/hero/CW/TMDBconfigured korundu; native altyazı, opsiyoneller kapalı,
  marker yok. Ham storage/credential alınmadı; probe metot/veri/odağı geri aldı.
- Geniş performans kabulü açık: tek warm sentetik sample handlerp9518.8ms,
  rAFp9550ms/max66.7ms,15longtask/max62ms. Hedefler geçmedi; gerçek kumanda,
  cold/video/uzun bellek ve diğer layout kabulü yapılmadı. IPTV hâlâ TV-01 sonrası.
- Sonraki çalışma: LOAD-04..06 detail/kaynak ilk görünüm ve cancellation;
  Home fiziksel kumanda smoke ayrıca. Plan kullanıcı sırasını korur.

## GITHUB-01 — 6 Ekim 2026

Kullanıcı kendi GitHub hesabında herkese açık yeni repo veya fork oluşturup mevcut
değişiklikleri pushlamayı açıkça istedi; önceki stage/commit/push yok kısıtı bu iş
için kaldırıldı. Sahip root: Git, iki takip MD dosyası ve yayın doğrulaması.
Yayın kontrol ajanı salt okunur; dosya editi yok. Mevcut runtime kaynakları
korunacak. Son bilinen 42 Node/lint/paket ve 133 TV DOM kontrolü geçerli; bu
yayın runtime veya geniş TV-01 kabulü değildir. Sonraki: hesap/hedef keşfi,
yayın dosyaları kontrolü, commit, public repo oluşturma, push ve remote SHA kontrolü.

### GITHUB-01 yayın kontrol noktası

Public repo oluşturuldu: https://github.com/birkankervan/nuvio-webos.
42/42 Node ve lint yeniden geçti; diff whitespace kontrolü başarılı.
publish_review salt okunur 101 modified/untracked dosyada credential/token/
private addon URL/ham storage eşleşmesi bulmadı; GPLv3 LICENSE korunur.
Ignored local.properties, build çıktıları, cihaz paketleri ve node_modules
gönderilmeyecek. Upstream origin korunur; yeni personal remote kullanılacak.
Root commit/push sahibi; ajan tamamlandı. Sonraki: bu kaynak ve MD snapshotını
commit et, personal/main pushla, remote SHA ve public görünürlüğü doğrula.
Geniş TV-01 ve LOAD-04..06 açık; yayın performans kabulü sayılmaz.
