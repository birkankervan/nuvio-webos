# WIN-01 — Veriden pencere hesabı

Durum: **tamamlandı, runtime entegrasyonu bekliyor**. Bu dosya ajan `window_model` tarafından tutulur. Bu adım yeni TV sürümü veya nihai sanallaştırma değildir; mevcut `HomeRowVirtualizer` çalışmaya devam eder.

## Teslim ve doğrulama

- `js/ui/screens/home/homeVirtualWindow.js`: DOM, framework ve koleksiyon kopyası tutmayan saf `calculateHomeVirtualWindow` fonksiyonu.
- `js/ui/screens/home/homeVirtualWindow.test.mjs`: dört Node testi geçti. Geometri testi 600 farklı pencereyi gerçek öğe kesişimleri ile karşılaştırır.
- Çalıştırma: `node --test js/ui/screens/home/homeVirtualWindow.test.mjs`.
- Yeni bağımlılık, build/paket/TV kurulumu, commit veya mevcut dosyalarda değişiklik yok.

## Sabit ölçü sözleşmesi

Girdi: `{ count, stride, gap=0, offset=0, viewportExtent=0, overscan=0, focusedIndex=-1 }`. Sayısal alanlar Number olmalıdır; stringler kabul edilmez.

`stride`, iki öğenin başlangıcı arasındaki mesafedir; `gap` buna dahildir. Öğenin boyutu `stride-gap`, tüm koleksiyonun boyutu `count*stride-gap` olur. `overscan` piksel cinsindendir. Aralıkların `start` değeri dahil, `end` değeri hariçtir. Odak yalnız geçerli tam sayı indekste sabitlenir; geçersiz odak yok sayılır. Ölçüm eksik/geçersiz olduğunda tüm koleksiyon oluşturulmaz; boş pencere döner.

Çıktı: `{ offset, totalExtent, renderedCount, ranges, segments }`. Offset koleksiyon küçülmesi ve viewport boyutuna göre sınırlandırılır. Her range `{ start, end, offset, extent }` içerir. `segments`, sıralı `items` aralıkları ve `{ kind:"spacer", extent }` boşluklarından oluşur; boyut toplamı tam `totalExtent` eder. Uzak odak bir singleton aralık olarak eklenir; aradaki binlerce öğe oluşturulmaz. Çıktı boyutu viewport aralığı + tek odakla sınırlıdır, veri sayısına göre tarama yoktur.

**Kritik CSS sözleşmesi:** `segments` kapsayıcısı `gap:0` olmalıdır. Her `items` segmenti yalnız kendi içindeki kartlara `gap` uygular. Segmentler arasındaki boşluk zaten spacer'a dahildir. Kapsayıcıya ikinci kez gap uygulamak scroll boyutunu ve konumları bozar. Alternatif renderer `range.offset` ile mutlak yerleştirme kullanabilir.

Örnek: 10.000 kart, stride 100, gap 20, viewport 300 ve odak 9000 → `[0,3)` ve `[9000,9001)`; toplam dört kart. Gizli 9000 kartlık prefix yoktur. Viewport yalnız inter-item gap içindeyse görünür aralık boş olabilir; varsa odak yine korunur.

## Entegrasyon noktaları ve DOM'u bırakmayı engelleyen yerler

1. `modernHomeLayout.js/renderModernHomeLayout`: bugün tüm satır markup'larını üretir; uzak odak için `focusedItemLimit = focusedIndex+1` yaparak prefix üretir. Pencere aralıkları doğrudan veri indeksleriyle render edilmeli. See-all metaverisi üretimi kart DOM üretiminden ayrı kalmalı.
2. `homeRowVirtualizer.js`: `records.row/track/cards[].node` güçlü DOM referanslarıdır. Mevcut iki eksenli detach modeli heap'i serbest bırakmaz. Adapter yalnız bağlı pencere düğümlerini tutmalı; model veri/scroll/kimlik saklamalı.
3. `homeScreenMethods-18-focus-node.js`: `navModel.rows`, `tracks`, `rowSectionByKey`, `rowNodesByRowKey` tam DOM modelidir. `buildNavigationModel` önce tüm düğümleri restore eder. Veriden navigation model olmadan bu referanslar bırakılmaz.
4. `homeScreenMethods-19-handle-home-dpad.js`: sağ/sol/yukarı/aşağı hedefini doğrudan `nav.rows[row][col]` ile seçer. Yeni hedef mantıksal kimlik/index olacak; adapter hedefi oluşturup bağlı düğüm döndürecek.
5. `homeScreenMethods-29-setup-modern-track-scroll-pagination.js`: `cards.length` hem DOM sayısı hem veri render sınırı olarak kullanılır; append DOM ve navigation dizisini büyütür. Windowed durumda sayfalama eşiği yüklenmiş veri sayısı ve mantıksal son görünür indeks üzerinden hesaplanmalı. In-flight isteğin eski track closure'ı yeni renderer'ı beslememeli.
6. `homeScreenMethods-28-on-key-down.js`: CW append/nav dizisi de aynı değişime ihtiyaç duyar. CW ayrı kart boyutu/stride ve eylem kimliği kullanır; katalog varsayımları kopyalanmamalı.
7. `homeScreenMethods-01-get-route-state-key.js`: kaydedilen state zaten rowKey/itemIdentity/itemIndex/scroll kullanır; korunabilir. State almak bağlı düğüme muhtaç olmamalı. `lastMainFocus` ve odak poster/hero akışındaki uzun ömürlü düğüm alanları temizlenmeli.

## Ölçüm ve riskler

- İlk tüketici yatay kartlar olacak. Stride tek bağlı normal kart ve track computed `columnGap`/`gap` üzerinden, gezinme sıcak yolunun dışında ölçülmeli.
- Classic, modern portrait/landscape ve CW kart boyutları ayrı ölçüm cache anahtarlarıdır. Resize/layout değişince ölçüm geçersizleşmeli. Genişleyen odak posteri normal kart stride'ını değiştirmemeli; değiştiriyorsa renderer ayrı kompanzasyon uygulamalı.
- Bu modül değişken yükseklikli dikey CW/katalog/başlık satırlarını çözmez. Dikey adapter tahmini/ölçülen satır boyutlarını, hero dışındaki başlangıç offset'ini ve scroll anchor'ı ayrıca yönetmeli.
- RTL, track dış padding, sınır ötesi yatay overscroll önce adapter'da normalize edilmeli. Saf helper yalnız koleksiyon içi pozitif offset alır.
- Her scroll frame'de tüm veri/düğümler ölçülmemeli; tek rAF'ta birleştirilen pencere değişimi ve küçük DOM güncellemesi gerekir.
- Yeni veri geldikten sonra görünür indeksler veri sırası ile korunmalı; aynı kart kimliği taşınırsa kimlikten tekrar çözümlenmeli. Doğrudan index kalıcılığı yeterli değildir.

## Runtime kabul kontrolleri

- 10.000 kartta ilk render ve uzak odak yalnız görünür pencere + overscan + tek odağı üretir; DOM/retained detached node sayısı veri büyüklüğüne göre artmaz.
- Distant focus 9000 için 0..9000 prefix oluşturulmaz, odak ve Enter doğru içerikte kalır.
- Resize ve koleksiyon küçülmesi boş ekranda takılmaz; offset ve seçili içerik yeniden sınırlandırılır.
- Modern portrait/landscape, Classic ve CW farklı stride/gap'lerde scrollWidth hatasız; segment kapsayıcısı gap'ı çift saymaz.
- Sayfa append sonrası kalan veri sayısı doğru; tek sayfa isteği; eski load token sonucu yeni track'e DOM ekleyemez.
- Detaydan geri dönüşte rowKey/itemIdentity/scroll geri yüklenir; ilk 200 kartı yeniden oluşturma gerekmez.
- Leak kontrolünde navigation/scheduler/cache ve detached event listener'lar görünmeyen kart düğümlerini tutmaz.

## Context devri notu

Son adım: modül ve dört test oluşturuldu; testler geçti. Parent'a API ve `gap:0` sözleşmesi iletildi. Ownership yalnız bu yeni modül, testi ve bu MD'dir. **Runtime'a bağlanmadı; TV performansında artış iddia edilmemeli.** Bir sonraki iş WIN-01 çıktısını logical focus/data renderer adapter'ıyla kullanmak; yukarıdaki DOM referanslarını bırakmadan son mimari tamamlanmış sayılmaz.

## RENDER-01 — Modern veri satırları

Durum: **saf veri adapter'ı tamamlandı, runtime renderer henüz yok**. Yeni dosyalar `homeVirtualRows.js` ve `homeVirtualRows.test.mjs`. Mevcut runtime dosyaları değiştirilmedi. Dört adapter testi ve dört window testi birlikte geçti; 20×100 fixture 2.000 gerçek veri öğesini koruyor, ek sayfa sonrası uzak 200 odağı pencereyle dört kartta temsil ediliyor.

Export: `buildModernHomeVirtualRows({ rows=[], continueWatchingItems=[], upcomingItems=[], continueWatchingLoading=false, continueWatchingLoadingCount=0, continueWatchingCardStyle="card" }={}) → Array<Row>`.

`rows`, `renderModernHomeLayout` ile aynı katalog/collection kaynak dizisidir. `continueWatchingItems` ve `upcomingItems` **caller tarafından önceden partition edilmiş** olmalıdır; split_upcoming tarih sıralaması mevcut `partitionContinueWatchingRows` preprocessing'inde kalır. Adapter tarih/sıralama işini tekrar etmez ve geniş Home helper import zincirine girmez. Tek import mevcut saf `modernHomeLayout.js/buildModernRowKey` fonksiyonudur. `rowItemLimit`/CW render limitleri mantıksal veri sayısını kesmez.

Row sözleşmesi: `{ rowKey, kind, items, loadingItems, isLoading }`; katalog/collection ayrıca `{ source, sourceRowIndex }`, CW ayrıca `{ cardStyle }`. Row türleri `catalog`, `collection`, `continue`. CW row key'leri `continue_watching` ve `upcoming_section`; katalog için `homeCatalogKey` öncelikli, yoksa mevcut `buildModernRowKey`. Kaynak sırası korunur; boş kataloglar atlanır.

Canonical item: `{ itemId, itemType, videoId, season, episode, source, itemIndex, action, focusable, isLoading }`. Kimlik alanları string, `source` ham veri referansı, `itemIndex` o kaynak satır içindeki mutlak indeks. `dataset`/Node/Element alanı üretilmez. Loading veya eksik kaynağın atlanması sonraki `itemIndex` değerini değiştirmez. Navigation array indeksiyle kaynak `itemIndex` bazı mixed-loading satırlarda farklı olabilir; renderer canonical `itemIndex` üzerinden kaynak bilgisi almalıdır.

`items` yalnız gezilebilir mantıksal kartları taşır; `loadingItems` katalog skeleton'larını tutar. Katalog loading öğeleri `source.isLoading` üzerinden ayrılır, `action:null/focusable:false`; loading row'u logical focus doğal olarak atlar. Gerçek katalog kartı `openDetail`; collection folder `openCollectionFolder`, kimliği `collection:<collectionId>:<folderId>` ve ek `collectionId/folderId` alanlarıdır. Modern layout'ta olmayan synthetic See All eklenmedi.

CW kartı `resumeProgress`; `contentId`/`id` ile başlık kimliği, videoId/season/episode ile ayrı bölüm kimliği korunur. Aynı başlığın farklı bölümleri birbirine karışmaz. CW ayrıca `sourceIndex` taşır; upcoming için main dizisinin uzunluğu kadar offset içerir. Renderer mevcut `data-cw-index` eylemini bununla üretir, pencere içi sıra veya DOM çocuk indeksini kullanmaz.

CW loading mevcut uygulamadaki focusable davranışını korur: ID `__cw_loading__:<rowKey>:<index>`, type `action`, action `continueWatchingLoading`, source `null`. **Bu sentinel gerçek içerik değildir ve openDetail/resumeProgress eylemine dönüştürülemez.** Gerçek veri geldiğinde kimlik artık bulunmaz; logical focus indeks fallback'i kullanır. Count mevcut 1..10 sınırında ve varsayılan üçtür.

Kapsam dışı: Classic/Grid, hero logical row, gerçek DOM renderer, değişken collection tile ölçümleri, release-state/CW artwork normalizasyonu, TV kurulumu. Raw source intentionally yalnız referans olarak taşınır; çağıran kaynak veriye DOM nesnesi koymamalı. Başlık/poster normalization yalnız görünür kart markup'ı üretilirken mevcut renderer helpers'ında yapılabilir.

Son devir: **RENDER-01 yalnız veri adapter'ı**; modern markup/Nav model adapter'a henüz bağlanmadı. Test komutu: `node --test js/ui/screens/home/homeVirtualRows.test.mjs js/ui/screens/home/homeVirtualWindow.test.mjs`. Bir sonraki renderer gerçek pencere aralıklarının canonical items'ını render etmeli ve CW sourceIndex/collection action/loading separation sözleşmelerini korumalı.

### RENDER-01 kabul incelemesi sonrası kimlik guard'ı

Parent incelemesi doğrulandı: önceki adapter boş katalog ID'sini veya eksik collection alanlarını navigable hedef olarak bırakabiliyordu. `normalizeCollectionFolderItem` gibi collectionId/folderId/title alanları zorunlu; adapter artık geçersiz folder'ı `openDetail`'e düşürmez. Boş/nesne/boolean kimlik, eksik folder/title ve geçersiz CW kimliği **discard edilir**; skeleton alanına taşınmaz. Gerçek loading placeholders yine `loadingItems` olarak korunur. String ve sonlu sayısal ID'ler geçerlidir; `tv` ve `channel` metaveri tipleri korunur, yalnız movie/series ile sınırlandırılmaz.

Bu filtrelerden dolayı renderer `.items[logicalIndex].source` ve `.items[logicalIndex].itemIndex` kullanmalıdır; `logicalIndex` doğrudan kaynak indeksine çevrilemez. Kural modül yorumunda da açıklandı. Beş adapter + dört window testi (toplam dokuz) geçti; yeni test tv/channel, boş/nesne ID, bozuk collection, geçerli gizli başlıklı folder ve invalid CW kaynaklarını kapsar. Mevcut runtime helper bu malformed veride fallback davranışı gösterebilir; nihai renderer yanlış içerik route'u açmamak için yeni adapter guard'ını korumalıdır.

## RENDER-02 / NAV-01 — Modern runtime entegrasyonu checkpoint

Kaynak entegrasyonu uygulandı; installed uygulama veya bütün TV senaryoları henüz kabul edilmedi. Sahip `window_model`; root build/paket/TV kabulünü yürütür. Yeni dosyalar `homeDataWindow.js`, `homeScreenMethods-31-data-window.js`, `homeDataWindowRuntime.test.mjs`. Home methods01/02/05/06/13/15/18/19/20/23/28/29/30 ve homeScreen.js/modernHomeLayout.js entegrasyonu aynı sahibin değişiklikleridir.

- `HomeDataWindow` yalnız görünür satır/kart markup'ı üretir; distant logical focus tek ek pin. Absolute row/card koordinatları sayısal extent içinde konumlanır; DOM spacer veya detached card cache yok. Section ledger değişken yüksekliği, collection yatay ledger farklı tile genişliklerini ölçer. İlk ölçüm yalnız bağlı normal kartlarla kalibre edilir.
- `modernHomeLayout.virtualRowsMarkup` full card/CW üretimini atlar; katalog see-all metadata haritası korunur. Modern browser ve TV aynı data path'i kullanır. Classic/Grid önceki renderer/nav path'inde kalır; Classic cached detach fallback değiştirilmedi.
- Modern D-pad `renderer.rows/focus` üzerinden hareket eder; canonical `itemIndex` kaynak pozisyonu, cursor `itemIndex` logical array pozisyonudur. Back, sidebar return, CW/collection hold restore ve hero source dönüşümleri bu ayrımı kullanır.
- `navModel` **yalnız mounted-view compatibility projeksiyonu** olarak kalır: geometry landing, sidebar ve görsel helper'lar bağlı düğümleri kullanır. Modern D-pad/pagination/snapshot otoritesi değildir. NAV-01'de bu compatibility projection'ın tamamen DOM bağımsız arayüze taşınması halen ayrı iş olarak raporlanmalıdır.
- CW append ve eski catalog DOM append yolu Modern data path'inde devre dışıdır; loaded veri sayısı üzerinden idle pagination yapar. Aynı route render değişince sonuç mevcut row payload'a uygulanır; departure token sonucu atar. Sayısal scroll/size cache removed row keys'i geri eklemez.
- Background katalog geldikçe shell render hâlâ yapılabilir; bounded markup üretir ancak tüm shell commit'ini row dirty update'e çevirmek PATCH-01'in sonraki işidir. Data adapter sadece data arrival'da kurulur; key/scroll başına tüm item listesini yeniden map etmez.
- Mounted maps/track listeners, lazy image pending queue/index ve eski focus refs window değişiminde prune edilir. Cleanup renderer frame/listener/maps/data/callback refs'i serbest bırakır; preserved Home dönüşünde yalnız bounded markup yeniden kurulur. `birkan`, auth/addon/player davranışına dokunulmadı.
- Expanded poster genişliği yalnız görünür kart konumlarına ekstra boy olarak yansır; mevcut 180ms CSS geçişi boyunca sınırlı 220ms window sync yapılır. Collection folder expansion mevcut davranışla kapalıdır.

Root gerçek TV tarayıcısında class fixture'ını 59/59 geçirdi: 20×100 başlangıçta iki satır/sekiz kart; uzak row17/item200 sparse pin, Back/scroll/remove/cleanup doğrulandı. **Bu installed full Home kabulü değildir.** Root/focus_model daha sonra wrapped collection header/heterojen tile fixture'ı genişletiyor.

İlk fixture failure'ları kaydedildi ve düzeltildi: Back Map restored değerini eski live track capture üzerine yazıyordu (restore önce live track'e uygulanır); removed rowKey eski track handler capture ile numeric map'e geri giriyordu (current-row-key guard). Review collection P1: measured sectionHeight-46 tekrar trackheight yapıldığında wrapped header her rAF'ta büyüyordu; trackheight card kaynaklı bağımsız numeric ledger'a alındı, header ölçümü yalnız vertical offsets'i etkiler.

Üç gerçek Home factory Node testi geçti: ilk markup kart bütçesi + logical/source mismatch + size/state prune; Modern D-pad'in eski mounted nav sırasından bağımsızlığı; pagination renderer replacement/current payload + departed token. `npm run lint:home:incremental` başarılı. Sonraki tam adım root'un güncel fixture/Node/lint/package kontrolleri ve installed uygulamada gerçek input/return/skeleton/pagination/expansion kontrolleridir. TV'ye bu ajan kurulum yapmadı.

Son source checkpoint: root genişletilmiş class fixture'ını **TV tarayıcısında 77/77**, eski DOM harness'ını **21/21** geçirdi; wrapped collection header/trackheight ve sürekli rAF olmaması doğrulandı. Root toplu Node kontrolü **35/35** geçti. Source owner teslim/freeze yaptı; root lint/paket ve kurulu uygulama kabulüne geçebilir. Açık sınırlar: geometry helpers için mounted nav projeksiyonu ve PATCH-01 shell commit daraltması, Classic/Grid gerçek veri renderer geçişi, installed runtime performans/kumanda kabulü. Bunlar tamamlandı diye sunulmaz.
