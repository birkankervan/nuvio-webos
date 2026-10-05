# webOS devam kontrol noktası

Güncelleme: 5 Ekim 2026. Bu dosya compaction/ajan devri öncesi güncellenir.
Önce [güncel plan](plans/2026-10-05-webos-nihai-mimari.md), sonra
[iş panosu](WEBOS_IS_TAKIBI.md), ardından bu dosya okunur.

## Kullanıcı niyeti ve yetki

Nihai veri tabanlı iki eksenli sanallaştırma + logical focus mimarisi istendi.
Kullanıcı plan ve iş takibinin repo MD'lerinden yürütülmesini; subagent'lara
iş yaptırılmasını; context daralmadan önce önemli devam bilgisinin yazılmasını
özellikle istedi. Önceki performans iyileştirmeleri/TV kurulum yetkisi mevcut.
Yeni TV testlerinde eşzamanlı fiziksel kumanda kullanımı sonucu bozabilir.
IPTV daha sonra; auth/profil/addon uyumu korunacak. 6 Ekim 2026 kullanıcı
mevcut değişikliklerin kendi public GitHub reposuna commit/push edilmesini istedi.

## Repo / cihaz

- CWD `/Users/birkan.kervan/Desktop/projeler/nuvio`.
- Kaynak NuvioMedia/NuvioTVSmart; ilk upstream commit 358d08c, sürüm 1.2.2.
- Çok sayıda uncommitted kaynak değişikliği önceki işimizin parçasıdır; temizleme/reset yapma.
- TV LG OLED55CS3VA, SDK 11.2.0, firmware 43.21.71, Chromium 132.0.6834.207.
- Kayıtlı cihaz `nuvio-lg-145`, LAN 192.168.1.145:9922; Developer Mode açık.
- App id `space.nuvio.webos`, IPK `space.nuvio.webos_1.2.2_all.ipk`.
- Sağ üst sarı `birkan` marker kullanıcı tarafından TV'de görüldü; koru.
- local.properties yok; build örnek config kullanıyor. Mevcut installed profile/session
  korunmuş ve Home açılmıştı. Credential/anahtarlar MD'ye yazılmayacak.

## Son bilinen kurulu çözüm ve sınırı

TV'de iki eksenli HomeRowVirtualizer **cached detached DOM** sürümü var.
Bu gerçek data renderer değildir: full markup ilk başta üretilir ve detached
kartlar navModel/records üzerinden bellekte kalır. Sonraki çalışma bunu kaldıracak.

Diğer mevcut patch'ler: lazy route ESM build + legacy fallback; stream 120 ms
batch/erken virtualization/keyed DOM; stale token/timer cleanup; route snapshots
12 entry LRU; hero generated copy registration/truncation Text fix; static TV
skeleton; paint sonrası Detail yükleme; Home 1500 ms input-free + idle detail
UI module preload. Yeni modüllerin varlığı TV runtime'ını değiştirmez.

## Kanıt / kontrol komutları

Son eski patch seti: 9 Node testi, lint, paket/build graph, diff check başarılı.
TV izolasyon harness 21 kontrol başarılı. Bunlar nihai mimari kabulü değildir.

```sh
node --test js/ui/navigation/*.test.mjs js/ui/screens/home/*.test.mjs js/ui/screens/stream/streamPerformance.test.mjs js/ui/screens/detail/detailPerformance.test.mjs
npm run lint
npm run package:webos
node scripts/check-performance-build.mjs
git diff --check
```

Upstream npm test eksik/ignored tests/test-plugin-system.mjs ve
 tests/test-plugin-localization.mjs çağırır; genel kabul kanıtı olarak kullanma.
Build `.cache/module-build-meta.json` üretir; check-performance-build paket staging
çıktısını da doğruladığından package:webos sonrasında çalıştır.

TV CLI, Node24 uyumluluk patch'iyle çalıştırılır:

```sh
node --require ./scripts/node24-ares-compat.cjs node_modules/@webos-tools/cli/bin/ares-inspect.js -a space.nuvio.webos -d nuvio-lg-145
```

Inspector port/page/ws id her açılışta değişir. Eski URL'yi kalıcı sanma; CLI
çıktısından yenisini al. Sandbox LAN/key access için require_escalated gerekebilir.
TV uygulamasında console eval için geçici `/private/tmp/nuvio-tv-eval.mjs` yazılmıştı;
varlığına güvenme. Kaydedilmiş harness `scripts/performance-dom-check.js` kaynaktır;
IIFE olarak esbuild ile bundle edilip geçici DOM'da test edilir. finally root DOM'u
kaldırır ve önceki focus'u restore eder. Hash'li chunk adlarını yeniden metafile'dan
bul; eski metaDetailsScreen-... dosya ismini sabitleme.

## Önceki ölçümlerin sınırı

- Eski TV baseline: 31 rows/462 cards; bir warm sentetik vertical örnekte rAF max
  266,6 ms. Tek örnek, controlled A/B değil.
- Cache iki eksenli runtime örneği: 3 rows/28 cards, 28 row/14 card spacers.
- İzole fixture: 30 rows→5 mounted, 40 cards→5 mounted; 3000 px height/4468 px width.
- Sentetik horizontal 10 right/10 left aynı karta döndü; handler p95 8,5 ms,
  rAF p95 16,8 ms, max116,7 ms. Genel akıcılık garantisi değil.
- Vertical örnek listenin altından başladı, aynı karta dönmedi. Boundary ve
  eşzamanlı gerçek kumanda etkisi ayrıştırılmadı; regresyon/kabul sayma.
- Son TV'de detailScreenPrefetchComplete true okundu. Detail static skeleton
  animation none; gözlem skeleton549,1 ms/base1285 ms. Önceki651,5/1465 ms ile
  network/cache eşitlenmedi; hızlanma yüzdesi çıkarma. Video first-frame ölçülmedi.

## Aktif ajanlar ve ilk teslim

- /root/window_model → WIN-01: homeVirtualWindow.js/test + WEBOS_SANALLASTIRMA_AJAN.md.
- /root/focus_model → FOC-01: homeLogicalFocus.js/test + WEBOS_ODAK_AJAN.md.
- /root/load_review → LOAD-01: WEBOS_YUKLEME_AJAN.md, patch henüz atanmadı.

Bu checkpoint anında üçü çalışıyor; root mevcut Home runtime'ına yeni adapter
bağlamadı. Sonraki adım ajan raporlarını alıp sözleşmeleri beraber kontrol etmek,
yeni testleri çalıştırmak, tabloda kanıtla durum güncellemek; sonra RENDER-01 dosya
sınırı ve runtime integration görevi atamak.

## Context daralmadan yazılacaklar

Her teslimde: iş ID/sahibi, son değişen dosyalar, test komutu ve sonucu, pending
ajan/tool/session, karar ve gerekçesi, unresolved risk, tam sonraki adım. Başarısız
denemeleri kısa kaydet; tekrar yapılacak/gerek kalmayan test ayrımını koru. Salt
transcript veya log dökümü yerine devam edilebilir checkpoint tut.

## Kontrol noktası 2 — saf modeller teslimi

Root WIN-01 + FOC-01 yeni testlerini birlikte çalıştırdı: 7/7 başarılı.
calculateHomeVirtualWindow fixed stride/gap hesabı yapar; segments parent gap:0
ister. Uzak focus ayrı singleton aralık, bütün prefix yok. homeLogicalFocus
canonical items ve full logical rows ister; null state güvenli. Runtime hâlâ
eski HomeRowVirtualizer'a bağlı, yeni dosyalar import edilmedi.

Aktif işler: window_model homeVirtualRows.js/test Modern data adapter'ını
oluşturuyor; load_review detail methods08/methods27 stale sections rAF cleanup/token
fix'i + detailSectionsPerformance.test.mjs uyguluyor. focus_model ilk işi tamamladı.

Entegrasyon kararı: catalog loading skeletons navigable items'a karışmaz;
row.loadingItems ayrıdır. CW loading mevcut focusable semantiği stable synthetic
identity/action ile korunmalı. split CW/upcoming preprocessing caller'dadır;
aynı sıralama/tarih mantığı yeni helper içinde yeniden yazılmaz.

Sonraki adım: bu iki aktif ajan teslimini bekle; root tüm yeni/eski anlamlı Node
testlerini, lint'i, build'i çalıştırıp rapor/table durumlarını güncellesin. RENDER-02
henüz başlamadı: değişken satır yüksekliği ledger ve data window renderer gerekir.
TV'ye bu saf helperlar için yeniden kurulum yapılmadı/gerekmez.

## Kontrol noktası 3 — adapter ve stale Detail patch

- LOAD-02 source patch methods08/methods27 ve yeni detailSectionsPerformance.test.mjs
  root kontrolünde 2/2 detail testi geçti. rAF/timer cancel fonksiyonu handle ile
  sahiplenilir; callback token + route + own frame kontrol eder. Eski A callback'i
  B pending meta/frame'ini temizlemez. TV'ye yeni patch kurulmadı.
- LOAD-01 raporunda önemli düzeltme: ScreenUtils.hide container DOM'unu temizliyor;
  'hidden DOM kalır' leak iddiası yanlıştı ve rapordan düzeltildi. Singleton result
  refs ve sınırsız cache bulguları ayrı geçerli.
- window_model Modern homeVirtualRows.js/test teslim etti; root invalid itemId/
  incomplete collection folder action için son minimal guard+test istedi. Source
  itemIndex mutlak index, logical cursor index items array position olabilir.
- focus_model yeni homeRowMetrics.js/test değişken yükseklik ledger'ı üzerinde:
  measured/estimated heights, lazy prefix rebuild, bounded-by-current-row keys,
  reorder/remove/layout reset. No runtime wiring.
- load_review yalnız MD ID eşleştirmesi ve hafif TMDB→IMDb dönüşümü reuse
  endpoint'i araştırıyor; yeni source patch bu alt görevde yasak.

Bir sonraki adım bu ajan teslimlerini alıp 9 eski test + yeni helper/adapter/metrics/
section tests'i beraber çalıştırmak; lint ve paket/build graph kontrolünü yapmak.
Sonrasında RENDER-02/NAV-01 hâlâ açık olarak işaretlenmeli. İlk full markup ve
DOM nav refs bu turda henüz kaldırılmadı; tamamlandı/hızlandı iddiası yok.

## Kontrol noktası 4 — son adapter guard ve backlog

window_model artık tamamlandı: homeVirtualRows/test 5 adapter testi + 4 window
ile 9 kontrol. Invalid source ID, incomplete collection folder, malformed CW
atılır; collection yanlış openDetail'e düşmez; tv/channel tipleri korunur.
Canonical item.itemIndex source position'dır, focus cursor.itemIndex row.items
logical position'dır; renderer items[cursor.itemIndex] üzerinden source/itemIndex
alır. Bunları karıştırma. modeldeki ham kaynaklar veri olmalı, DOM değil.

load_review tamamlandı: bulgular YUK-B01..B10, root task IDs ayrı. Hafif reuse
TmdbService.tmdbToImdb (external_ids) bulunmuş; signal almıyor ve full enrichment
TMDB enabled gate'iyle aynı değil. Çıplak helper replacement yapmadan enabled,
timeout ve canonical fallback davranışı test edilmeli. Source patch bu helper'a
henüz uygulanmadı.

Aktif yalnız focus_model MEASURE-01. Final teslim sonrası root bütün testler,
lint ve paket/build graph kontrolünü yapacak. Root table RENDER-01 local verified,
LOAD-03 cache / LOAD-04 canonical / LOAD-05 first paint / LOAD-06 abort+dirty
sections ayrı planlandı. RENDER-02/NAV-01 henüz atanmadı ve runtime'a bağlı değil.

## Kontrol noktası 5 — bütün ajan teslimleri ve son doğrulama

- Üç ajan tamamlandı; bekleyen ajan veya terminal işi yok. Önceki terminal
  session 75787 başarıyla bitti. Tekrar poll etme.
- MEASURE-01 homeRowMetrics.js/test teslim alındı: değişken ölçüm, rowKey bazlı
  sınırlı ölçüm cache'i, layout reset, lazy prefix rebuild, sparse focus pin.
  Pencere hesapları aralığa binary search ile ulaşır; model DOM tutmaz.
- Tüm navigation/Home/stream/detail glob testleri **30/30 geçti**; lint,
  package:webos, check-performance-build ve git diff --check başarılı.
- Build graph: 64 başlangıç dosyası, 1.268.438 byte; legacy 3.220.572 byte;
  uygulama JS farkı %60,6. CSS/core-js/görseller hariç; bu çalışma yeni runtime
  sanallaştırmasını entegre etmediği için bu sayı yeni mimari kazancı değildir.
- Yerel IPK yeniden üretildi. Saf modeller import edilmedi; LOAD-02 stale rAF
  patch'i pakette, TV'ye bu tur kurulum yapılmadı. Önceki installed sürüm ve
  ölçüm sınırları geçerli. AGENTS.md upstream ignore kuralıyla yerel dosyadır.

Tam sonraki iş RENDER-02: Modern renderer'ın homeVirtualRows + homeVirtualWindow
+ HomeRowMetrics + homeLogicalFocus sözleşmelerini tüketmesini sağla. Kaynak
item.itemIndex ile logical cursor.itemIndex farkını koru. İlk 20×100 markup
bütün kartları oluşturmasın; distant focus prefix mount etmesin; spacer parent
CSS gap sıfır olmalı. Sadece mounted DOM ve onun observer/image işlerini tut.
Ardından NAV-01 ile DOM refs taşıyan navModel/snapshots/pagination sayımını veri
modeline geçir; eski cached detached renderer'ı iki otorite olarak bırakma.
İlgili dosya sınırlarını panoda belirle, çakışmadan ajanlara ata. Bu işleri
runtime entegre ve TV doğrulandı durumlarına ayrı geçir. Mevcut testleri ve
önceki kirli değişiklikleri koru; commit/stage/push istenmedi.

## Kontrol noktası 6 — runtime entegrasyonu başladı

Kullanıcı devam/az token/subagent istedi. window_model RENDER-02 ve gerektiği
ölçüde Modern NAV-01 kaynaklarının tek edit sahibi. focus_model Home read-only
nav bağımlılık haritasını window_model'e gönderir. load_review LOAD-03 cache
incelemesinden sonra root dosya sınırı koordine eder. Root sadece MD/test
koordinasyonu, üç ajan aktif. Önceki 30 test baseline; yeni runtime sonuç yok.

LOAD-03 dosya sınırı onaylandı: js/core/util/boundedCache.js/test,
metaRepository.js, tmdbService.js ve tmdbMetadataServiceHelpers-01-tmdb-base-url.js.
Result cache LRU entry bütçesi; mevcut inFlight Map/timeout/auth/TTL semantiği
korunacak, yeni TTL yok. İlk bütçeler metadata/conversions120, header40, rail80,
browse20, moreLike40; cihaz byte ölçümüne dayalı optimum değil. Root test glob'a
js/core/util/*.test.mjs eklemeli. Home kaynak sahibi hâlâ window_model.

## Kontrol noktası 7 — cache teslimi / renderer bekleniyor

LOAD-03 tamamlandı, root toplu31/31 Node testi geçti (core/util/boundedCache
testi eklendi). Full lint/package henüz yeni renderer sonrası yapılacak.
window_model runtime renderer/nav sahibi; focus_model standalone browser harness
yazacak, API bekliyor. load_review ikinci read-only runtime caller review rolünde.
Root Inspector terminal3228 açık (http59974, geçici); yeni TV kurulumu yok.
Cache sonuç bütçesi testli, aktif inFlight Map'e dokunulmadı. clearCache çağrısı
aktif eski completion ile cache refill/dedup riski eski davranış; ayrı backlog.

Root ilk homeDataWindow review: target restoreScroll desired trackStates set
sonrası sync captureTrackStates eski live scroll'u overwrite edebiliyor.
window_model'e düzeltme, focus_model harness'e savedscroll regresyonu iletildi.
Article string injection duplicate style attr olasılığı da renderer sahibine
iletildi. Editler ajan sahibi; root Home dosyasına henüz dokunmadı.

## Kontrol noktası 8 — ilk gerçek DOM fixture hata yakaladı

focus_model scripts/performance-data-window-check.js yazdı; root esbuild IIFE
olarak /private/tmp bundle üretip TV Inspector'da çalıştırdı. İlk kontrol run
restoreScroll regression'da durdu: “Back requested scroll was overwritten by
previous mounted track state”. Bu beklenen root finding'i doğrular; window_model
fix sahibi, sonucu başarı sayma. Kurulu app değişmedi, fixture finally kaldırılır.
Yeni source sonrası IIFE yeniden build et. Root eval catch error.message/3stack
ile yalnız test hatasını döndüren /private/tmp expression kullanıyor. Agent
load_review ek mixedcollection gerçek height/layoutmeasurementprune risklerini
window_model'e iletti. Sonrasında renderer fix+integration ve full review açık.

TV fixture ikinci run: Back restore geçti; nextassert “removed row retained
numeric state” başarısız. setRows prune sonrası sync captureTrackStates eski
trackHandlers'dan kaldırılan rowKey'yi yeniden ekliyor olabilir. Root window_model'e
capture ve scrollhandler rowByKey ownership guard iletti. Test gevşetilmedi.

## Kontrol noktası 9 — izole data renderer gerçek TV testi geçti

Son source bundle ile scripts/performance-data-window-check.js TV Inspector'da
**59/59** geçti.20x100 başlangıç markup8 çağrı,2 mountedrows/8cards, height7736px;
sparsefocus rows0/1/17, item200, restoreScroll, reorder/remove, destroy2rAF.
İki önceki failure gerçek bug fix ile kapandı; assertion gevşetilmedi. Bu class
fixture kabulüdür, kurulu ana uygulama entegrasyonu veya FPS kabulü değildir.
window_model Home source/navigation entegrasyonu sürdürüyor; root finaltest,lint,
paket/build graph, read-only review ve sonrasında TV runtime smoke yapacak.

## Kontrol noktası 10 — Home wiring ve son review

window_model Home integration aktif olduğunu bildirdi; kendi factorytest/lint
yapıyor. load_review Home finalreadonlyreview'a geçti, confirmedfinding window
sahibine gider. Root modernDataWindowLayout.test.mjs sahibi,1/1 geçti:
20x100 kaynak fullcatalog/CW callback0, emptywindow nofallback, SeeAll sources
ve nonwindowlimit korunur. focus_model harness59 sonpass; classcollectionheight
sonfix sonrası yeni bundle rerun gerekir. NAV-01 mounted-view DOM projection
legacyhelper için kalır, strictDOM-free cleanup açık; PATCH01 fullshell onarrival
açık. Renderer.rows/focus ana otorite. InstalledTV test henüz yapılmadı.

Root teslim sonrası tüm Node (home/*.test dahil+boundedCache), lint, package:webos,
check-performance-build,diffcheck çalıştıracak. Reviewfix sonrası yeniden
gerekli kontrol. TV isolate fixture ve eski21kontrol de aynısonbundle run.
Ardından izin mevcut: package install/launch, inspector yenidenkeşif ve Router
getCurrentScreen().homeDataWindow doğrula. Router export için metafile outputs
entryPoint metaDetailsScreen.js bul; eski hash kullanma. Saf appDOM counts, marker,
logicalcounts, activewindow/mapcounts; kişisel rowkeys/ids dump yok. Testfail olursa
fix/yenipaket; fullarchitecture/performancesuccess iddiası yok.

## Kontrol noktası 11 — son source review ve35test

Root tüm anlamlı Node testlerini yeni factory+layout+bounds ile çalıştırdı:
35/35geçti. Source henüz reviewfix alıyor, final paket/lint sonra. load_review
P1 collection variableheader feedbackloop buldu: trackheight=measuredsection−46
ise76.4pxheader herRAFtrack'i30.4pxbüyütür. window_model fixowner; focus_model
harness wrappedheader/mixedshape stability ekliyor. Root Modern restorebranch
layoutModeguard bypass buldu ve windowowner'a iletti. NAV strictprojection
ve PATCHpartial updates hâlâaçık. İlk59fixture finalclass sonrası rerun edilmeli.

## Kontrol noktası 12 — source freeze / finalkontroller

window_model teslim/sourcefreeze: son edits layoutMode restoreguard, collection
trackheight feedbackfix, bounded220ms expandedwidth alignment. Sonrası yalnızMD.
Root newfixture77/77 +legacy21/21actualTVbrowser;35Nodepass. Bekleyen terminal
19633 lint/package/graph/diff sonucu poll edilmeli. Root kaynaktest/bundle sonrası
sourcefreeze var; tekrar kaynakedit gerekirse ilgilichecks/paket yenilenecek.
Üç ajan teslimlerini tamamladı. RENDER02 Modern integration kaynaktaaktif,
NAV01mountedviewprojection compatibility ayrıaçık, PATCH01shellcommit daraltması
ve Classic/Grid datarenderer açık. Yeni TV kurulum henüzyok; mevcutizinle
package install/close/launch ve inspector rediscovery ardından appsmoke yapılacak.

## Kontrol noktası13 — kurulu Modern data renderer smoke geçti

35/35Node+lint+package+buildgraph+diffcheck final başarılı. Graph64initialfiles,
1.299.126byte legacy3.251.743byte/%60rawJSfarkı,102outputs; CSS/coreJS/imageshariç.
LGnuvio-lg-145 close/install/launch success; mevcutauthprofil Homeaçıldı, birkanmarker.
Installed Modern dataWindowtrue/legacyCachefalse31rows769cards2mountedrows13cards,
map13/handlers2, focusconnected. Actualroute20item detail→Back same row/index/item,
connectedfocus/datamodel;25mountedcards. Skeleton o an yoktu, animationnull.
Tekwarm synthetic10right10leftsamefocus,index10; handlerp9517.1, rAFp9533.3/max50,
longtasks0. A/B/gerçekkumanda/FPSgarantisi değil,16.7handlerhedefi henüzkarşılanmıyor.

Bekleyen terminaltest yok; son eval93508 tamamlandı, sourcefreeze var. Inspector
50411 (localhost60579/page04FC7C4F5C707FC2867370866B3376B4) debugserver açık;
eski3228 uygulamakapanınca eski bağlantı, kalıcıport/page sanma. Router entry
currentmetaDetailsScreen-MBEVCD4V.js, hash yeni build'de değişecek. Source fixture
new77+legacy21pass; JSexpressions/private/tmp yalnız geçiciartifact, repo testleri
kaynak, tekrar bundlegen. İlk failedfixturetestler gerçekfix aldı (Backscroll,
removedrowstate, collectionheaderfeedback). Gitstage/commit/push yok.

Tam sonraki iş PATCH01: her dataarrival'da fullshell render/createDataHomeWindow
replacement yerine aynırenderer+değişensatırdatamodelcommit; hero/sidebar DOM
korunmalı, paginationpending generation/state sahipliği testlenmeli. NAV01logical
otorite hazır ancak navModel mountedDOMprojection bazıvisualhelpers için kalıyor,
strictprojectioncleanup ayrıaçık. Classic/Grid datarenderer değil cachedfallback.
LOAD04hafifcanonical, LOAD05basepaintbarrier, LOAD06abort/dirtysection ve invalidation
baki. TV01performanceacceptance tamamlanmadı; tekrarlıcold/warm, realremote, longhold,
vertical/wheel/sidebar, playerfirstframe ve20routeheap halen gerekli. IPTV bekliyor.
Root yeniatamalarda Home source tekowner; readerreview/harness ayrıowner. Üçajan
sonişteslim tamam; yeniiş için followup_task kullan (send_message idleturnbaşlatmaz).

## Kontrol noktası14 — kaynak seçici tekrar bug

Kullanıcı detail kaynak seçiminde üst kaynakların tekrarını bildirdi. load_review
stream sourcechip load/render/rootcause/test sahibi. Root candidate: methods04
markSuccessfulSources known Set yalnız başlangıçta alınır; bilinmeyen tekrar name
entries aynı batch'te push olurken known.add yok. Henüz doğrulanmadı, uniquefilter
ve keyedDOM davranışı incelenecek. Root TV readonly route/logical/DOM duplicate
sayı eval'i functions cell89 pending; Inspector eskiport60579 canlılığı bilinmiyor.
Gerekirse ares-inspect yeniden keşif. Private URL/credential dump yok.

## Kontrol noktası15 — kaynak tekrarının gerçek TV reprosu

Inspector yeniden keşif terminal20842/localhost60885/pageC40AE09FE65742020715B8CAEFF9F9A1.
Eski60579eval timeout oldu, cell89 bitti. Oldinstalled TV'de Home→movie manual
stream (autoplaykapalı)→Home:58streams completed; max4DOMchips,2fazladuplicate
buttons; logicalduplicates0. Userbug gerçekDOMownership cause ile doğrulandı.
load_review methods04 known.add + methods08 authoritativechipregistration +
methods01 virtualrowregistration fix sahibi; sharedhelperedit yok. Badge
hydration intentionallyruntimeowned cache, körregisterbug çıkarır; scope dışı.
New scripts/stream-chips-dom-check.js actualrefresh→fullkeyedrender fixture hazır,
rootbundlegen+TVrun bekliyor. Target2/2streamtests+lint ajanda geçti. Sourcefreeze
ve fullchecks/package/TVinstall sonra sameflow duplicatescount0 doğrulanmalı.

## Kontrol noktası 16 — kaynak tekrarları düzeltildi ve TV'ye kuruldu

SRC-01 source freeze: stream methods01/04/08, streamPerformance.test.mjs ve yeni
scripts/stream-chips-dom-check.js. Shared keyedDomUpdate değiştirilmedi. Chip
partial innerHTML ve virtual window generated replacement sonrası childNodes
register edilir. markSuccessfulSources unknown insert sonrası known.add yapar.
Badge hydration intentionally runtime-owned; kör kayıt eklenmedi (empty source
placeholder + retained hydrated flag tekrarında içerik silinebilir).

Root 36/36 Node, lint, package:webos, build graph, diffcheck başarılı. Actual
TV isolated sourcechip fixture 17/17: partial/full/partial/full, loading spinner,
selectedfilter ve focus korunur, duplicate 0. Yeni paket close/install/launch
başarılı. Gerçek aynı film manual stream akışı: 58 stream completed; eski pakette
2 fazla duplicate button/modeldup0, yenide duplicatebutton0/modeldup0. Sonunda
Home'a/önceki odağa dönüldü, video başlatılmadı. Kullanıcının bu bug isteği tamam.

Test terminal 67040 tamamlandı, pending eval/build/install yok. Inspector84357
localhost60968/pageE96629D8B4AE8C4E226F5A25660261EC açık; port/page geçici, yeniden
keşfet. Router module yolu metafile'dan yeniden türetildi. Geçici expressions
/private/tmp, kalıcı fixture repo scripts dosyası. Credentials/URLs rapora yazılmadı.
Son performans backlog PATCH01/NAV01/LOAD04..06/ClassicGrid/TV01 önceki checkpoint
13'te; bu bugfix onları tamamlandı saymaz. Git stage/commit/push yapılmadı.

## Kontrol noktası 17 — Luna 6/max PATCH-01 başlangıcı

Kullanıcı bölgesel güncellemeyi özellikle Luna 6/max subagent'a yaptırmayı,
adımları açık anlatmayı ve root kod incelemesi/yeniden yazdırma istedi. Plan
plans/2026-10-05-home-bolgesel-guncelleme.md oluşturuldu. Home+ilgili fixture
baseline /private/tmp/nuvio-patch01-baseline; önceki kirli diff'i yeni edit
sanma. Root MD/TV, Luna Home source/test/fixture sahibi olacak. Önceki 36 Node,
77+21+17 DOM ve SRC-01 TV kabulü baseline; henüz yeni çalışma sonucu yok.

## Kontrol noktası 18 — Luna akış incelemesi teslimi

Aktif ajan /root/luna_patch01, model gpt-6-luna/max, fork none. Önceki ajanlar
source sahibi değil. Luna render içinde renderer destroy/recreate ve sync'te
bütün visiblecard markup tekrarını doğruladı; row/index/fingerprint commit +
renderer reuse/dirtyvisible cache yaklaşımıyla uyguluyor. Root sınırı iletti:
sync/keypress/rAF tüm itemları stringify/scan edemez; nested metadata/cast/video
serialize maliyeti kontrol edilecek. Explicit dirty revision veya mounted card
snapshot tercih; mutable ref tek invalidation kriteri olamaz. Rare profilechange
için basit fullfallback kabul, sırfprofile yeni framework yok. Root source
editlemedi; baselineprivate/tmp hazır. Yeni test/paket/TV henüz yapılmadı.

Root kabulde yalnız bu tur source farkını baseline ile okuyacak; mantıksal
state ve DOM/callback invariants testlenecek, gerekirse aynı Luna'ya rewrite.
Shared helper edit gerekirse koordinasyon; önceki SRC01 kayıt düzeltmeleri korunur.

## Kontrol noktası 19 — ilk Luna kodu root review'da revizyona gitti

İlk değişenler: HomeDataWindow, HomeRowMetrics, methods04 requestBackgroundRender
dirty batching, methods30 cleanup. Root kendi baseline ile yalnız yeni farkı okudu.
Henüz source tamamlanmış/çalışır teslim değil. Root Luna'dan şu düzeltmeleri istedi:
1. previousTrackMetrics=this.trackMetrics + trackMetrics.clear aynı Map'i siler;
   ölçüm reuse çalışmaz. Eski Map'i koru, yeni Map veya snapshot kullan.
2. metrics.setRows estimatedHeight/closure satırı eksik, edit sonrası parse check.
3. Collection metrics itemIdentityKey'ye geçince duplicate canonical IDs rowKey
   dedup nedeniyle extent/offset kaybına yol açabilir. Index metric keys'i koru
   (dirtycollection reset var) veya duplicate-safe meaningful check. Cache duplicate
   identity/logical index case'ini de koru. Root bu kısmı kabul etmedi, rewrite istedi.
Aktif Luna uygulama/revizyon; root source editlemedi. Test/package/TV henüz yok.

## Kontrol noktası 20 — devam eden code review ek bulguları

Luna setRows syntax/oldMap sorununu düzeltti ve collection metrics index keys'i
korudu (source hâlâ editleniyor). Root yeni iki kabul noktası iletti:
- cardMarkupCache row+mediaidentity tek slotla duplicate logical itemlarda
  her frame yeniden render eder; logical index'i cache key'e eklemek küçük çözüm.
- setRows default invalidation={} eski public API'de aynı kimliğin değişmiş
  içerik alanlarını cache'de stale bırakabilir; unknown/default conservative
  invalidation veya mounted snapshot, pagination updatedrow dirty hint gerekli.
Ek gerçek akış: catalog onRow refreshWatchedTitleState tetikler; aynı watched
membership yeniSet'i unknown/full veya invalidate-all'a çevirirse targeted fayda
kaybolur. Root değişmeyen membership'te render gerekmemesini, profile flag
batching deadguard kalmamasını söyledi. Henüz finaltest/sourcefreeze yok.

Aktif tek builder /root/luna_patch01 gpt-6-luna/max. Root bu tur implementation
yazmıyor, useristeği gereği review ve rewrite istekleri Luna'ya gidiyor. Değişen
Home dosyalarının yalnız bu tur diff'i /private/tmp/nuvio-patch01-baseline ile
karşılaştırılacak. Plan ve takiprootowner, test/fixture/sourceLunaowner.

## Kontrol noktası 21 — bölgesel güncellemenin ilk teslimi, inceleme sürüyor

Luna 6/max ilk source patch'i yazdı; catalog/CW/watched dirty hint bağlantıları
ve anlamlı testleri henüz tamamlıyor. Root implementation yazmadı. Request frame
backgroundDataUpdate taşır; methods31 commitModernHomeDataUpdate eligible Modern
Home'da renderer/shell/viewport'u korur, visible card cache dirty row/item ile
invalidation uygular. Unknown/default setRows cache temizler; duplicate cache key
source index içerir; eski track metrics ayrı Map'te korunur. Root önceki teslimde
bulduğu hataları aynı Luna'ya yeniden yazdırdı. Parse kontrolü agent tarafından
geçti; final Node/lint/package/TV doğrulaması henüz yok.

Son incelemede ayrıca cache'in logical row index yanında sourceRowIndex değişimini
ve no-hint setRows collection geometry değişimini ele alması kontrol edilecek.
Gerçek render entry, değişmeyen kart/renderer/DOM kimliği, aynı ID metadata update,
CW/hero, duplicate, focus/scroll, pagination/cleanup testleri gerekli. Yeni diff'i
/private/tmp/nuvio-patch01-baseline ile karşılaştır; git diff eski işleri de içerir.
Aktif builder /root/luna_patch01; root MD/review/TV sahibi. Son kurulu TV build
önceki SRC-01 kabulüdür; PATCH-01 henüz TV'ye kurulmadı. Sonraki adım caller wiring
ve cache review, gerekiyorsa Luna rewrite; ardından kontroller ve TV kurulum/smoke.

## Kontrol noktası 22 — erken gerçek TV DOM regresyonu

Root yeni HomeDataWindow ile henüz genişletilmemiş data fixture'ı bundle edip
kurulu eski uygulamanın TV tarayıcısında izole çalıştırdı: 77/77 başarılı,
20x100 logical veri / ilk 2 satır 8 kart. Fixture temizlendi. Bu yeni runtime
kurulumu veya yeni PATCH-01 acceptance değildir. Luna sourceIndex/sourceRowIndex
cache imzası, unknown update geometry reset ve focus restore başarısızsa full
fallback revizyonlarını yazdı; yeni acceptance fixture/testleri üzerinde aktif.
Root kod diff incelemesi sürüyor. Inspector terminal 52752, localhost62034 /
page E96629D8B4AE8C4E226F5A25660261EC geçici bağlantı. Yeni paket yok.

## Kontrol noktası 23 — genişletilmiş test incelemesi ve son scroll revizyonu

Root mevcut source/test setinde 39/39 Node ve npm lint başarılı çalıştırdı.
Genişletilmiş TV fixture ilk denemede 'vertical anchor fixture did not enter row 8'
hatası verdi: setup setRows ardından sync çağırmadan uzun içerikte scroll atıyor;
eski kısa DOM extent atamayı 0'a clamp ediyor. Luna setup'u düzeltiyor.
Root bunun üretim eşini de tespit etti: eski içerik sonunda CW üstte eklenirse
setRows yeni scrollTop'u DOM height commit edilmeden atar ve old max'e clamp olur.
Luna'dan önce bottom + prepend-CW test, sonra yeni extent commit sonrası anchor
restore düzeltmesi istendi. Source henüz freeze değil, bu revizyon sonrası Node/
lint kontrolü yeniden gerekli. Bu fixture başarısızlığı kabul sayılmaz.
Henüz package/install yok; TV'deki uygulama SRC-01 baseline. Inspector52752 aynı
62034 bağlantısı; pending tool yok. Root implementation yazmadı.

Bottom + prepend-CW hatası root tarafından gerçek TV tarayıcısında izole
repro ile ölçüldü: oldTop=7176, expectedTop=7482, actualTop=7176; anchor korunmadı.
Geçici repro /private/tmp/nuvio-patch01-anchor-repro-source.js ve bundled .js;
kalıcı fixture sahibi Luna. Önceki yeni source-index/unknown-geometry/duplicate
kontrolleri bu repro içinde geçildi. Luna pending anchor rowKey+intraOffset'i
setRows'da saklayıp yeni extent commit sonrası sync'te uyguluyor; destroy cleanup
ve ardışık setRows ownership korunacak. Henüz tamamlandı/sourcefreeze değil.

## Kontrol noktası 24 — PATCH-01 source review ve genişletilmiş DOM kabulü

Root tüm yeni source farklarını baseline ile okudu, caller wiring ve kaynak
indekslerini denetledi; yalnız Luna kaynak yazdı. İstenen revizyonlar tamamlandı.
Pending anchor rowKey/intraOffset yeni extent commit sonrası uygulanıyor;
cache source/logical index signature ve unknown geometry güvenli. Genişletilmiş
fixture gerçek TV tarayıcısında baştan sona 114/114 geçti. Metadata mutation,
değişmeyen row/card DOM ve renderCard=0, CW index shift, duplicate cache/DOM,
unknown shape geometry, bottom prepend anchor, reorder/Back/cleanup başarılı.
Kaynak Luna'ya freeze ettirildi. Root son Node/lint kontrollerini başlattı;
package/buildgraph ve TV install/runtime smoke sırada. Yeni runtime henüz TV'de
değil. Inspector52752 bağlantısı62034 geçici; pending kontrol varsa takip et.

## Kontrol noktası 25 — paket kontrolü ve gerçek TV kurulum

Son kaynak revizyonu sonrası root 39/39 Node, npm lint, package:webos,
check-performance-build ve git diff --check başarılı. Buildgraph: initialFiles64,
initialBytes1306365, legacy3259139, totalOutputs102 (~59.9% raw app JS farkı;
corejs/CSS/images dahil değildir). local.example fallback uyarısı önceki gibi.
LG nuvio-lg-145 / space.nuvio.webos close/install/launch başarılı; yeni sürüm
TV'de açıldı. Installed state: Modern Home31row/770card,2mountedrow/13card,
map13/handlers2, legacyCache=false, birkan marker ve connected focus mevcut.
Inspector yeni terminal71855, localhost62222/pageBA679F7EFA140AACC2A4F53D8EFDAA60.
Eski52752/62034page artık stale. Hash/router probe yolları metafile'dan yenilendi.
Root actual-app PATCH-01 reversible metadata/renderer/DOM/counter probe'unu
başlattı; ardından legacy21/source17, nav ve detail/Back/source tekrar smoke.
Kaynak agent tamamlandı/frozen. Commit/stage/push yok.


## Kontrol noktası 26 — kurulu runtime kabulünde açık bulgu ve araç limiti

Kurulum GERÇEKTEN başarılı; yeni PATCH-01 IPK LG nuvio-lg-145'e install/launch
edildi. Installed Home31row/770card,2mountedrow/13card; birkan marker ve focus
connected. Source agent luna_patch01 tamamlandı/frozen; root implementation
kaynağı yazmadı, bütün revizyonlar aynı Luna6/max tarafından uygulandı.

Gerçek app reversible metadata probe /private/tmp/nuvio-patch01-installed-check.js
çalıştı fakat 'unchanged row cards rerendered' assertion verdi. Bundan önce
same renderer/no replacement, shell/viewport/sidebar/hero/card node, updated
metadata, current focus ve vertical/horizontal scroll assertion'ları geçti.
Başarılı full runtime acceptance sayma. Finally original payload, renderCard,
createDataHomeWindow ve lastHomeInputAt restore yaptı, restore dirty-row update
publish etti. Beklenmeyen çağrı sayısının async watched/CW background callback,
viewport working-set değişimi veya cache hatası olması henüz ayırt edilmedi.

Root diagnostic instrumentation ekledi: /private/tmp/nuvio-patch01-diagnostic-check.js.
Bu geçici probe yalnız count/kind/index ve reason flags döndürür; özel addon
ID/URL yok. requestBackgroundRender çağrılarını loglar ve metotları finally
restore eder. Tanılama ÇALIŞMADI: exec escalation automatic approval review
kullanım limiti nedeniyle başarısız; tool error 'try again at 7:01 PM', review
failed / not a safety determination. Aynı erişimi farklı araç veya escalation
olmadan deneyerek denetimi aşma. Root etkilenmeyen MD kayıtlarını tamamlıyor.

Tam sonraki adım: limit/onay incelemesi çalışabilir hâle gelince diagnostic
probe'u current Inspector page ile tekrar çalıştır. İlk hata cold load incoming
callbacks ise gözlemlenen nedenle kontrollü stable tekrar yap; gerçek source bug
ise aynı Luna6/max'a followup_task ile test+minimum rewrite yaptır, root review,
39 suite/lint/package/buildgraph ve install yeniden. Başarısız probeyi kabul
sayma. Sonra legacy DOM21/sourcechip17, nav, detailBack ve source repeat runtime
smoke yap. Bu tur bunlar henüz YAPILMADI, eski tur sonuçlarını yeni sayma.

TV Inspector71855 localhost62222/pageBA679F7EFA140AACC2A4F53D8EFDAA60 geçici.
Önceki Inspector52752/62034 stale, açık olabilir. Runtime Router chunk metafile
entry metaDetailsScreen-MBEVCD4V.js (hash geçici, yeniden türet). Son Node39/39,
lint/package/buildgraph/diff başarılı; isolated TV114/114. Git stage/commit/push
yok. Yeni sürüm TV'de kalıyor; geniş performans / tüm mimari kabulü açık.

## Kontrol noktası 27 — Anthlogy kaynak regression araştırması

Kullanıcı yeni SRC-02 araştırmasını, subagent ve Luna/max token ekonomisini
istedi. Önceki PATCH-01 kurulu ve gerçek app acceptance açık; kaynak kaybolması
öncelik aldı. Mevcut kirli ağacı koru. Tek yeni Luna6/max ajan dar kapsamda
stream/plugin filtreleri + son source/build diff'i salt okunur inceler; root
TV addon/plugin durumunu secrets göstermeden araştırır. Anthlogy string repo
kaynağında bulunmadı (watched repository anthology yorumu ilgisiz). Henüz nedeni
belli değil. Daha önce escalation approval usage-limit failure vardı; yeni tur
onay denetiminin erişebilirliği meşru aynı TV inspector işlemiyle denenebilir,
alternatif araç/sandbox yolu ile review aşılmayacak. Credential/URL ham yazma.

## Kontrol noktası 28 — SRC-02 Anthology nedeni gerçek TV'de doğrulandı

Luna6/max stream diff/plugin/build akışını salt okunur inceledi; core pluginManager
ve streamRepository worktree'de upstream'den değişmemiş. Root TV inventory:
Anthology NUVIO_JS kayıtlı/enabled,41provider/34enabled, pluginsEnabled=true,
groupByRepo=true; runtime candidate/executable=true,ready,packaged=true,error yok.
Repo silinmemiş. Kullanıcı tüm içeriklerde loading -> kırmızı -> kaybolma bildirdi.

Root config boolean kontrolü: tmdbApiKeyConfigured=false; Home260movie260IMDb,
numeric0, compatible providers true. GERÇEK stream flow instrument edildi:
pluginRequests1, ensureTmdbId IMDb(movie)/requireEnabled=false/resolved=false,
pluginExecutionCalls0, pluginGroups0; chipStates loading,error,absent; completed
true ve AIO/diğer addon128stream. Video oynatılmadı, finally metotlar restore ve
Home'a önceki focusla dönüldü. Bu doğrudan config/ID conversion failure kanıtıdır.

Kök neden: local.properties yok; paket local.example.properties fallback'i
kullanıyor ve TMDB_API_KEY boş. ensureTmdbId anahtar yoksa null, getPluginStreams
request kuramıyor; kaynak error ve1.6sn sonra kaldırılıyor. Performans diff UI
önbelleği/plugin motoru bug'ı değil; root paketlemede eksik ayarı gözden kaçırdı.
Luna rapor path/line kanıtları WEBOS_ANTHLOGY_AJAN.md. Root key recovery için
yalnız repo config/artifact dosya yollarını araştırır, raw key/URL dump etmez.
Gerekli minimum fix: gerçek build config sağlamak ve eksik config paketleme
kontrolünü güçlendirmek; yeni framework/unsupported guessed IDs/key ekleme yok.
Yeni TV Inspector90192 localhost63110/pageC90F66CAC5B9D8788C53E11B0541E9BA geçici.
Bu tur escalation erişimi çalıştı; önceki limit rejection bu araştırmayı engellemedi.

## Kontrol noktası 29 — SRC-02 araştırma teslimi ve doğru ayar bekleyen çözüm

anthlogy_review Luna6/max tamamlandı; root kısa raporu okuyup gerçek TV ölçümüyle
karşılaştırdı. WEBOS_ANTHLOGY_AJAN.md neden/path/line ve remedy içerir. Source kod
editi yok; yeni paket kurulmadı. Mevcut kurulu PATCH-01 boş TMDB ayarlı pakettir;
Anthology bu IMDb içeriklerde henüz düzeltilmedi, düzelttik denmeyecek.

Ajan ayrıca local env resolver + actual ensureTmdbId(no-network placeholder)
repro yaptı: local.example source, configured=false, resolved=false. Root kendi
TV ölçümü kesin execution0 kanıtını sağlar. Checkpoint28 araç/read-only state
ve gerçekmovie flow sonuçlarını içerir. Stream chip/UI guard'larını sırf kırmızı
rengi kaldırmak için değiştirme; kimlik dönüşümü ayarı çözülmeli.

Kullanıcıya optional clarification: varsa önceki local.properties dosyası yolu
(anahtarı chat'te isteme) soruldu. Repoda yalnız local.example ve yeni IPK var;
API anahtarı bulunamadı. Tam sonraki adım gerçek yapılandırma sağlanırsa build
key-presence boolean kontrolü, strict package/install ve gerçek movie/series
Anthology positive group kabulü. Kaynak yoksa kullanıcıya eksik TMDB ayarının
neden olduğunu açık bildir; third-party key/guessed ID/API workaround ekleme.
Plan plans/2026-10-05-anthology-kaynak-arastirmasi.md. Anahtar/credential URL
çıktı veya MD'ye yazılmadı. git diff --check geçti. Agent tamamlandı; toolpending
yok, Inspector90192 port63110/pageC90F66CAC5B9D8788C53E11B0541E9BA geçici açık.
PATCH-01 unexpected unchanged row markup test backlog'u ayrı açık kalıyor.

## Kontrol noktası 30 — kullanıcı TMDB yapılandırması ve performans ayarı yetkisi

Kullanıcı kendi TMDB API anahtarı ve okuma jetonunu verdi; TV'ye uygulama ve
performans için gereksiz/ağır ayarları kapatma istedi. Anahtar değeri MD'ye yok.
Root ignored local.properties dosyasını örnekten oluşturdu, uygulamanın desteklediği
TMDB_API_KEY'i yazdı; mode0600, gitignore doğrulandı. Jeton v4/bearer alternatifidir;
mevcut v3 entegrasyon API anahtarını kullanır, auth refactor gereksiz. Config-only
resolver localProperties=true/tmdbConfigured=true geçti. Root config/build/TV sahibi;
aynı anthlogy_review Luna6/max ajanı read-only mevcut perf prefs audit sahibi,
credential dosyasını okumayacak. Yeni source editi planlanmadı. Build strict env
ile yapılacak; auth/profiles/addons/native player/CW korunur. Performans ayarı
aktif profile'ın mevcut store API'leriyle reversible patch olacak; önceki prefs
özel backup olarak repo dışı /private/tmp saklanabilir, ham veri MD'ye girmez.

## Kontrol noktası 31 — yapılandırılmış paket TV'de, kimlik dönüşümü pozitif

Root config-only değişiklik sonrası39/39 Node, lint, strict webOS package,
buildgraph ve diffcheck geçti; generated dist env TMDB key varlığı ve local
config eşleşmesi yalnız boolean ile doğrulandı. local.properties gitignored0600.
Yeni paket LG nuvio-lg-145'e close/install/launch başarılı. Inspector92536
localhost63574/pageF39A5FB0C116F8EE7998C0E5AF07105D geçici bağlantısı.
Gerçek TV'de tmdbConfigured=true ve Matrix IMDb/movie ensureTmdbId
(requireEnabled:false) resolved=true. Kullanıcı credentialları rapor/çıktıda yok.

Mevcut aktif profil prefs: hero/expand/detailtrailer/CWthumbnail açık,
TMDBoptional enrichment globalfalse, postPlayRecommendations true, streamlogotrue;
depth/blur/autotrailer zatenfalse. Luna read-only consumer audit yapıyor. Root
patch önerisi optional ağırgörseller+metadataextras+postPlayrecs+streamlogos off;
CW/native/subtitles/auth/addons korunur. Henüz prefs set edilmedi. Sonraki adım
reversible store patch+DOM/focus doğrulama, Anthology gerçekprovider pozitif akış.

## Kontrol noktası 32 — performans ayarları uygulandı, Anthology pozitif test aktif

Aktif TV profilinde store partial setter'larıyla hero/expansion/fullbackdrop/
blur/depth/detailtrailer/CWthumbnail/external-meta-preference off; TMDBoptional
flags+CWenrich off (kimlik lookup requireEnabled:false çalışır); postPlayrecs
ve streamaddonlogo off. Önceki değerlerin private backup sonucu repo dışı
/private/tmp/nuvio-tv-perf-settings-result.json mode0600; ham backup MD'ye yok.
Setter equality checks geçti. CW/nativeSubtitleMode korundu, heroDOMyok,
focusconnected/dataWindowtrue/birkan marker mevcut. Repo/providers untouched.
Luna audit tamamlandı ve root consumer paths read/review yaptı; rapor appendix var.

Root Matrix manual source araması başlattı. __nuvioAnthologyProbe TV memory'de
execute/onGroup sayımı yapar,500ms statusinterval. Positive start done; video
oynatılmıyor. Tam sonraki adım group/stream/chip success kontrolü, sonra
/private/tmp/nuvio-anthlogy-positive-finish.js ile interval/wrapper cleanup ve
Homefocus restore. TV ws63574/pageF39A5FB0C116F8EE7998C0E5AF07105D; inspector92536.
Finish yapılmadan aktif probe unutulmaz. Source kod edit yok; config-only paket
kuruldu. Ajan credentialları okumadı, keyler çıktı veya MD'ye girmez.

## Kontrol noktası 33 — TMDB/Anthology onarımı ve hafif TV profili tamam

Matrix gerçek TV kaynak testi: executionCalls4, AnthologyGroups15,
AnthologyStreams26 callback toplamı; chip loading→success, tamamlandı.
Benzersiz kaynak sayısı ölçülmedi; dizi/bölüm kabulü ayrıca yapılmadı.
Probe finish interval/wrapper'ı temizledi ancak route player döndü;
manualSelection playback'i engellediği varsayımı doğru kabul edilmemeli.
Root açıkça Router.navigate('home') yaptı; final routehome/proberemovedtrue/
focusconnectedtrue/birkan marker doğrulandı. Aktif probe yok.

Player trailerAutoplay:false ek olarak kaydedildi; önceki değer backup'a eklendi.
Tam backup /private/tmp/nuvio-tv-final-settings-result.json mode0600; eski ilk
backup /private/tmp/nuvio-tv-perf-settings-result.json. Gizli değerler yok.
TMDBconfiguredtrue, heroEnabledfalse, optionalTmdbfalse doğrulandı.
Config-only paket kurulu; kaynak edit yok. Önceki39test/lint/package/buildgraph
başarılı. Ayar optimizasyonu FPS/RAM ölçümünün yerine geçmez. PATCH-01 unchanged
row markup kabulü ve REVIEW-01 ayrı açık; IPTV kapsamına geçilmedi.

## Kontrol noktası 34 — doğrulama etiketi kaldırılıyor

Kullanıcı birkan yazısını kaldırmayı istedi. Root renderAppShell.js marker
satırını sildi, AGENTS koruma kuralını güncel yetkiye göre düzeltti.
Ajan gerekmeyen tek satır UI değişikliği; diğer dirty source korundu.
Sonraki adım lint/strict package, nuvio-lg-145 close/install/launch/inspect,
marker yokluğu ve önceki TMDB/perf prefs boolean doğrulaması.

## Kontrol noktası 35 — birkan yazısı TV'den kaldırıldı

renderAppShell.js etiket satırı silindi; AGENTS yeni kullanıcı isteğine uydu.
Lint/strict package/buildgraph/diffcheck geçti. TV nuvio-lg-145'e paket
kuruldu ve açıldı. Gerçek TV markerAbsent=true/routehome; tmdbConfiguredtrue,
heroEnabledfalse/trailerAutoplayfalse/optionalTmdbfalse yeniden açılışta doğrulandı.
Inspector74440 port63785/page2A2C365E61DB42AB9E9E0C337CD894F3 geçici açık.
Aktif probe/ajan yok, credential çıktısı yok, stage/commit/push yapılmadı.
UI-01 tamam; PATCH-01/REVIEW-01 performans backlog'u ayrı devam eder.

## Kontrol noktası 32 — REVIEW-01 genel performans/bellek incelemesi

Kullanıcı subagent'larla tüm proje incelemesi istedi. Dört read-only ajan
(home/nav, player/platform/services, diğer ekranlar, core/data) tamamlandı; aktif
ajan/tool yok. Sonuç WEBOS_GENEL_INCELEME.md. Kaynak dosya değişmedi; TV ölçümü
yapılmadı, bulgular kod incelemesi düzeyinde. Root 8 bulguyu kodda doğruladı.
Önerilen ilk fix: R-01 keepAwake guard + R-02 profileScopedStore parse memo
(küçük diff, playback/Home geneli). PATCH-01 açık işi ve SRC-02 Anthology pozitif
akış kabulü hâlâ bekliyor; prefs patch'i (kontrol noktası 31) uygulanmadı.
Tam sonraki adım: kullanıcı onayıyla fix sahiplerini panoya yaz, R-01/R-02'den başla.

## Kontrol noktası 36 — hero tekrar açık (güncel kullanıcı tercihi)

Kullanıcı hero kapatılınca ızgarada üstte siyah alan kaldığını bildirdi ve geri
alınmasını istedi. TV aktif profil LayoutPreferences.set({heroSectionEnabled:true})
ile kaydedildi. Home render/odak restore sonrası heroPresenttrue/focusConnectedtrue,
markerAbsenttrue. Diğer hafif profil ayarları değiştirilmedi; paket gerekmedi.
Hero kapalı layout boşluğu düzeltilmiş sayılmaz; kullanıcı isteğiyle hero açıldı.
Inspector18901 port65321/page9C6D494FE78AB5B9FDFB68B9F48C9289 geçici.
Önceki sonradan eklenen REVIEW-01 checkpoint32'nin SRC-02/prefs bekliyor cümleleri
eskidir; checkpoint33/35 kurulum ve pozitif kabul durumları geçerlidir.

## Kontrol noktası 37 — Cavecrew Home performans adımı başladı

Kullanıcı yeni subagent/Cavecrew adımı yetkisi verdi. Root Home PATCH-01 gerçek
runtime kabulünü tamamlamayı seçti. cave_home_review Luna6/max read-only trace:
HomeDataWindow/R-05/invalidation ve unchanged-card probe kusuru. Root TVdiagnostic
ve plan sahibi; kaynak edit sınırı bulgu sonrası builder'a verilecek. Hero açık,
marker kaldırılmış; TMDB configured ve hafif profil diğer ayarları korunacak.
Mevcut dirty dosyalar baseline; credential/rawstorage/özelURL rapora girmez.

## Kontrol noktası 37 — IPTV planlama başlangıcı

Kullanıcı IPTV adımını planlamayı, bütün MD dosyalarının okunmasını ve subagent
modelinin Luna/max olmasını istedi. Root MD taraması yapıyor; iptv_plan
(gpt-6-luna/max) ataması sırada. Ajan yalnız WEBOS_IPTV_AJAN.md yazacak; kaynak
ve diğer MD dosyaları salt okunur. Root plans/2026-10-05-iptv-plani.md, plan
indexi, iş panosu ve bu checkpoint sahibi. Kirli kaynak ağacı korunur.
Bu tur yeni test/build/TV sonucu yok; aktif runtime probe/tool yok. TV-01 ve
PATCH-01 kabulü açık; IPTV uygulaması bu kabulden sonra. Güncel TV tercihi
hero açık, birkan etiketi yok, TMDB yapılandırılmış; eski giriş kayıtları tarihsel.
Tam sonraki adım: Luna kaynak/MD raporu → root kanıt kontrolü → aşamalar,
dosya sınırları, riskler ve yerel/TV kabul ölçütleriyle planı kaydet.

## Kontrol noktası 38 — PATCH-01 gerçek uygulama ölçümü tekrarlandı

Mevcut TV'de geri alınan probe ilk denemede vertical scroll changed verdi;
aynı probe sonraki iki stable tekrarda15/15 geçti. Renderer/shell/sidebar/hero/
card kimliği, focus/scroll, metadata görünürlüğü korundu; changedrowmarkup8,
unchangedrow0, hero-only0, mounted/cache24. Incoming yalnız hedefdirtyrow idi.
İlk scroll sapmasının nedeni henüz kesin değil; sürekli anchor bug diye yazılmadı.
Ajan R-05 hotpath için güvenli minimal değişikliği inceliyor. Kaynak henüz edit yok.
Probe finally metotları/payload'ı restore etti; aktif instrumentation yok.

### IPTV-01 ara kaynak kararları

Root 21 mevcut MD dosyasını okudu; Luna/max iptv_plan kaynak incelemesinde aktif.
Ayrı IPTV route/sidebar/parser yok; PlayerController live/channel tiplerini tanır.
Router currentParams history state içine girer; IPTV stream URL credential
barındırabileceğinden yalnız sourceId/channelId route sözleşmesi planlanmalı.
methods17 saveProgressIfNeeded ve methods20 flushProgress live suppression
kanıtı vermiyor; CW/watched/scrobble kapsamı uygulama öncesi denetlenecek.
HttpClient backend auth odaklı; IPTV sağlayıcılarına uygulama tokenı taşınmamalı.
Test/build/TV yapılmadı. Optional kaynak sırası sorusu pending; varsayılan M3U
önce, Xtream sonra, EPG ayrı. Sonraki adım ajan raporu ile planı birleştirmek.

## Kontrol noktası 39 — PATCH-02 minimal uygulama sınırı

Reviewer tamamlandı; builder Luna6/max homeDataWindow.js ve yeni
homeDataWindowQueries.test.mjs sahibi. Root baseline /private/tmp/
nuvio-patch02-homeDataWindow-before.js aldı (builder henüz edit yok).
Geçiş başına focused/expanded snapshot aktarımı; signature cache/early return
ve ölçüm iptali yok. Önce20sync140query baseline. Root builderdiff inceleyip
reviewer'a scoped yeniden inceleme yaptıracak; Node/lint/strictpackage/TVfixture,
install+actualsync sayımı ve PATCH01 probe sonrası teslim. Hero açık korunur.

## Kontrol noktası 33 — REVIEW-02 değişiklik incelemesi

Uncommitted perf diff'i üç Sonnet 5.5 ajanıyla gerekçe+doğruluk açısından
incelendi; sonuç WEBOS_DEGISIKLIK_INCELEMESI.md. Aktif ajan yok, kaynak değişmedi.
Must-fix: N2 Back/popstate navigationRequestId, N1a load-app.js app.bundle.js
fallback, H1a ilk sync çift render, H1b SeeAll map bayatlığı, L8/L4 küçük guard'lar.
H8 canPreloadHeroDuringVerticalScroll kaldırılması gerekçesiz; ölç veya geri al.
Tam sonraki adım: kullanıcı onayıyla N2+N1a fix, test/lint/paket, TV doğrulaması.

### IPTV-01 — eşzamanlı MD uzlaştırması

Başlangıç 21 MD'ye eklenen WEBOS_DEGISIKLIK_INCELEMESI.md,
WEBOS_HOME_SORGU_AJAN.md ve plans/2026-10-05-home-dom-sorgu-batching.md
root tarafından okundu ve Luna'ya iletildi. Checkpoint38 PATCH-01 stable
probe iki kez15/15; eski IPTV checkpoint37 açık PATCH-01 ifadesi tarihsel.
TV-01 hâlâ açık. IPTV planı yalnız doküman; başka chat PATCH-02 builder
Home kaynak/test sahibi, bu chat source edit yapmaz. REVIEW-02 lazy Back
yarışı/loader fallback IPTV route regresyon planına girdi. Yeni IPTV test/TV
sonucu yok. Tam sonraki adım Luna raporu + final plan/MD link kontrolü.

## Kontrol noktası 40 — minimal sorgu değişikliği izole TV'de geçti

Builder runtime snapshot kodunu yazdı, regression testi hazırlanıyor. Root
source baseline diff okudu; unused focusedNode context'i kaldırma önerisi ajana
iletildi. Reviewer yalnız yeni scoped diff için yeniden çalışıyor.
Root yeni HomeDataWindow ile esbuild IIFE fixture hazırladı; gerçekTV
114/114 DOM kontrolü geçti. Bu installed app kabulü değil, izole runtime fixture.
Sonraki: buildertest/freeze, reviewer sonucu, lint/strictpackage, install ve
aynı20sync sayaç + PATCH01 gerçekHomeprobe. Henüz yeni paket kurulmadı.

## Kontrol noktası 41 — PATCH-02 kaynak/test donduruldu, TV kurulum sürüyor

Builder frozen: homeDataWindow.js geçişlik numeric snapshot; yeni
homeDataWindowQueries.test.mjs. Root scoped diff ve reviewer son inceleme
sorunsuz; unusednode kaldırıldı. Home32/32, root tümilgili41/41, lint,
strictpackage/buildgraph/diffcheck geçti; isolatedTV114 önceki snapshot sürümü
aynı semantik (son yalnız unusedfield/invalidindex guard cleanup).
YeniIPK install18069 sürüyor. Sonraki launch/inspect yeniport/hash keşif,
20stationarysyncquery karşılaştırması ve installed PATCH01 probe.
Ajanlar tamamlandı. Credential veya hamstorage raporda yok, hero açık kalacak.

### IPTV-01 — kesin kullanıcı sırası

Optional soruya kullanıcı Xtream önce, M3U sonra yanıtladı. Plan artık
Xtream canlı MVP → M3U parser/import → EPG. IPTV-02 ilk API/store/transport
contract, IPTV-05 Xtream TV kabulü, IPTV-06 M3U adapter'ıdır. Root plan/table
güncelledi; Luna yalnız kendi raporundaki eski öneriyi revize ediyor. Sonraki
adım rapor revizyonu/link doğrulama; runtime uygulama hâlâ TV-01 sonrasında.

## Kontrol noktası 42 — PATCH-02 TV'ye kuruldu; sonraki geometri işi ayrı

Sorgu batching tamam, source/test frozen; iki ajan tamam. 41test/lint/strict
package/buildgraph/diffcheck geçti. Installed20sync:40query,20markup,0renderCard;
baseline140query. Hero kullanıcı tercihi açık; marker yok, TMDB key booleantrue.
Inspector14174 port50432/pageA41E9B8A01D6AF50B5DC29991E3C28FC geçici.

ActualPATCH01 coldprobe iki kez unchanged-row assertion verdi:13cache,
changed8/othercatalogrow2calls8; incomingonlytargetdirty. Daha sonra probe
başlangıçscroll2395/rows5-7 (kumanda etkileşimi olası): dirtyrow ölçümü392.1875
silinip364estimated oldu, scroll2395→2366; otherCalls0. Sorgu batching bu yola
dokunmuyor. Tüm PATCH01 kabulü kapanmadı. Reversibleprobe finally restore;
aktif sayaç/wrapper yok. Rapor WEBOS_HOME_SORGU_AJAN.md; plan home-dom-sorgu-batching.
Sonraki iş dirtyrow metadata update'in gereksiz geometry resetini ayırıp reprofix
ve kontrollüTVfocus/scroll testi. Auth/storage/sırlar loglanmadı, commit/push yok.

## IPTV-01 son kontrol noktası — plan hazır

Kullanıcı tercihi kesin Xtream önce, M3U sonra; EPG üçüncü. iptv_plan
(gpt-6-luna/max) yalnız WEBOS_IPTV_AJAN.md yazdı ve sıra revizyonunu tamamladı.
Root raporu okudu, router history, player live/progress, http auth/error ve
profile store seed/sync risklerini kaynakta karşılaştırdı. Son dosyalar:
plans/2026-10-05-iptv-plani.md, WEBOS_IPTV_AJAN.md, WEBOS_PERFORMANS_PLANI.md
index bağlantısı, WEBOS_IS_TAKIBI.md IPTV-01..08 ve bu checkpoint.

Başlangıç21 + eşzamanlı eklenen3 repo MD okundu; yeni IPTV plan/rapor da
gözden geçirildi. PATCH-01 hakkında son checkpoint38 stable15/15 iki tekrar
geçerli; eski IPTV37 açık bulgu ifadesi tarihsel. Başka chat PATCH-02 kaynak
sahibi; bu chat kaynak dosyalarını değiştirmedi. Hero açık, marker yok, TMDB
yapılandırması ve önceki kirli değişiklikler korunur. Credential/rawstorage/URL yok.

Doğrulama: IPTV MD link/sahiplik/sıra kontrolü ve diff whitespace kontrolü
geçti. Yeni Node/lint/build/paket/TV kontrolü yapılmadı; doküman doğrulaması
runtime/performans kabulü değildir. IPTV ajanı tamamlandı; aktif IPTV tool,
terminal, probe veya yeni TV bağlantısı yok. Stage/commit/push yapılmadı.

Açık risk/kararlar: seçilecek Xtream sağlayıcısının API/host/header/format
contract fixture'ı, CORS/platform transport, credential persistence seçimi,
live progress/scrobble engeli, soğuk lazy Back yarışı ve TV kaynak/bellek
bütçeleri. Bunlar kanıtlanmış uyumluluk gibi sunulmaz. İlk sürüm canlı kanal,
kategori/arama/favori/son kanal; sağlayıcı VOD/dizi, kayıt, catch-up, cloud sync
ve player zapping kapsam dışı. Yeni framework/dependency yok.

Tam sonraki adım: açık TV-01 performans kabulünü tamamla; ardından IPTV-02
kesin data ajanı ve dosya sınırını panoya yaz. Xtream source/model/store, auth'sız
provider transport ve hesap/kategori/kanal contract fixture'larını uygula;
IPTV-03 pencereli ekran ve IPTV-04 mevcut player live izolasyonu sonra gelir.
IPTV-05 gerçek Xtream TV kabulü geçince M3U (IPTV-06), sonra EPG (IPTV-07/08).

## IPTV-01 UX revizyonu — menü ve QR kurulumu

Kullanıcı IPTV menüsünü Kütüphanem'in üstünde, hesabı IPTV içinde, optional QR
ile telefondan giriş ve OK sonrası TV'ye kalıcı kayıt istedi. Modern kanal listesi
Nuvio'nun mevcut tasarım diliyle olacak. Önceki QR kapsam dışı kararı kaldırılıyor.
Root plan/pano/checkpoint, Luna/max ajan yalnız IPTV raporu QR/service read-only
incelemesi. Mevcut plugin HTTP loopback 127.0.0.1; telefon erişimi hazır değil.
Yeni ayrı kısa ömürlü kurulum listener'ı capability/TV doğrulaması ister; mevcut
media/plugin endpoint'leri LAN'a açılmaz. Runtime/test/build/TV değişikliği yok.
Son performans checkpoint42 PATCH-02 kurulu, PATCH-01 ölçüm reset/scroll kabulü
yeniden açık; eski IPTV plan girişindeki checkpoint38 durumu güncellenecek.
Tam sonraki adım kaynak incelemesi ve QR eşleşme/kayıt/cleanup + görsel UX
kabul sözleşmesini aynı timestamp IPTV planına ekle.

## Kontrol noktası 43 — upstream1.2.3 birleşimi başlıyor

Kullanıcı pull/conflict çözümü yetkisi verdi. Fetch tamam: origin/main25b984f,
HEAD358d08c;0ahead10behind.27upstreamfile, yerel Home19/24/30örtüşüyor.
Root dirty+untrackedstash yedeği alıp pull --ff-only ve stash apply ile ilerler;
stash başarı sonrası bile kurtarma için korunur. local.properties ignored0600
repo dışında kalır; gizli değer okunmaz. TV'ye kurulum bu birleşim kabulünden
önce yapılmaz. Sonraki conflict sites semanticreview ve41test/lint/package.

## Kontrol noktası 44 — upstream1.2.3 alındı, conflict yok

Root stash(includeuntracked) + pullff + stashapply başarı.49tracked+51untracked
korundu:yalnızHome19/24/30 upstreamautomerged farkı; tüm51untrackedbyteequal.
HEAD25b984f/v1.2.3, main originileeşit. Backupstash@{0} silinmedi. Configignored
var; rawcredential okunmadı. Cave_sync_review Luna6/max readonlysemanticreview
sürüyor. Root41test/lintgeçti; strictpackage59085sürüyor. Stagecommitpushyok;
TV'ye yeni kurulum yapılmadı. RaporWEBOS_UPSTREAM_BIRLESIM.md.

### IPTV UX ara teslim — QR ilk MVP kapsamına alındı

plans/2026-10-05-iptv-plani.md güncellendi: IPTV sol menü Kütüphanem üstü;
TV formu + optional telefon QR, Nuvio tasarım token'ları ve modern kanal ekranı.
IPTV-09 ayrı service/telefon/Luna akışı; IPTV-05 artık QR+Xtream TV/telefon kabulü.
QR gösterilmeden listener hazır; telefon OK sonrası mevcut TV store persist ACK
ile başarı, aktif profile/generation denetimi; TTL/cancel/single-use cleanup.
Plugin/media/proxy'nin loopback bind'i değişmez. LG resmi JS Service Basics
low-level networking ve service lifecycle için okundu; LAN erişim/taşıma desteği
gerçek TV+telefonla doğrulanacak. LAN HTTP şifreli kabul edilmez. Kullanıcının
QR isteği yeni scope yetkisi, ek TV doğrulama etiket/credential log yok.
Root yalnız plan/pano/checkpoint yazdı; iptv_plan rapor revizyonu aktif.
Tam sonraki adım Luna capability kaynak kanıtı ve plan incelemesi → MD final.

## Kontrol noktası 45 — upstream1.2.3 birleşimi tamam

HEAD25b984f/v1.2.3 originmaineşit,ahead0behind0,unmerged0. Auto-mergedHome19/24/30
root+Luna6maxCavecrewinceleme sorunsuz; additionalfix yok. Tümperformans dirty
kaynak/MD'ler korundu,stash@{0}backup saklandı.41test/lint/strictpackage/buildgraph/
pluginforwardingNode8/current/diffcheckgeçti. İlk forwarding sandboxEPERM yalnız
localhostlisten izniydi;escalatedretry geçti. space.nuvio.webos_1.2.3_all.ipk hazır.
TV'de hâlâ önceki1.2.2/perfpatch kurulu; buistekpull/conflictinceleme idi, TVkurulumu
bu tur yapılmadı. Configignoredkorundu; sırlar okunmadı. Ajancompleted, probe yok,
stagecommitpushyok. RaporWEBOS_UPSTREAM_BIRLESIM.md. Sonraki performans işinde
1.2.3base kullanılacak; PATCH01measurement ve IPTVgate backlog'u açık.

### IPTV QR rapor sınırı daraltıldı

Root QR/Luna/server kaynaklarını ve LG resmi lifecycle belgesini inceledi;
plan gereksinimleri ve yerel bağlantı/dependency kontrolü geçti. Luna'nın ek
araştırma turu root tarafından durdurulup yalnız rapor etiketi + 20–30 satır
QR appendix revizyonuna daraltıldı. Runtime/tool başarısızlığı değildir; LAN
capability hâlâ TV+telefon testi gerektiren açık koşuldur. Kaynak değişikliği yok.
Sonraki: dar Luna rapor teslimi, root final MD doğrulama/checkpoint.

## Kontrol noktası 46 —1.2.3 TV'de, tercihler korundu

Kullanıcı TV'ye gönder ve mevcutayarları koru dedi. Root hazırdoğrulanmış
space.nuvio.webos_1.2.3_all.ipk'yi nuvio-lg-145'e close/install/launch yaptı.
Success, Home/aktifprofil açıldı. SaltokunurTVcheck: TMDBconfiguredtrue,
heroEnabledtrue,CWtrue,subtitleModenative; autoplaytrailer/optionalTMDB/postPlay/
streamlogos/posterexpansionfalse; markerAbsenttrue. Storepatch/reset/uninstall
uygulanmadı. Inspector93615 port50693/page258BF3F81D4E70AD6BEED250E238C146 geçici;
settingschunkOWAM5GGM yeni. Credential/rawstorage çıktısı yok; aktifprobe yok.
SYNC01tamam; ölçümreset performansbacklog ve IPTVgate açık.

## IPTV UX/QR revizyonu son teslim

Root plans/2026-10-05-iptv-plani.md ve iş panosunu güncelledi; Luna/max
WEBOS_IPTV_AJAN.md appendix/menü revizyonunu tamamladı, root inceledi.
Kesin ürün akışı: sol menü Kütüphanem üstü IPTV → TV formu veya optional
Telefonla giriş/QR → telefonda OK → aktif profile kalıcı TV kaydı ACK →
kanal ekranı. Modern kategori/arama/favori/kanal kartları Nuvio tema/font/
sidebar/form/focus stilleriyle. QR artık scope dışı değildir; IPTV-09 ilk
Xtream kabulü IPTV-05 önkoşulu. Menü adı Canlı TV değil IPTV'dir.

Yeni çalışma yalnız MD'dir. Root kaynak/official LG JS Service Basics
incelemesini ve bağlantı/kapsam/dependency+diffcheck kontrolünü yaptı;
Node/lint/build/paket/TV çalıştırılmadı. Aktif IPTV ajan/tool/probe yok.
Root ek ajan araştırmasını dar rapor revizyonuna indirdi; agent final teslimi
planı değiştiren kritik blocker olmadığını bildirdi. LAN bind/erişim/transport/
service lifetime actual TV+telefon kabulü bekler; capability doğrulaması yok.

Tam sonraki adım: TV-01 performans gate, ardından IPTV-02 Xtream store/
transport contract + IPTV-03 Nuvio ekranı; IPTV-09 ayrı setup listener/
Luna/mobile form owner sınırlarıyla, IPTV-04 live player sonra IPTV-05
gerçek telefon ve TV kalıcılık/kumanda/oynatma/cleanup kabulü. Credential
log/history/sync yok; eski kirli kaynaklar ve diğer chat sahipleri korunur.

## Kontrol noktası 47 — Home kaydırma sapması öncelikli

6 Ekim 2026: SCROLL-01 root edit/test/TV, scroll_review read-only inceleme.
İlk kaynak kanıtı: HomeDataWindow.setRows dirtyRows için sizes/trackHeights ve
ölçülen satır yüksekliğini siliyor; metadata commit önce tahmini geometriyle
markup/window oluşturuyor, ölçüm sonraki sync'te dönüyor. Önce çağıranlar ve
geometri değişimi koşulları incelenecek; metadata ile gerçek layout değişimi
ayrılacak. Henüz kaynak edit/test/yeni TV build yok. Sonraki: minimal fix ve
ölçülü yüksekliği tahminden farklı regression; bağımsız review, lint/strict
paket/TV. Sırlar ve ham storage okunmaz; marker yeniden eklenmez.

### SCROLL-01 sahiplik güncellemesi

scroll_fix Luna/max renderer+runtime testi; scroll_nav_review Luna/max read-only
callers/Back/pagination inceleme. Root fixture/MD/build/TV entegrasyon. Önceki
scroll_review interrupted. Yeni edit/test henüz yok. Sonraki ajan fix teslimi ve
ölçülen yüksekliğin tahminden farklı DOM regression, sonra strict paket/TV.

### SCROLL-01 DOM regression hazırlığı

Root performance-data-window-check.js içine gerçek ölçüsü tahminden farklı
metadata update üç tekrar kontrolü ekledi. Henüz test koşmadı; iki Luna/max ajan
aktif. Inspector wrapper PATH hatası verdi; mevcut proje bundled CLI bağlantısı
başarılı. Sonraki fix teslim/review, fixture bundle ve TV üzerinde çalıştırma.

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

## Kontrol noktası 48 — SCROLL-01 dar TV kabulü tamam

6 Ekim 2026. İki Luna/max (scroll_fix + scroll_nav_review) tamamlandı; eski
scroll_review interrupted. Root final review,42/42Node/lint/strictpaket/buildgraph/
diffcheck başarılı. Kaynaklar homeDataWindow.js, homeDataWindowRuntime.test.mjs,
scripts/performance-data-window-check.js. Aktif plan:
plans/2026-10-06-home-kaydirma-kararliligi.md. Eski dirty kaynaklar korunur; commit yok.

TVfixture133/133 geçti; yeni final1.2.3 IPK TVye kuruldu. Installed metadata3repeat/
10sample max29px→0px height/offset/scroll/top; externalInput=false; shell/renderer/
fokus/track korundu. Sentetik10sağ10sol aynıfocus. Actual detailBack index10 aynı
item/row, main+trackdelta0, connected. Actual page40→58, nextSkip60, duplicate0,
focus/scroll/renderer korunur, inFlight0. Son durumda Home ve özgün odak geri alındı.
Settings boolean baseline aynı: aktifprofil/TMDBconfigured/hero/CW true; native
altyazı; trailer/optionalTMDB/postPlay/streamlogo/posterexpansion false; marker yok.
Temporary probe DOM ve metot/veri değişiklikleri finally temiz. Sırlar okunmadı.

Dar sapma kabulü TV doğrulandı; genel performans kabulü değil. Tek warm synthetic
handlerp9518.8ms,framep9550ms/max66.7ms,15longtask/max62ms hedefleri geçmedi;
physical remote/cold/video/long-memory/ClassicGridLibrarycollections açık. Unknown
setRows update geniş reseti bilinçli mevcut fallback; typed metadata/pagination
callers yeni korumayı kullanıyor. Full DOM-independent NAV projection hâlâ backlog.

Aktif ajan/probe/kurulum tool yok. Son Inspector forwarding tool40687 açık olabilir;
önceki8939/13343 bağlantıları da süreç olarak kalmış olabilir. Port/page/chunk
geçicidir, MDye yazılmaz; yeniden keşfet: mevcut bundled runWebOsToolsBinary ile
`ares-inspect -d nuvio-lg-145 space.nuvio.webos`. PATH wrapper ares-inspect bulamazsa
projedeki bundled CLI kullanılır. Temp test runner /private/tmp/nuvio-tv-eval.mjs ve
nuvio-scroll-*.template.js/js; bunlar son URL/chunk ile yeniden hazırlanır.

Tam sonraki adım: Home fiziksel kumanda smoke ayrı takip; kaynak edit işi LOAD-04
TmdbService.tmdbToImdb helper reuse enabled/timeout/shared signal şartlarını koruyarak
base detail ilk görünüm bariyerini LOAD-05 ile ayırmak. Önce tek edit sahibi ve dosya
sınırını panoya yaz; diğer ajan cancellation/cache read-only incelemesi yapabilir.
Sonra LOAD-06, rapor ayar/player/cache/leak, diğer layoutlar, geniş TV-01; ardından
IPTV Xtream+TV/QR account→M3U→EPG. Yeni ayar reset veya marker ekleme yok.

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
