# webOS iş takibi

Güncel plan: [nihai mimari](plans/2026-10-05-webos-nihai-mimari.md).
Güncelleme: 6 Ekim 2026. Durumlar: planlandı → çalışılıyor → yerel doğrulandı →
runtime entegre → TV doğrulandı. Saf helper/test sonucu runtime tamamlandı sayılmaz.

| ID | İş | Sahip | Durum | Bağımlılık | Dosya / kanıt | Sonraki adım |
| --- | --- | --- | --- | --- | --- | --- |
| GITHUB-01 | Kullanıcının public GitHub reposuna yayın | root; publish_review salt okunur | GitHub yayımlandı | Kullanıcı yetkisi | birkankervan/nuvio-webos; 42 Node + lint; 101 dosya yayın kontrolü | Kaynak commit 88a46ca main dalına gönderildi; takip checkpointini yayınla |
| DOC-01 | Aktif plan, sahiplik ve checkpoint | root | yerel doğrulandı | Yok | Bu dosya, plan, devam notları | Ajan sonuçlarıyla güncelle |
| SRC-01 | Kaynak şeridinde tekrarlı düğmeler | load_review; root TV kabulü | TV doğrulandı | Yok | stream methods01/04/08; streamPerformance.test.mjs; scripts/stream-chips-dom-check.js | Düzeltme TV'ye kuruldu; gerçek akışta tekrar 0 |
| WIN-01 | Veri tabanlı saf pencere hesabı | window_model | yerel doğrulandı | Yok | homeVirtualWindow.js/test, WEBOS_SANALLASTIRMA_AJAN.md | 4 test/600 geometri; runtime renderer tüketimi bekliyor |
| FOC-01 | DOM bağımsız odak/navigasyon | focus_model | yerel doğrulandı | Yok | homeLogicalFocus.js/test, WEBOS_ODAK_AJAN.md | 3 test; runtime nav geçişi bekliyor |
| LOAD-01 | Detail/lazy/cancellation/cache incelemesi | load_review | yerel doğrulandı | Yok | WEBOS_YUKLEME_AJAN.md | 10 bulgu; stale rAF patch görevi LOAD-02 |
| RENDER-01 | Modern Home saf data adapter'ı | window_model | yerel doğrulandı | WIN-01, FOC-01 | homeVirtualRows.js/test, sanallaştırma raporu | 5 adapter testi; runtime renderer tüketimi bekliyor |
| MEASURE-01 | Değişken satır ölçüm ledger'ı | focus_model | yerel doğrulandı | WIN-01, FOC-01 | homeRowMetrics.js/test, odak raporu | 4 test geçti; runtime ölçüm bağlantısı bekliyor |
| RENDER-02 | Gerçek pencere renderer'ı | window_model | runtime entegre; TV smoke geçti | RENDER-01, MEASURE-01 | İlk markup + retained DOM bütçe testi | Modern layout'tan başla |
| NAV-01 | D-pad, return, sidebar, hold, pagination geçişi | window_model; focus_model inceleme | Modern hareket yetkisi logical (homeDataWindow.move); navModel projeksiyon temizliği backlog | RENDER-02 | Gerçek runtime regresyonları | DOM navModel yetkisini kaldır |
| SCROLL-01 | Home veri commit sırasında geometri/scroll kararlılığı | scroll_fix (Luna/max); scroll_nav_review salt okunur; root kabul | TV doğrulandı (dar kaydırma kabulü) | PATCH-02 | homeDataWindow.js + runtime testi; fixture133; installed max29→0px | Fiziksel kumanda ve geniş TV-01 kabulü ayrı; sıradaki LOAD-04..06 |
| PATCH-01 | Full Home render yerine bölgesel güncelleme | luna_patch01 (Luna 6 max); root inceleme | TV doğrulandı (dar); kalan: dirty bilgisiz setRows çağıran envanteri | NAV-01 | Katalog chunk testleri | Row commit modelini uygula |
| LOAD-02 | Stale Detail sections rAF iptali | load_review | runtime entegre | LOAD-01 | methods08/methods27 + detailSectionsPerformance.test.mjs | Root 2/2 detail testi geçti; build/TV kabulü ayrıdır |
| LOAD-03 | Bounded metadata/TMDB cache | load_review | runtime entegre | LOAD-01 | YUK-B06 | Invalidation ve bütçe semantiğini test et |
| LOAD-04 | Hafif canonical ID dönüşümü | root (tek edit sahibi); sonnet read-only review | TV doğrulandı (TMDB kapalı profil yolu) | LOAD-01 | YUK-B04; mevcut tmdbToImdb helper | Enabled/timeout/shared signal farklarını koru |
| LOAD-05 | Base detail ve kişisel state bariyerini ayır | root | ertelendi (Trakt/Simkl bağlı cihazda ölçülecek) | LOAD-02, LOAD-04 | YUK-B03 | Resume/Watched yanlış gösterilmesin |
| LOAD-06 | Route-owned abort, yorum dedup, dirty section patch | root (tek edit sahibi); sonnet read-only review | kısmi: B07 runtime entegre; B05/B10 ertelendi (bu TV'de ölçülebilir iş yok) | LOAD-05 | YUK-B05/B07/B10 | Shared in-flight tüketiciyi bozma |
| COMPAT-01 | Classic/Grid/CW split/collection adapter'ları | atanacak | planlandı | NAV-01 | Layout fixture'ları | TV-01 Classic baseline ölçümüne göre önceliklendir |
| NAV-02 | Detail→Back Home yeniden mount/render maliyeti | root (tek edit sahibi); sonnet read-only review | TV doğrulandı (sentetik warm; fiziksel kumanda ayrı) | SCROLL-01 | TV CPU profili: Home mount/render ~350-390 ms, restoreFocusState/target ~146 ms, renderer sync ~229 ms | Back 392-427→168-232 ms; mount 386→45-72 ms; odak/scroll birebir |
| PERF-01 | Modern Home kaydırmada truncation reflow | root (tek edit sahibi); tv01_profile sonnet atıf | TV doğrulandı (sentetik warm) | TV-01 baseline | -31 onChange truncation kaldırıldı; -14 node memo; homeTruncationMemo.test.mjs | Sonraki: sync parse/diff (PERF-02) |
| PERF-02 | Data window sync maliyeti | root (tek edit sahibi); sonnet review | A+B+kart düzeyi (PERF-03B) TV doğrulandı; fixture 143/143 | PERF-01 | homeDataWindow scrollFrame ölçüm atlama; A/B scratchpad/ab | Sonraki: dikey satır mount maliyeti, markup() tuş başı string üretimi |
| PERF-04 | Dikey satır mount / scroll frame maliyeti | root (tek edit sahibi); sonnet atıf+review | TV doğrulandı (aynı oturum A/B) | PERF-03B | homeDataWindow scroll-frame erken dönüş, seçici ölçüm, bindTracks; keyedDomUpdate markup:null | Sonraki: rAF p95 (native paint/layerize), markup() string, Back ~400 ms (ortam?) |
| PERF-05 | Paint/style: :has() kaldırma, odak geçişi 60 ms | root; tv01_paint sonnet atıf | TV doğrulandı (aynı oturum A/B) | PERF-04 | components-07/08/13/14/18.css | Sonraki: dikey track mount katman churn'ü (track/satır havuzu) |
| TV-01 | Kontrollü cihaz performans/bellek kabulü | root; sonnet tv01_probe (CDP sentetik matris) | durduruldu (kullanıcı kararı; IPTV sonrası kalan maddeler) | PATCH-01, LOAD-02..06, COMPAT-01 | WEBOS_TEST_PLANI.md | Cold/warm/gerçek kumanda ayrımı |
| IPTV-01 | IPTV tek kaynak plan | root | yerel doğrulandı (plan) | Uygulama: TV-01 | plans/2026-10-06-iptv-plani.md | D1 ve 3 sn ilk kare hedefi onaylı; sonraki: TV-01 sonrası IPTV-S |
| IPTV-S | Transport/liste boyutu/akış formatı spike (webOS+Tizen) | root | webOS tamam; Tizen cihaz bekliyor | TV-01 | plans/2026-10-06-iptv-plani.md ön spike bölümü | Sonuçlar planda (S1 doğrudan fetch, S2 50k/20MiB, S3 ts varsayılan) |
| IPTV-02 | Xtream veri/credential/transport | sonnet iptv_data (tek edit sahibi); root review/kabul | yerel doğrulandı + gerçek sağlayıcı (Node) | IPTV-S | js/data/local/iptvSourcesStore.js, js/data/remote/api/xtreamApi.js, js/data/repository/iptvRepository.js + *.test.mjs (yeni dosyalar; paylaşılan dosyalara edit yok) | Hook'lar IPTV-03R: profil silme clearProfile, logout/profil geçişi invalidate (lazy import) |
| IPTV-03 | IPTV ekranı + TV hesap formu | sonnet iptv_ui (tek edit sahibi); root review | runtime entegre; TV form doğrulandı, kanal ekranı kullanıcı girişi bekliyor | IPTV-02 | yeni js/ui/screens/iptv/* + css/iptv.css (yeni) | Logical focus, kategori/arama/favori |
| IPTV-03R | Router/sidebar/i18n/config bayrağı entegrasyonu | root (tek edit sahibi) | runtime entegre (TV) | IPTV-03 | router.js, sidebarNavigationHelpers-01, renderAppShell.js, js/config.js, css/components.css import, profil/logout hook | Sidebar sıra testi iki Discover modu |
| IPTV-04 | Live player izolasyonu | root | TV doğrulandı (webOS) | IPTV-02/03 | mount, controller -17/-20, scrobble start, test | Kalan: logo TLS, xtreamApi testleri gerçek timer (60 sn), Tizen |
| IPTV-05 | Xtream MVP TV kabulü (QR yok) | root | planlandı | IPTV-03R, IPTV-04 | Plan kabul matrisi | webOS + Tizen |
| IPTV-10 | Xtream VOD + dizi | atanacak | planlandı (kullanıcı kararı: canlı MVP sonrası, M3U öncesi) | IPTV-05 | data/UI/player | mkv/mp4, resume, 24k film listesi |
| IPTV-06 | M3U import | atanacak data/UI sahipleri | planlandı | IPTV-10 | Parser/test + kaynak formu | Gerçek M3U fixture/TV |
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

### GITHUB-01 teslim — 6 Ekim 2026

https://github.com/birkankervan/nuvio-webos public repo oluşturuldu. Kaynak
commit 88a46ca (101 dosya) personal/main dalına başarıyla pushlandı. Main artık
personal/main izler; origin NuvioMedia/NuvioTVSmart olarak korunur.
42/42 Node + lint geçti; yayın kontrol ajanı tamam, aktif kaynak ajanı yok.
Ignored yerel ayarlar/paketler gönderilmedi. Bu teslim yeni runtime build veya
TV-01 performans kabulü değildir. Sonraki: bu MD teslim checkpointini commit/push
ve son remote SHA doğrulaması; geliştirmede LOAD-04..06 ve geniş TV-01 açık.

- 2026-10-06 / TV-01 continuation, LOAD-04 start: root is the single edit
  owner. File boundary: js/core/tmdb/tmdbService.js (tmdbToImdb options.signal,
  signal-owned requests do not join/own shared in-flight),
  js/ui/screens/detail/metaDetailsScreenMethods-03-load-detail.js
  (resolveCanonicalDetailItemId: TMDB enabled gate kept, external_ids only,
  short abortable timeout), metaDetailsScreenMethods-27-on-pointer-move.js
  (cleanup aborts canonical request), new detailCanonicalId.test.mjs.
  Next: Node tests/lint/package, sonnet read-only review, then LOAD-05.

- 2026-10-06 / LOAD-04 delivered + LOAD-02 cleanup bug fixed. Files:
  tmdbService.js (tmdbToImdb options.signal; signalled lookups skip shared
  in-flight), metaDetailsScreenMethods-03-load-detail.js (canonical id: TMDB
  enabled gate, ensureTmdbId + external_ids only, tv/movie type normalization
  like resolveType, 2500 ms abortable budget, cancelCanonicalDetailIdRequest),
  metaDetailsScreenMethods-27-on-pointer-move.js (cleanup aborts canonical
  request; FIX: _sectionsUpdateCancel was called as a method, native
  cancelAnimationFrame threw "Illegal invocation" on TV and aborted the rest of
  detail cleanup whenever a sections rAF was pending), new
  detailCanonicalId.test.mjs, detailSectionsPerformance.test.mjs stub now
  mirrors the native this-check (fails on old code). Sonnet review: no blocker;
  type-normalization finding applied; noisy plugin-service abort log left as low.
  Checks: 45/45 Node, lint, webOS package, check-performance-build, diff check;
  IPK installed and launched on nuvio-lg-145. TV probe (synthetic Enter, warm,
  single run): Home -> detail -> cast -> 3 tmdb: credits -> detail ready
  607/1545/1822 ms, Back to cast each time, Home restored; Illegal invocation
  gone. Active profile has TMDB enrichment disabled, so canonicalization
  correctly makes no request and keeps tmdb: (same as old code). Enabled-TMDB
  positive path is covered only by Node tests; user settings were not changed.
  Build note: local.properties has empty NUVIO_SUPABASE_URL, so sync/profile
  RPCs fail on TV (pre-existing config, not this change).
  No active agent; Inspector forwarding stopped. Next: LOAD-05 (YUK-B03) base
  detail render separated from personal state; no wrong Resume/Watched.

- 2026-10-06 / TMDB settings decision: active profile tmdb.enabled is false by
  app default (pre-2026-10-05 backup already false, never enabled); sub-flags
  and enrichContinueWatching were turned off on 2026-10-05 (checkpoint 32) at
  the user's performance request. User decided to keep current settings
  unchanged. Do not re-propose enabling TMDB enrichment.

- 2026-10-06 / LOAD-05 pre-measurement (no source edit): detail personal state
  (resume/watched/saved/all progress) is network-bound only when Trakt/Simkl is
  the progress/watched source (getAllForContinueWatching, watchedItems getAll).
  On nuvio-lg-145 no Trakt/Simkl token exists; local stores are 1-6 KB and
  JSON.parse costs 0.02-0.08 ms, so the Promise.all barrier adds ~0 ms here;
  meta (addons, 4.5 s timeout) is the real wait. Splitting would add a
  pending-action window plus season/focus re-selection risk with no measurable
  gain on this TV and cannot be TV-verified without a Trakt/Simkl account.
  Root recommendation: defer LOAD-05 until a Trakt/Simkl-connected device run;
  continue with LOAD-06. Waiting for user decision.

- 2026-10-06 / LOAD-05 deferred by user; LOAD-06 started, root single edit
  owner. Order: (1) YUK-B07 comments dedup in
  metaDetailsScreenMethods-04-fetch-more-like-this.js + load-detail force flags
  (Trakt not authenticated on nuvio-lg-145, so Node-only proof there);
  (2) YUK-B05 route-owned abort for detail meta requests (metaRepository /
  detail helpers, shared in-flight must survive); (3) YUK-B10 dirty section
  patch in methods-08. Each step: Node test, lint, package, TV probe.

- 2026-10-06 / LOAD-06 checkpoint. B07 delivered: loadTraktComments reuses a
  pending/loaded page 1 for the same detailToken|mode|target (base +
  enrichment no longer double-fetch), changed target reloads, force (retry,
  mode switch) and a failed page 1 reload; load-detail calls dropped force.
  New detailCommentsDedup.test.mjs fails on old code. Trakt is not
  authenticated on nuvio-lg-145, so this path is Node-proven only.
  B05/B10 deferred with evidence: CDP network trace of detail open/Back shows a
  single addon meta request that completes before Back (TMDB enrichment off,
  Trakt off) -> no route-owned work left to abort on this config; detail open
  long tasks 62-64 ms, so dirty-section patch has no measurable target here.
  Checks: 46/46 Node, lint, webOS package, check-performance-build, diff check;
  IPK installed/launched. TV smoke (synthetic, warm, 3 Home cards): detail ready
  123/350/265 ms; Back to visible Home 427/392/396 ms with one 317-348 ms long
  task; Home focus restored; no errors.
  NEW FINDING (biggest TV-01 cost measured so far): CPU profile of Back shows
  Home is re-mounted and fully rendered (navigate->mount->render ~386 ms;
  restoreFocusState->restoreDataHomeFocus->homeDataWindow.target ~146 ms;
  renderer sync ~229 ms; attachDataHomeWindow ~92 ms). Proposed NAV-02 on the
  board, waiting for user approval. No active agent; Inspector stopped.

- 2026-10-06 / NAV-02 started (user approved). Root cause: on webOS/Tizen
  Home cleanup keeps the rendered DOM (homeDomPreserved) but destroys
  homeDataWindow; mount's preserved-resume path then sees
  `layoutMode === "modern" && !this.homeDataWindow` and calls full render().
  Fix boundary (root single edit owner): homeDataWindow.js (suspend/resume;
  sync is a no-op while suspended so display:none cannot write zero
  measurements), homeScreenMethods-30-cleanup.js (suspend instead of destroy
  when preserving TV Home), homeScreenMethods-20-mount.js (resume renderer,
  rebuild navModel, skip render), Node test. Keep SCROLL-01 geometry, focus,
  track scroll and repaint-on-order-change behavior.

- 2026-10-06 / NAV-02 delivered. Two root causes: (a) cleanup destroyed
  homeDataWindow while keeping TV DOM; (b) mount's repaint check compared
  getRenderedHomeCatalogRowKeys (legacy DOM selector, 0 matches in the data
  window) with all catalog keys, so every Back forced render(). Fix:
  homeDataWindow.js suspend()/resume() (sync and track handlers no-op while
  suspended; resume drops hidden-time scroll anchor and schedules a sync);
  homeScreenMethods-30-cleanup.js suspends instead of destroying when
  preserving TV Home; homeScreenMethods-20-mount.js compares renderer logical
  catalog rows, resumes only when viewport and render-settings key match,
  rebuilds navModel, destroys a suspended renderer on every non-resume path
  (old cold semantics). New homePreservedResume.test.mjs (fails on old code).
  Sonnet review: no blocker; all four suggestions applied.
  Checks: 48/48 Node, lint, webOS package, check-performance-build, diff check;
  TV DOM fixture 133/133; IPK installed. TV (synthetic, warm, 3 runs after
  2 down + 2-4 right): Back to visible Home 168/232/193 ms (baseline
  392-427 ms); focused item/row/col, viewport scrollTop, track scrollLeft and
  card top identical before/after; no errors. CPU profile: navigate->mount
  45-72 ms (was ~386 ms), restoreFocusState ~30 ms (was ~146 ms). Remaining
  Back long task 110-140 ms not yet attributed (program/paint).
  Not covered: physical remote, cold start, Classic/Grid (unchanged path).
  No active agent; Inspector stopped. Next per TV-01 chain: PATCH-01 /
  COMPAT-01 / NAV-01 status review, then wider TV-01 measurement matrix.

- 2026-10-06 / CLEAN-01 (user request): readability/SOLID/DRY cleanup of code
  written this session (LOAD-04, LOAD-02 cleanup fix, LOAD-06 B07, NAV-02),
  behavior and performance unchanged. Edit owner: sonnet subagent `clean_refactor`
  limited to the session diff files; root reviews diff, runs Node/lint/package
  and TV smoke. No other agent edits these files meanwhile.

- 2026-10-06 / CLEAN-01 delivered. Sonnet clean_refactor: Home TV-preserve
  condition extracted to canPreserveRenderedTvHome() (cleanup mixin), reused
  by cleanup and mount; mount resume decision extracted to
  resumePreservedDataWindow(); unused Platform import removed from mount.
  Detail/tmdbService/tests judged already minimal and left unchanged
  (getContentType keeps unknown types, so the detail tv/movie regex stays).
  Root reviewed the diff (decision table equivalent) and re-ran: 48/48 Node,
  lint, webOS package, check-performance-build, diff check; IPK installed;
  TV DOM fixture 133/133; Back smoke 172/181/169 ms with identical focus,
  scrollTop and track scrollLeft, no errors. No active agent; Inspector stopped.

- 2026-10-06 / TV-01 dependency review (sonnet read-only, root verified in
  code): PATCH-01 functionally met (commitModernHomeDataUpdate; unknownUpdate
  in homeDataWindow.setRows clears card cache when callers omit dirty info);
  NAV-01 Modern D-pad decides via homeDataWindow.move (-19:95-104), navModel is
  only a DOM projection for sidebar/scroll/hero helpers; COMPAT-01 Classic
  still HomeRowVirtualizer (-23:40-50), Grid full DOM. Decision: run TV-01
  measurement first (it defines what COMPAT/NAV strict cleanup is worth).
  tv01_probe (sonnet) writes probes only under the session scratchpad, no repo
  edits, runs the synthetic Modern matrix on nuvio-lg-145 (3 reps, cold via
  close/relaunch, warm separate). Physical remote / Magic Remote / real video
  first frame / layout switching stay user-dependent.

- 2026-10-06 / TV-01 Modern synthetic baseline (tv01_probe sonnet, root
  spot-checked raw outputs; scripts/outputs under session scratchpad tv01/,
  temporary). Method: synthetic KeyboardEvent, handler = sync dispatch time,
  rAF intervals, PerformanceObserver longtask; 3 reps each; idle baseline rAF
  p95 16.7 ms / 0 long tasks (CDP overhead negligible).
  S1 cold (3 real close/launch): FCP 1865/1441/1442 ms, DCL 1201/795/842,
  load 1566/1189/1167; first Home card time NOT measurable (Inspector attaches
  ~9 s after launch; needs an in-app performance.mark).
  S2 row 30 right + 30 left @120 ms: handler p95 13.1/12.5/13.2 (pass),
  rAF p95 66.7 x3, max 83-100 (fail), long tasks 45/39/41, max 74-86 (fail);
  focus identity back to start 3/3; track scrollLeft returns at 6-7 px not 0;
  mounted cards 29 constant, DOM nodes constant.
  S3 vertical 10 down + 10 up @250 ms: handler p95 14.7/19.0/10.1, rAF p95
  66.7-83.4, max 133-183, long tasks 26-31, max 108-148 (fail); focus back 3/3,
  scrollTop +-2 px; mounted cards constant.
  S4 Detail/Back: detail ready 176/157/66 ms, Back to Home 204/189/184 ms,
  focus/scrollTop/scrollLeft identical 3/3, 2-3 long tasks 50-136 ms per Back.
  S5 sidebar open/return: return 14-17 ms, focus restored 3/3.
  S6 10x Detail/Back: DOM 414->412, #home focusables 30->30, detail DOM 0;
  post-GC heap 9.00->10.05->10.32 MB (+1.05 then +0.27 MB per 10 cycles,
  warm-up likely; longer run needed for a leak verdict).
  Conclusion: input handlers are fast; the TV-01 gap is post-input main-thread
  work (frequent 70-150 ms long tasks, rAF p95 66-83 ms) during scrolling.
  Next: CPU profile of S2/S3 to attribute those long tasks (sonnet probe,
  root verifies), then targeted fix. Physical remote, Magic Remote, real video
  first frame, Classic/Grid layouts remain open. No active agent/Inspector.

- 2026-10-06 / TV-01 long-task attribution started: sonnet `tv01_profile`
  read-only (CPU profiles of S2/S3 on nuvio-lg-145, maps minified frames to
  source via dist chunk line/column), scratchpad only, no repo edits.

- 2026-10-06 / TV-01 attribution (tv01_profile sonnet; root verified code):
  top cost = applyHomeTruncationState binary-search forced reflow on the hero
  description, scheduled from data-window onChange (-31:61) on every window
  shift although modern truncation only targets the hero (scheduled by -05:147).
  A/B with hero description hidden: S2 long tasks 35-50 -> 2-11 per run, rAF
  p95 66.7 -> 50. Second cost: HomeDataWindow.sync re-parses/diffs ~46 KB
  window markup via keyedDomUpdate (innerHTML + outerHTML signatures) ~4.9x per
  key; third: duplicate sync + per-row forced measurement. Fix PERF-01 (root
  single edit owner): remove -31:61 truncation scheduling, memoize
  applyHomeTruncationState per node (same text + same box => skip) in -14.
  sync/keyedDomUpdate work deferred until PERF-01 is measured.

- 2026-10-06 / PERF-01 delivered. Files: homeScreenMethods-31-data-window.js
  (data-window onChange no longer schedules container-wide truncation),
  homeScreenMethods-14-activate-focused-poster-flow.js (applyHomeTruncationState
  skips a node whose source text and client box match the last truncated
  result; box stored after the final write), new homeTruncationMemo.test.mjs
  (fails on old code). Checks: 49/49 Node, lint, webOS package,
  check-performance-build, diff check; IPK installed.
  TV (synthetic warm, popular-movies row, clean start, 3 runs each;
  handler p95 / rAF p95 / rAF max / long tasks / max LT):
  horizontal 30R+30L: 14.6/50/99.9/1/53, 11.7/50/83.3/2/52, 17.2/50/133.4/3/74
  (baseline 39-45 long tasks, max 74-86, rAF p95 66.7); key-by-key columns
  0->30->0 exact in 3 extra runs (no lost keys).
  vertical 10D+10U: 13.2/83.3/133.4/21/84, 10.3/50/83.3/11/65, 12/66.6/83.3/15/85
  (baseline 26-31 long tasks, max 108-148).
  Note: tv01/s2.js reset can leave focus in the sidebar; an early rerun showed
  "no focused card" from that test setup, not from the app (verified).
  Still failing targets: rAF p95 50-83 ms, residual long tasks (vertical).
  Next PERF-02: HomeDataWindow.sync re-parse/diff of full window markup
  (keyedDomUpdate innerHTML + outerHTML signatures) and per-sync row
  measurement. No active agent; Inspector stopped.

- 2026-10-06 / PERF-02 started (root single edit owner, homeDataWindow.js +
  test). Step A: HomeDataWindow.sync measures mounted rows only when markup
  changed, rows/data changed (setRows), on attach/resume, during expansion
  animation, or once more after a measurement changed geometry. Viewport
  scroll animation frames with unchanged markup no longer force per-row
  layout reads. Step B (parse only changed rows/cards) decided after A is
  measured on TV.

- 2026-10-06 / PERF-02A revised after TV DOM fixture failure ("collection must
  measure beyond the shape estimate": CSS-only size change with identical
  markup). Final design: explicit sync() always measures (old behavior);
  only scroll frames (viewport scroll rAF in -19, track scroll handler via
  requestSync({scrollFrame:true})) skip row measurement when markup is
  unchanged and no expansion animation runs; coalesced frames measure if any
  request needs it. measurementPending removed. 50/50 Node, lint, package,
  buildgraph, diff check; TV fixture 133/133.
  Measurement caveat: cross-session TV numbers vary with start column and
  pagination state (popular-movies is 20 cards on fresh launch; continuous
  120 ms input defers pagination by design). Controlled A/B running in
  background (scratchpad/ab/ab.sh: A = PERF-02A skip removed, B = current;
  A,B,A,B fresh install+launch, identical warm-up). Sonnet read-only review of
  PERF-01/02A running in parallel. Working tree = B source.

- 2026-10-06 / PERF-01 memo fix from sonnet review (real regression): hero
  re-applying the same full text (<40 words but overflowing) was skipped by
  the box-only memo and stayed untruncated. Memo now lives in a module
  WeakMap (no dataset attrs) and skips only when the node still holds our
  last written result and the box is unchanged. Test extended (rewrite case).
  Review found PERF-02A clean (card sizes are CSS-fixed; expansion frames
  still measure). Optional later: remember() -> scroll-frame sync (needs TV
  data). 50/50 Node, lint, diff check. A/B (built before this fix; the fix
  does not touch the measured path) still running.

- 2026-10-06 / PERF-02A A/B result (A = skip removed, B = current; A,B,A,B
  fresh install+launch, identical warm-up; handler p95/rAF p95/rAF max/LT/LT max):
  horizontal A rAF p95 50 in 6/6 runs, LT 1-3; B rAF p95 33.4 in 3/6, 50 in
  3/6, LT 0-4. vertical A LT 26,14,14,24,10,15 (avg 17.2); B 22,12,15,20,10,8
  (avg 14.5); rAF p95 similar (50-83). Verdict: small gain, near noise; kept
  (cheap, reviewed, fixture-safe). Final build with memo fix installed:
  TV fixture 133/133; hero description truncated and fits; Back 203/168/153 ms
  with identical focus; no errors. Remaining dominant cost (vertical 8-22 long
  tasks, rAF p95 50-83): keyedDomUpdate re-parses the full window markup and
  serializes outerHTML per node on every window shift -> PERF-02B (parse only
  changed rows/cards). No active agent; Inspector stopped.

- 2026-10-06 / PERF-02B started (root single edit owner): keyedDomUpdate.js
  gains patchKeyedNode (re-render one registered element from its own markup
  via existing updateNode) and createKeyedNode (parse + register one element);
  homeDataWindow.js sync patches per row: unchanged rows untouched, changed
  rows parsed alone, new rows parsed alone and appended (absolute top, DOM
  order irrelevant), departed rows removed; falls back to full updateKeyedDom
  when the shell is not mounted/registered. Tests + TV fixture + A/B.

- 2026-10-06 / PERF-02B implemented, under A/B. keyedDomUpdate.js:
  parseElement/patchKeyedNode/createKeyedNode (reuse updateNode/remember);
  homeDataWindow.js markup() records per-row parts, patchWindowRows patches
  changed rows, appends new rows, removes departed rows, falls back to full
  keyed update. TV fixture extended with a horizontal-shift identity check
  (sibling row/card nodes kept, focus kept; scroll restored for later checks):
  141/141 on TV. 50/50 Node, lint, package, buildgraph, diff check.
  CONCERN: Back on fresh launch measured 335-469 ms with 200-340 ms long tasks
  (previous build 153-203 ms); profile shows large (program) share and mount
  140 ms. Not yet attributed; A/B running (scratchpad/ab/ab.sh, A = same
  source with patchWindowRows disabled, B = PERF-02B, includes Back probe).
  Do not ship PERF-02B until A/B clears the Back regression.

- 2026-10-06 / PERF-02B A/B result (same session, A = patchWindowRows
  disabled, B = PERF-02B; A,B,A,B fresh install+launch, identical warm-up):
  horizontal long tasks A 18,20,18,13,15,10 (avg 15.7) vs B 2,1,0,3,1,4
  (avg 1.8); vertical A 33,21,24,29,24,24 (avg 25.8, max LT 102-156 ms) vs
  B 16,14,16,23,11,11 (avg 15.2, max 62-111 ms). Back: A 347-472 ms vs
  B 356-509 ms (same; NOT a PERF-02B regression). Verdict: PERF-02B kept.
  Unexplained environment shift: in this session both A and B are slower than
  the previous session (handler p95 ~13 -> ~30 ms, Back ~170 -> ~400 ms,
  rAF p95 50 -> 66) although idle rAF p95 16.7 / 0 long tasks and device
  CPU 13% / 636 MB free look normal. Do not compare numbers across sessions;
  only same-session A/B is evidence.
  Current horizontal profile (B, 40 keys): sync ~1.97 s total (~49 ms/key);
  patchWindowRows -> updateNode chain ~0.89 s (outerHTML signature per level
  of the changed row + snapshots); markup() string building ~0.35 s;
  target() runs sync synchronously inside keydown; native focus() ~7 ms/key.
  Next candidates: card-level patch (parse/serialize only entering cards),
  fewer syncs per key, investigate the cross-session slowdown.
  Source clean of A/B toggles. No active agent; Inspector stopped.

- 2026-10-06 / PERF-03 (user order: 3 then 1). Step 3 cross-session slowdown
  check: G.ipk rebuilt from current source with PERF-02B removed (= previous
  session's "good" PERF-02A + memo build); G,B,G,B same-session run with
  identical warm-up + Back probe (scratchpad/ab/ab.sh, VARIANTS env). If G is
  as slow as B now -> environment; if G is fast -> code common to A2/B2.
  Source restored to PERF-02B (verified). Step 1 (card-level patch) after.

- 2026-10-06 / PERF-03 step 3 result: G (previous session's good code, no
  PERF-02B) is as slow as B today: horizontal LT G 25,16,22,10,21,15 vs
  B 2,1,2,1,1,1; handler p95 G 18-50 ms; Back G 366-503 ms vs B 341-535 ms.
  Same code that measured LT 1-4 / Back ~170 ms earlier -> slowdown is
  environment/data (TV state, catalog/hero content), not code. Same-session
  A/B stays the only valid evidence; PERF-02B again clearly better. Optional:
  a TV reboot (user decision, not done) could confirm device-state cause.
  Next: step 1 card-level patch (PERF-03B) in homeDataWindow.js.

- 2026-10-06 / PERF-03B card-level patch implemented (root): rowWindow
  returns cardParts (null when skeletons present), markup() parts carry the
  row shell (everything up to the data-track) + cards; patchWindowRows uses
  patchRowCards when the shell is unchanged: entering cards parsed alone
  (createKeyedNode), changed cards patched alone (patchKeyedNode), departed
  cards removed except the focused one; otherwise row-level patch. Fixture
  adds a small-shift check (card that stays visible keeps identity): 142/142
  on TV. 50/50 Node, lint, package, buildgraph, diff check. Running: same
  session A/B B (PERF-02B) vs C (PERF-03B) and sonnet read-only review.

- 2026-10-06 / PERF-03B review fixes (sonnet found B1/B2/B3): B1 stale
  ancestor snapshot markup after out-of-band patches could make a later
  updateNode skip a needed update -> keyedDomUpdate.invalidateKeyedAncestors
  (called by patchKeyedNode and after card/row appends/removals). B2 a
  different item at the same data-window-index inherited the old card's
  runtime state -> recreate the card when the part's itemId changed (compared
  with the previous part, not the DOM, because collection itemIds differ from
  data-item-id), focused card excepted. B3 never remove the row holding focus.
  Fixture gains a swapped-item check. 50/50 Node, lint, diff check. A/B
  running was built before these fixes (perf path essentially unchanged).

- 2026-10-06 / PERF-03B delivered. Same-session A/B B (PERF-02B) vs C (card
  level): horizontal handler p95 B 28.9-37.4 -> C 21.6-26.8 ms, long tasks
  B 0-2 -> C 0-1; vertical unchanged (rows mount there; LT avg 18.5 vs 17.5);
  Back unchanged. Review fixes kept: invalidateKeyedMarkup(element) (renamed;
  invalidates the element itself and registered ancestors, safe when a track
  empties), itemId change at an index recreates the card. Review B3 focus
  guards REVERTED after the TV fixture showed a ghost row: keeping a focused
  row/card that left the data leaves stale DOM (scrollHeight 2304 vs 560);
  semantics now match the full keyed update (removed even if focused; Home's
  commitModernHomeDataUpdate restores a disconnected focus). Fixture fixes:
  restore rows/scroll after new checks; release the manual focused class like
  setFocusedNode. NOTE: the fixture bundle embeds homeDataWindow source; always
  rebuild dwc bundle after source edits (one stale-bundle run happened).
  Final: 50/50 Node, lint, package, buildgraph, diff check; TV fixture
  143/143; key-by-key columns 0->30->0 x3; Back focus identical x3; hero
  truncation correct; no errors. No active agent; Inspector stopped.
  Next candidates: vertical row-mount cost, markup() string building per
  scroll frame (skip when window ranges unchanged), TV reboot to confirm
  environment slowdown (user decision).

- 2026-10-06 / PERF-04 vertical row-mount cost started (user request).
  Attribution first: sonnet `tv01_vprofile` read-only CPU profile + trace of
  10 down / 10 up on the current build (installed), scratchpad only, no repo
  edits. Root implements after verifying the attribution.

- 2026-10-06 / PERF-04 attribution (tv01_vprofile sonnet; root checked code):
  per down key ~7.5 syncs (spring scroll writes scrollTop ~9 frames/key, each
  scroll rAF runs full markup()+captureTrackStates+measurement although the
  window rarely changes), ~0.9 row mount/unmount per key, new row ~16.7 KB
  parse + ~93 outerHTML/cloneNode in remember, bindTracks scrollLeft write
  forces layout (~18 ms/mount), measurement loop measures all ~3 rows each
  sync. Fix set (root): (1) scroll-frame early return when vertical window
  ranges and visible rows' track offsets are unchanged (skip capture too);
  (2) write scrollLeft on new tracks only when non-zero; (3) scroll frames
  measure only rows appended/patched by patchWindowRows; (4) createKeyedNode
  registers new subtrees without outerHTML signatures (markup null).

- 2026-10-06 / PERF-04 implemented (homeDataWindow.js, keyedDomUpdate.js,
  homePreservedResume.test.mjs new early-return test). 51/51 Node, lint,
  package, buildgraph, diff check; TV fixture 143/143 (bundle rebuilt);
  columns 0->30->0 x3; Back focus/scroll identical x3; 10 down + 10 up with
  zero blank visible rows at every step. Running: same-session A/B C vs D
  (scratchpad/ab/result5.txt) and sonnet read-only review.

- 2026-10-06 / PERF-04 sonnet review: no bug. Notes: trackStates can be one
  frame stale when animateScroll writes scrollLeft in the same frame as the
  viewport scroll rAF (self-corrects next scroll event); selective
  measurement and markup:null path are covered by TV fixture/acceptance, not
  by Node DOM tests. Applied: updateNode skips outerHTML signature when the
  stored markup is null. 51/51 Node, lint, diff check.

- 2026-10-06 / PERF-04 delivered. Same-session A/B C (PERF-03B) vs D
  (PERF-04), handler p95/rAF p95/rAF max/LT/LT max: vertical long tasks
  C 28,16,14,25,18,16 (avg 19.5) vs D 20,8,8,18,8,6 (avg 11.3); without each
  build's first (warm-up) run C avg 16 vs D avg 7.5 (~53% fewer). Vertical rAF
  p95 unchanged (66-100), horizontal unchanged (0-1 LT), Back unchanged.
  Final build (with null-markup guard) installed: TV fixture 143/143;
  columns 0->30->0 x3; 10 down + 10 up zero blank visible rows; Back focus
  identical x3; hero truncation correct; no errors. 51/51 Node, lint,
  package, buildgraph, diff check. No active agent; Inspector stopped.
  Remaining TV-01 gaps: rAF p95 50-100 ms (native paint/layerize ~32 ms/key,
  forced style on focus), markup() string building, Back ~350-500 ms in the
  current (slower) environment, physical remote / cold / video / Classic.

- 2026-10-06 / PERF-05 paint/layerize attribution started: sonnet
  `tv01_paint` read-only (CDP LayerTree/trace + temporary in-page style A/B
  probes that are removed afterwards; no repo edits, no user setting changes).
  Root decides fixes; visual design must stay identical or near-identical.

- 2026-10-06 / PERF-05 attribution (tv01_paint sonnet, single session,
  synthetic): legacy-webos/performance-constrained classes are NOT on this TV,
  so their light-mode CSS never applies. Horizontal: native cost mostly the
  focused poster frame/continue media border/box-shadow/background 140 ms
  transitions (A/B transition off: handler p95 ~28->13-15, rAF p95 66.7->33.3);
  two :has() rules re-evaluated on every .focused change (~2 ms/key style).
  Vertical: each key mounts a new track = 3 compositing layers (Trivial3D +
  OverflowScrolling + content) -> Layerize/Paint; CSS probes (contain,
  will-change, box-shadow, hero filter) gave nothing; track transform:none
  lowers native cost but worsens scroll jank (rejected). Images: posters are
  w500 drawn at ~221x339 (w342 probe helped somewhat).
  Applied now (no visual change): removed .home-shell:has(...) rules in
  components-07.css and components-08.css; identical class rules already
  exist and every expanded/data-collapsible change calls
  syncSidebarStateClasses. Pending user decision: focus-ring transition
  removal (instant ring instead of 140 ms fade) and w342 home poster images.

- 2026-10-06 / PERF-05 user decisions: focus-ring transition shortened to
  60 ms (not removed); home posters stay w500 (no image size change).
  Implemented: --home-focus-ring-duration: 60ms on .home-screen-shell
  (components-13.css), used by the poster frame / continue media rules in
  components-14.css and the modern poster frame rule in components-18.css
  (height 180 ms expansion transition unchanged). TV check: computed
  transition 0.06 s; sidebar open/close toggles has-expanded-sidebar and focus
  returns to content. lint, package, buildgraph, diff check ok. Same-session
  A/B D (PERF-04) vs E (PERF-05) running (scratchpad/ab/result6.txt).

- 2026-10-06 / PERF-05 A/B (same session, D = PERF-04, E = PERF-05; handler
  p95 / rAF p95 / rAF max / LT / LT max): horizontal D handler p95 22.7-28.8,
  rAF p95 50-66.7 vs E 20.2-22.4, rAF p95 50 in 6/6, rAF max 66.7-100;
  vertical handler p95 D 15-47 vs E 15.6-22.2 (tail removed), LT avg 9.7 both,
  rAF p95 E 50-83 vs D 66.7-100; Back D 263-465 vs E 326-411 ms. Verdict:
  kept. Remaining TV-01 vertical cost: each down key mounts a new track = 3
  compositing layers (Trivial3D + OverflowScrolling + content) -> Layerize/
  Paint; candidate: reuse departed row/track DOM (pool) instead of new parse.
  No active agent; Inspector stopped. E installed on TV.

- 2026-10-07 / PERF-06 row reuse (user asked to do it, then start IPTV).
  Root single edit owner: keyedDomUpdate.js setKeyedAttribute (retag a live
  node and its stored snapshot so keyed matching follows the new row);
  homeDataWindow.patchWindowRows reuses a departed row section for an entering
  row (track/data-track elements and their compositing layers persist; cards
  rebuilt by identity), sets the reused track scrollLeft to the new row's
  state. After PERF-06: performance phase paused, IPTV-S next.

- 2026-10-07 / PERF-06 implemented: keyedDomUpdate.setKeyedAttribute;
  homeDataWindow.patchWindowRows pairs entering rows with departed sections
  (reuseRowNode: retag track key, patchKeyedNode, set scrollLeft from
  trackStates). Fixture adds track-reuse + key/scroll consistency check:
  145/145 on TV. 51/51 Node, lint, package, buildgraph, diff check. TV:
  columns 0->30->0 x3, zero blank rows in 10D/10U, Back focus/scroll identical
  x3, horizontal position kept after 7 down + 7 up (2023 px -> 2023 px, card
  visible) x3. Same-session A/B E vs F running (scratchpad/ab/result7.txt).

- 2026-10-07 / IPTV-S setup: user-provided Xtream test account lives only in
  repo-root .env (mode 600, added to .gitignore, verified git check-ignore;
  build/package scripts do not read .env, so it is not bundled). Keys:
  IPTV_TEST_SERVER, IPTV_TEST_USERNAME, IPTV_TEST_PASSWORD (empty; user fills
  locally or types on TV). Values never go into MD. Probes read .env.

- 2026-10-07 / PERF-06 partial A/B (user stopped it): E vs F no measurable
  difference in this (faster again) session; kept for fewer layer rebuilds,
  no regression. Performance phase paused by user; TV-01 remaining items
  (physical remote, Magic Remote, video, cold first card, Classic/Grid,
  Library, long memory, TV reboot check) after IPTV.
- 2026-10-07 / IPTV-S webOS done (results in plans/2026-10-06-iptv-plani.md):
  S1 direct fetch from file: origin works; account max_connections 1, formats
  m3u8+ts; S2 1693 channels 488 KB parse 5.6 ms, synthetic 50k 14 MB 262 ms
  -> cap 50k/20 MiB; S3 native video plays ts 745-913 ms, m3u8 915-1418 ms
  -> default ts. Probes in scratchpad/iptv (read .env, redact output).
  Tizen S1-S3 open (no device). Next: IPTV-02 data layer.

- 2026-10-07 / IPTV-02 started. Owner sonnet `iptv_data`, new files only:
  js/data/local/iptvSourcesStore.js, js/data/remote/api/xtreamApi.js,
  js/data/repository/iptvRepository.js and their tests. No edits to shared
  files (httpClient, profileScopedStore, sync, logout/profile hooks); needed
  hook points are reported to root. Worker/GPU evaluation (root): GPU path not
  applicable (costs are CPU parse/DOM/style; video uses the hardware decoder,
  compositing already GPU); Worker already proven on TV (pluginRuntime). Keep
  parse/normalize pure so it can move to a Worker for >20k channels and for
  EPG/XMLTV (IPTV-07); typical 1693 channels parse 5.6 ms needs no Worker.

- 2026-10-07 / IPTV-02 delivered by sonnet iptv_data, root verified:
  new js/data/local/iptvSourcesStore.js, js/data/remote/api/xtreamApi.js,
  js/data/repository/iptvRepository.js + 3 tests. Real provider check from
  Node with .env (redacted): account Active, max 1 connection, formats
  m3u8+ts, 29 categories, 1693 channels in 417 ms, playback URL ext ts; wrong
  password -> IptvError auth_failed, no URL/credential in message.
  Root fix in shared httpClient.js: backend 429/503 cooldown recorded and
  awaited only for Supabase backend URLs (provider/addon 429 no longer
  throttles Nuvio); new js/core/network/httpClientCooldown.test.mjs fails on
  old code. Hooks deferred to IPTV-03R (lazy import, no startup cost):
  profile delete -> IptvSourcesStore.clearProfile (profileManager.js:188-204),
  logout/profile switch -> IptvRepository.invalidate (sessionLifecycle
  registerSessionTeardownHandler); logout already wipes profile-scoped storage
  (accountLocalDataReset.js:68-76); iptvSources is in no sync feature list,
  add a guard test in IPTV-03R. Tests pass in groups (data 19, network+nav 5,
  home/detail/stream 47); one combined node --test invocation hung (process
  concurrency, not a test failure) - run groups. lint, diff check ok.
- 2026-10-07 / VOD probe (user asked): 61 VOD categories, 23,972 VOD (7.5 MB
  list, 1.6 s; mkv 14,413, mp4 8,849, avi 710) and 4,684 series (4.0 MB).
  webOS <video> plays mkv (incl. 3840x804) and mp4; first play mkv 5.6-7.2 s,
  mp4 0.5-1.0 s; avi untested. VOD out of plan scope until user decides.

- 2026-10-07 / User decision: Xtream VOD + series = IPTV-10, after live MVP
  (IPTV-05), before M3U (IPTV-06 now depends on IPTV-10). Plan updated.
  IPTV-03 started: owner sonnet `iptv_ui`, new files only under
  js/ui/screens/iptv/ and new css/iptv.css. In parallel IPTV-03R root:
  router lazy route, sidebar item before Library, #iptv container in
  renderAppShell.js, IPTV_ENABLED flag in js/config.js, css import, profile
  delete/logout hooks. Disjoint files.

- 2026-10-07 / IPTV-03R root wiring done (build waits for IPTV-03 screen file):
  js/config.js IPTV_ENABLED; renderAppShell.js #iptv container; router.js lazy
  route "iptv" -> ../screens/iptv/iptvScreen.js IptvScreen (flag-gated);
  sidebar item gotoIptv/route iptv above Library (ENABLED_ROOT_SIDEBAR_ITEMS,
  slice(2) order Home, Search, [Discover], IPTV, Library, Settings);
  i18n sidebar.iptv -> nav_iptv (res/values + values-tr "IPTV");
  profileManager.deleteProfile lazily clears IptvSourcesStore for the profile;
  iptvRepository self-registers a session teardown handler (invalidate) when
  loaded. Tests: sidebarIptvOrder.test.mjs (both Discover modes),
  iptvSyncGuard.test.mjs (no sync file references the store). Node groups
  20/6/47 pass, lint, diff check. css/iptv.css import pending the screen.

- 2026-10-07 / IPTV-03 delivered by sonnet iptv_ui (new js/ui/screens/iptv/*
  13 modules + 4 tests, css/iptv.css). Root: css import, 41 iptv_* strings in
  res/values + values-tr (XML valid; iptv_expires_in uses %1$d). TV: sidebar
  order Account, Home, Search, IPTV, Library, Settings; IPTV route opens the
  Turkish sign-in form (server, username, masked password, show/hide, save),
  focus on server input, no console errors. Root prefilled server/username
  from .env via CDP; password left for the user to type with the remote.
  Not yet verified on TV: channel screen, window/focus, favorites hold, Back
  restore. Player handoff params (itemType channel, playIptv) wait for IPTV-04.

- 2026-10-07 / IPTV-04 (root, user-reported: channels black, Back went to the
  sources screen). Changes: iptvRepository.resolveChannelPlaybackUrl(sourceId,
  channelId) (ids -> in-memory URL); player mount resolves params.playIptv
  into player-memory params.streamUrl (router keeps id-only params; verified
  no URL in history.state); player Back targets "iptv" when playIptv (user
  confirmed Back returns to the list); live barriers: flushProgress returns
  for live item types (single save path), buildScrobbleContext returns null
  for live and TrackingScrobbleService ignores null contexts
  (livePlaybackBarrier.test.mjs fails on old code). Black screen root cause
  (code analysis): startup audio gate waits for an applied audio-track
  preference with no deadline on webOS; live TS may never report tracks, so
  video decoded (1280x720 seen) but stayed paused behind the loading logo.
  Fix: enableStartupAudioGate skips the gate for live item types. Installed;
  waiting for user's remote test (CDP UI tests conflicted with the user's
  remote). Logos: provider logo host fails TLS on TV
  (ERR_CERT_AUTHORITY_INVALID) - follow-up.

- 2026-10-07 / IPTV-04 TV verified on webOS. Loop root cause (user saw
  start/stop): plain <video> 20 s test shows webOS plays a progressive live
  .ts as a finite file and fires "ended" at ~4.8 s; the player restarts live
  on ended -> endless loop (no JS src/load calls during the loop, verified by
  hooking HTMLMediaElement). .m3u8 played 20 s without interruption. Fix:
  xtreamApi.resolvePlaybackUrl prefers m3u8, ts only when the account has no
  HLS (test updated; plan S3 corrected - the first S3 run lasted only 2 s).
  E2E on TV: IPTV -> OK on a channel: first frame 2.3 s, engine hls.js (MSE),
  currentTime 30 -> 49 over 20 s continuous, Back returns to IPTV with the same
  channel focused. Also kept: startup audio gate skipped for live item types.
  Open: provider logo host TLS invalid on TV (ERR_CERT_AUTHORITY_INVALID);
  xtreamApi.test.mjs takes ~60 s (real timers) and one combined node --test
  run hung - make the timeout test use a short injectable timeout; first
  focused channel can be adult content (adult category hiding planned later).

- 2026-10-07 / IPTV logos + OLED loading screen (user request).
  Logos: 1329/1693 logos come from one host whose https certificate the TV
  rejects (Mac: UNABLE_TO_GET_ISSUER_CERT_LOCALLY) but which serves the same
  file over http; those files are 1x1 transparent placeholders (67 B), i.e.
  the provider has no real logo for them. iptvCards.js: https logo failure
  retries once over http and remembers the host (later logos skip the failing
  https attempt); a loaded image smaller than 8 px counts as no logo (initial
  shown). The webOS image proxy was not widened (imgur-only allowlist, TLS
  verified) to avoid an open local proxy. Real logos (imgur, dsmart, ...)
  render. Loading screen: .player-loading-backdrop used #080b10 under an
  alpha gradient, lighting OLED pixels when there is no backdrop image;
  now var(--bg-color, #000) so it follows Nuvio's AMOLED Mode (user has it
  on; TV computed rgb(0,0,0)). lint, package, diff check ok; installed.
  Note: some provider "channels" are separator rows (e.g. ULUSAL HEVC banners).
