# webOS yükleme, iptal ve bellek incelemesi

Tarih: 2026-10-05. Sorumluluk: yükleme/lifecycle incelemesi. Durum: kaynak incelemesi tamamlandı; root iş atamasıyla (mevcut kullanıcı yetkisi kapsamında; yeniden insan onayı gerekmeden) YUK-B01 eski detay rAF düzeltmesi uygulandı ve regresyon kontrolü geçti. Diğer öneriler henüz uygulanmadı. TV kurulumu, hesap değişikliği, commit veya yeni bağımlılık yok.

## Kanıt sınırı

Bu rapor çalışma ağacındaki kodu inceler; yeni FPS, heap veya ağ ölçümü içermez. Önceki TV ve DOM kontrol sonuçları `WEBOS_TEST_PLANI.md` içinde ayrı kayıtlıdır. Az sayıda aktif kart görülmesi, tutulan DOM/belleğin azalmasını veya ilk açılışın hızlandığını kanıtlamaz. Kod referansları bu inceleme anındaki satırlardır; sonraki değişikliklerde kayabilir.

## Korunacak parçalar

- `createLazyRoute` aynı import promise'ini paylaşır ve import hatasında yeniden denemeye izin verir (`js/ui/navigation/lazyRoute.js:1`). ESM modül değerlendirmesi yine ana thread'dedir; lazy import bir Worker değildir.
- Router lazy yükleme sonrası `navigationRequestId` denetimi yapar; geç gelen eski import mevcut rotayı değiştirmez (`routerMethods-02-complete-route-return-back-guard.js:104`). Ekranlar yalnız yüklenmişse gerçek ekran nesnesiyle değiştirilir.
- Build'de modern ESM/chunk yolu ve eski motor için IIFE yolu birlikte korunuyor (`scripts/build.mjs:618`). Platform uyumluluğunu değiştirmek bu çalışma için gerekli değil.
- Detay skeleton'ı yazdıktan sonra mount metadata beklemeden tamamlanır; yükleme rAF + timer sonrasında başlar (`metaDetailsScreenMethods-02-mount.js:156`). Bunu tekrar metadata bekleyen mount'a çevirmemek gerekiyor.
- Trakt yorum isteklerinde ayrı request token, detay token ve AbortController var (`metaDetailsScreenMethods-04-fetch-more-like-this.js:210`). Aynı iptal semantiği diğer route-owned işlere uygulanabilir.
- `RouteStateStore` 12 girişle sınırlı. Bu sınır global metadata önbelleklerini ve ekranın DOM'unu sınırlamaz.

## Öncelikli bulgular ve en küçük çözüm

| Kimlik | Öncelik | Kaynak ve bulgu | Çözüm / doğrulama |
| --- | --- | --- | --- |
| YUK-B01 | P1 | Detay bölüm güncellemesinin rAF callback'i `_pendingSectionsMeta` kullanıyor ancak route token denetlemiyor (`metaDetailsScreenMethods-08-render-external-ratings-row.js:231`). Cleanup bu rAF ve pending meta/focus'u iptal etmiyor (`metaDetailsScreenMethods-27-on-pointer-move.js:86`). A→B hızlı geçişte aynı detay container'ına eski meta uygulanabilir; gizli ekran da güncellenebilir. | Cleanup'ta rAF'ı iptal et, handle ve pending alanları temizle; callback'te schedule anındaki `detailLoadToken` kontrol et. Test: A update schedule → cleanup → B shell mount → eski callback; B DOM'u değişmemeli. rAF fallback timer da aynı şekilde iptal edilmeli. |
| YUK-B02 | P1 | Home render önce virtualizer `destroy()` çağırıyor (`homeScreenMethods-23-render.js:53`). Destroy tüm row/card düğümlerini geri bağlıyor (`homeRowVirtualizer.js:162`); render sonunda yeniden ölçülüp ayrılıyor (:494). `records` ve `cards` tüm DOM'u güçlü referansla tutuyor (:27,:64). | Mevcut sınıf geçici aktif-DOM pencerelemesidir. Nihai Home renderer yalnız modeldeki görünür aralığı oluşturmalı; uzak düğümleri tutmamalı. Her kart için placeholder yerine iki yatay spacer; her satır için placeholder yerine üst/alt spacer. İlk render da pencereyle başlamalı. |
| YUK-B03 | P1 | Detay temel içerik metadata, saved, resume, watched ve tüm progress/watched sonuçlarını aynı `Promise.all` ile bekliyor (`metaDetailsScreenMethods-03-load-detail.js:118`). Sonra watched projection ve ek resume sorgusu da ilk gerçek render öncesinde bekleniyor (:131,:139). Skeleton sonrası rAF bu veri bariyerini kaldırmıyor. | Metadata + eldeki preview ile temel içeriği çiz. Play/Resume/Watched eylemlerini doğrulanana kadar loading/disabled göster; kişisel state geldiğinde yalnız eylem/bölüm değişsin. Yanlış Resume düğmesi göstermemek işlevsel kabul şartı. |
| YUK-B04 | P1 | `tmdb:` kimliğin canonicalization'ı tam `fetchEnrichment` bekliyor; burada timeout veya abort yok (`metaDetailsScreenMethods-03-load-detail.js:286`). Enrichment artwork, credits, kişi adı, trailer fallback işlerini yapıyor (`tmdbMetadataServiceMethods-01-fetch-enrichment.js:41`). 4,5 saniyelik metadata timeout bu işlemin sonrasında başlıyor. | Canonicalization için mevcut ID dönüşümüne bak; gerekiyorsa yalnız external_ids isteği kullan. Kısa timeout ve route signal ekle. Tam enrichment daha sonra bağımsız çalışsın; sadece hızlı olsun diye canonical ID semantiği kaldırılmamalı. |
| YUK-B05 | P1 | Metadata ve TMDB isteklerinde route signal yok (`metaRepository.js:30,:63`, `tmdbMetadataServiceMethods-01-fetch-enrichment.js:51`). Detay timeout yardımcı fonksiyonu yalnız `Promise.race` yapıyor (`metaDetailsScreenHelpers-03-meta-with-route-external-ids.js:277`); fetch'i durdurmuyor. Token UI yazısını engeller ama ağ/parse/async closure devam edebilir. | Route-owned işlemleri cleanup'ta abort et. MetaApi zaten options taşıyor. Paylaşılan in-flight promise için tek ekranın abort'u başka tüketiciyi bozmamalı: signal'lı route isteklerini ayrı yürüt veya tüketici ayrıldığında yalnız onun beklemesini bırak; kontrolsüz shared AbortController ekleme. |
| YUK-B06 | P1 | `metaRepository.metaCache` sınırsız Map (`metaRepository.js:25,:75,:193`); aynı meta type alias'larıyla birden fazla key tutabilir. `getCachedMeta` miss'te tüm cache'i tarayabilir (:229). TMDB entityHeader/entityRail/entityBrowse/moreLikeThis Map'leri de sınırsız (`tmdbMetadataServiceHelpers-01-tmdb-base-url.js:77`). | Mevcut Map üzerinde küçük bounded LRU/TTL yaklaşımı; başlangıç önerisi meta 120 key, entityHeader 40, entityRail 80, browse 20, recommendations 40. Bunlar ölçülmüş optimum değil, TV heap testine göre ayarlanacak başlangıç limitleri. Profile/addon/settings değişiminde uygun invalidation korunmalı. Alias'lar entry sınırına dahil sayılmalı. |
| YUK-B07 | P2 | Base ve enrichment sonunda `loadTraktComments({force:true})` başlıyor (`metaDetailsScreenMethods-03-load-detail.js:186,:228`). `_force` kullanılmıyor; aynı target için mevcut istek abort edilip yeniden yapılır (`metaDetailsScreenMethods-04-fetch-more-like-this.js:215,:228`). | Target + mode + page aynıysa pending/loaded sonucunu kullan. IDs enrichment ile değişirse yeni target yükle. Kullanıcının açık refresh isteği ayrıca force uygulanmalı. Test: aynı target enrichment iki fetch üretmez; farklı target eskiyi iptal eder. |
| YUK-B08 | P2 | Detay cleanup `meta/episodes/collection/comments` temizliyor ancak `castItems`, `moreLikeThisItems`, `enrichedWatchedState`, `enrichedMovieState`, `watchedEpisodeKeys` gibi sonuçları tutuyor (`metaDetailsScreenMethods-27-on-pointer-move.js:150`). Detay container DOM'u `ScreenUtils.hide` tarafından zaten temizlenir (`js/ui/navigation/screen.js:43`); burada ek DOM leak iddiası yok. | Önce route snapshot yakalama sırasını koru; token/queued-job iptalinden sonra gereksiz sonuç referanslarını sıfırla. Snapshotların tuttuğu veriyi ayrıca hesaba kat. |
| YUK-B09 | P2 | Detay prefetch her D-pad input ve render'da 1,5 sn timer'ı yeniden planlıyor (`homeScreenMethods-19-handle-home-dpad.js:45`, methods23:495). Idle callback timeout'suz (`homeScreenMethods-10-schedule-modern-hero-update.js:22`). | Prefetch isteğe bağlıdır; hareket sırasında ertelenmesi doğru. Bu yüklemeye ilk açılış garantisi bağlanmamalı. Kullanıcı Detail seçerse aynı import doğrudan await edilmeli; mevcut lazyRoute bunu yapıyor. Idle scheduling'e ihtiyaç kanıtlanmadan yeni global scheduler ekleme. |
| YUK-B10 | P2 | Detay bölüm güncellemesi rAF ile birleştirilse de hero, episode, insight, comments ve company markup'larını her tur hazırlayıp sonra eşitlik kontrol ediyor (`metaDetailsScreenMethods-08-render-external-ratings-row.js:246-299`). | Önce mevcut RAF coalescing'i koru; güncelleme nedeninden dirty bölüm seti üret. Offscreen opsiyonel sections veri hazır olsa bile görünür/yakın veya seçili olmadıkça DOM oluşturmasın. Mevcut section mount ve episode/preview rail pencereleme yardımcılarını tekrar kullan. |

## Uygulama sırası ve bağımlılıklar

| İş | Durum | Önkoşul | Bitti kriteri |
| --- | --- | --- | --- |
| L1 / root LOAD-02: Eski detay RAF ve pending verileri temizle | Kod + regresyon geçti; TV ölçümü bekliyor | Root LOAD-02 iş ataması; yeniden insan onayı gerekmedi | Cleanup rAF/timer cancel ve pending clear; callback detay token, aktif route ve kendi frame handle'ını kontrol ediyor. Hızlı A→B/back testinde eski meta uygulanmaz. |
| L2 / root LOAD-03: Detay global/singleton cache bütçesi | Kod + regresyon geçti; TV heap ölçümü bekliyor | L1; mevcut invalidation/dedup korunuyor | Result cache entry sınırları uygulanır; güvenli cache miss/reuse ve shared pending lookup test edildi. Profile/addon invalidation eksikleri ayrı backlog. |
| L3: Canonical ID kritik yolunu küçült | Planlandı | Mevcut TMDB ID dönüşümünü incele; token testleri | `tmdb:` title'da kişi/credits/trailer istekleri ilk base paint'i bekletmez. Timeout'ta doğru fallback ve sonradan canonical update test edilir. |
| L4: İlk detay içeriğini kişisel state'den ayır | Planlandı | L1; Play/Resume davranış sözleşmesi | Yavaş progress/watched isteklerinde metadata geldikten sonra içerik görünür; doğrulanmamış Resume/Watched hatalı gösterilmez; kaydırma/odak sabit kalır. |
| L5: Route-owned iptal | Planlandı | L3/L4; shared promise sahipliği net | Detail'dan çıkınca owned fetch abort; stale callback hiçbir alanı yeniden doldurmaz; shared tüketiciler etkilenmez. |
| L6: Yorum dedup ve dirty section patch | Planlandı | L1, L4 | Aynı target gereksiz yeniden fetch edilmez; yalnız değişen section hazırlanır; input sırasında optional DOM işi ertelenir. |
| L7: Gerçek Home data→window renderer | Diğer ajan tasarımıyla bağımlı | Veri tabanlı focus cursor + layout ölçü/geometri sözleşmesi | Initial DOM, retained DOM ve pencere güncelleme işi toplam katalog sayısına bağlı büyümez; eski cached-row/card virtualizer kaldırılır. |
| L8: TV karşılaştırması | Planlandı | L1-L7 build + regresyonlar | Aynı cihaz/hesap/layout üzerinde en az 3 tekrar; script-handler, long-task, frame p95, cold/warm base detail paint, gerçek video first frame ayrı raporlanır. |

## Canonical ID için mevcut hafif yardımcı: yeniden kullanım incelemesi

Salt okunur inceleme sonucu: yeni endpoint/helper yazmaya gerek yok. `TmdbService.tmdbToImdb(tmdbId, type)` zaten mevcut (`js/core/tmdb/tmdbService.js:158`); yalnız `/{movie|tv}/{id}/external_ids` endpoint'ine gider (:174). Sonucu doğrular (:179), TMDB↔IMDb cache'lerini birlikte günceller (:182) ve aynı kimlik için in-flight istek paylaşır (:170). IMDb→TMDB değil, gereken TMDB→IMDb yönüdür. Gerçek yeniden kullanım örnekleri `js/data/repository/mdbListRepository.js:224` ve :235.

YUK-B04 / L3 için öneri: `resolveCanonicalDetailItemId` içindeki tam `TmdbMetadataService.fetchEnrichment` çağrısını `ensureTmdbId(rawItemId, itemType)` sonrasında bu hafif yardımcıyla değiştir. `tmdb:` numeric input için `ensureTmdbId` ağ isteği yapmadan ID döndürür (`tmdbService.js:107-112`). Tam artwork/credits/trailer enrichment mevcut arka plan işinde kalabilir. Bu öneri kaynak koda uygulanmadı.

Geçişte korunacak noktalar:

- Mevcut full `fetchEnrichment` TMDB ayarı kapalıysa null döndürür; `tmdbToImdb` yalnız API key kontrol eder. Aynı davranış isteniyorsa caller'ın `TmdbSettingsStore.get().enabled` gate'i korunmalı; doğrudan helper değiştirmek ayar kapalıyken yeni ağ isteği başlatabilir.
- `tmdbToImdb` şu an options/signal kabul etmiyor (:158) ve `fetchJson(url)` çağrısı sinyalsiz (:176). Sırf daha küçük endpoint kullanmak route iptali sağlamaz. İleride options geçirilecekse shared in-flight tüketici sahipliği YUK-B05 kapsamındaki kuralla korunmalı.
- Ortak `fetchJson` webOS service yolunda 10 saniye, direct fallback yolunda 60 saniye timeout kullanıyor (`tmdbService.js:7-8,:15-70`). Bu metadata ilk-paint kritik yolu için hâlâ uzun olabilir. UI bekleme bütçesi ile fiziksel fetch iptali ayrı test edilmeli; `Promise.race` fallback'i tek başına abort sayılmamalı.
- Conversion Map'leri de sınırsızdır (`tmdbService.js:10-13`); L2 cache bütçesine dahil edilecek ayrı kaynaklar. Bu inceleme yeni cache değişikliği yapmadı.

## Ölçülebilir kabul koşulları

- İlk açılışta yalnız görünür Home satır/kart aralığı + küçük overscan yaratılır. Render edilen kart sayısı 100 ve 1.000 içerikte aynı viewport için yakın sabit kalır. Uzak kartların DOM'u singleton/navigation array'de tutulmaz.
- Home'dan 20 farklı detay ve geri dönüşte odak/scroll aynı içerik kimliğine döner; kaybolan içerikte deterministik yakın fallback vardır. See All, collection, Continue Watching, Magic Remote ve Grid ayrı regresyon kapsamıdır.
- Detay cold/warm metadata paint, skeleton paint ve kişisel state ready zamanları ayrı ölçülür. Ağ hızı değişince bütün UI thread'in donduğu varsayımı yapılmaz; timeout abort ile karıştırılmaz.
- Her güncelleme kısa iş dilimleriyle yürür; başlangıç hedefi yeni render patch'lerinde tek JS görevini 50 ms altına indirmek. TV ölçümü olmadan sağlandı diye iş kapatılmaz.
- Optional bölüm yükleme/görsel decode kuyruğu D-pad hareketi sırasında büyümez; pending owned işleri route çıkışında iptal olur.
- JS modül cache'i platform tarafından tutulur; ekran import'unu geri boşaltma hedefi yok. Sınırlandırılacak olan büyük metadata, gereksiz DOM ve tekrarlanan sonuç referanslarıdır.
- Video açılışı player/network/codec ayrı aşamalarıyla ölçülür. Home sanallaştırmasının video ilk-frame gecikmesini çözdüğü iddia edilmez.

## Uygulanan YUK-B01 / root LOAD-02 doğrulaması

- `metaDetailsScreenMethods-08-render-external-ratings-row.js`: bölüm callback'i schedule token'ını, aktif `detail` rotasını ve kendi handle'ını kontrol eder. İptal edilmiş eski callback yeni B frame handle/pending verisini de temizleyemez. Normal aynı-frame çağrılar son meta'yı tek patch ile uygular.
- `metaDetailsScreenMethods-27-on-pointer-move.js`: cleanup handle'ı schedule edilen mekanizmayla iptal eder; pending meta/focus ve cancel fonksiyonunu temizler. rAF olmayan ortamdaki timer yolu için `clearTimeout` tutulur.
- `node --test js/ui/screens/detail/detailPerformance.test.mjs js/ui/screens/detail/detailSectionsPerformance.test.mjs`: 2 test geçti. Yeni test normal coalescing, A→cleanup→B yarışında stale callback'in B'ye dokunmaması, route çıkışında patch engeli ve timer fallback iptalini doğruluyor. İki değişen method dosyasının hedefli ESLint kontrolü geçti. TV kurulumu yapılmadı.

## Bağlam devri

### LOAD-03 checkpoint — sınırlı result cache

Root dosya çakışma koordinasyonu sonrası atadı. Yeni `js/core/util/boundedCache.js`, mevcut RouteStateStore LRU delete/set/oldest-entry desenini Map uyumlu olarak kullanır. `metaRepository.js` result cache 120 entry; `tmdbService.js` iki conversion result cache ayrı 120; `tmdbMetadataServiceHelpers-01-tmdb-base-url.js` header 40, rail 80, browse 20, recommendations 40. Bunlar ilk entry bütçeleri; byte/TV ölçümüyle seçilmiş optimum değildir. TTL eklenmedi: önceki sınırsız Map'lerde TTL yoktu.

`boundedCache.test.mjs` gerçek metadata/conversion çağrılarında hot result reuse, suffix lookup recency, eviction sonrası güvenli refetch, reverse conversion reuse ve concurrent pending request paylaşımını; entity cachelerde sınır ve son kullanılan entry korumasını doğruladı: **1 test geçti**. Fetch ve addon lookup testte stub; gerçek ağ/TV kullanılmadı. Shared in-flight Map, fetch signal, auth/profile/settings semantiği değişmedi. Root incelemesiyle `getCachedMeta` suffix fallback son okunan entry'yi `get` ile promote eder; loop hemen return ettiği için iterator tekrar ilerlemez ve döngü riski yoktur. Yeni utility'nin `get` işlemi entry sırasını değiştirir; aynı Map'i dolaşmaya devam ederek get kullanılacaksa key snapshot gerekir. Hedefli ESLint ve diff whitespace kontrolü geçti.

Repository/TMDB `clearCache` runtime caller'ı bu taramada bulunmadı. Mevcut clear davranışı korunuyor: aktif eski isteğin sonradan result cache'i doldurabilmesi ve metadata `clearCache` sonrası eski finally'nin aynı-key yeni pending kaydını silebilmesi önceden var olan ayrı invalidation riskleridir; bu görevde yeniden tasarlanmadı. Meta cache all-key addon/profile provenance ve TMDB conversion key settings gate farkları da değişmedi. Sonraki adım root test/lint/build entegrasyonu, sonra kontrollü TV heap/cache davranışı; bu ajan TV'ye kurmadı.

### RENDER-02/NAV-01 read-only kabul checklist'i

Bu liste window_model runtime teslimi sonrası diff review içindir; henüz bug hükmü veya tamamlandı iddiası değildir. Home kaynaklarına bu ajan edit yapmadı.

- `methods23` canlı focus yokken logical cursor'dan tekrar mount/restore etmeli; `.isConnected` veya mounted node sayısı logical focus'u sıfırlamamalı. Keyed update öncesi/sonrası eski düğüm handoff'u yalnız bir eski/yeni kart pinleyebilir, uzak prefix oluşturamaz.
- `homeVirtualRows.items[cursor.itemIndex]` logical konumdur; canonical `item.itemIndex` orijinal source position'dır. `data-window-index/navCol` logical; katalog `data-item-index`, CW `sourceIndex` ve resume lookup gerçek kaynak olmalı. Invalid source filtrelenmesi/See All son elemanı bu farkı açığa çıkaran fixture'lardır.
- `methods27.openDetailFromNode`, `methods28` OK, hold/poster options ve pointer aynı itemId/itemType/addon/collection parametrelerini tüketmeli. CW upcoming partition'ın birleşik sourceIndex'i korunmalı; `continueWatchingLoading` resume/openDetail açmamalı.
- `methods29` pagination'da mounted cards.length veya mevcut track DOM'u server offset/loaded item count sayılmamalı. Fetch sonucu row model güncellemesi yapmalı; eski appendChild/navModel.push/refreshTrack yolu Modern data renderer ile birlikte çalışmamalı. Sıfır mounted cards, açık sidebar veya offscreen row in-flight sonucu güvenle işleyecek.
- Home render ve preserved Back yolu renderer attach/bind/destroy sırasını korumalı; eski detached virtualizer Modern yolda ikinci otorite olmamalı. Cleanup queued RAF/listener/image observer ve düğüm haritalarını bırakmalı; logical veri snapshotları DOM taşımamalı.
- Loading→real katalog, CW 0→N/reorder/remove, distant focus, sidebar return, hero→first-row/up boundary, See All, collection farklı kart genişliği ve gerçek scroll extent fixture'ları ayrı kontrol edilmeli. Saf helper/test geçişi TV akıcılığı kabulü değildir.

Ara inceleme: `methods31` aynı Home token'ında renderer yenilenince eski pagination sonucu identity kontrolüyle atılıyor; global in-flight Set ise sonuç gelene kadar yeni renderer isteğini engelliyor ve finally yeni isteği planlamıyor. Bu mevcut akışta yeni-owner silme yarışı değil, dropped-page/blocked replacement riski; window_model'e bildirildi. Yeni renderer'a kopyalanan trackStates eski/snapshot rowKey'lerini yeniden ekleyebilir; rowByKey filtreleme istendi. Collection gerçek height ve sizes-map prune bulguları da window_model'e gönderildi. Kaynak/logical/CW index mapping doğru görünüyor. İnceleme sürüyor; bu bulguların çözüldüğü henüz işaretlenmedi.

Final-source ara checkpoint: Yukarıdaki pagination commit artık aynı Home token'ında güncel payload'a uygulanıyor; trackStates rowByKey filtreleme, sizes/trackHeights prune ve destructor release kaynakta mevcut. Katalog/CW/hold source index mapping son kaynakta doğru. Yeni P1 bildirildi: collection track height measured SECTION height−46 üzerinden türetilirken section yeniden ölçülüyor; iki satıra saran title başlığı ~76px olduğunda her sync track'i ~30px büyütür ve yeni RAF planlar. Kart max-height/estimate üzerinden bağımsız track height gerekir; section height bu hesapta geri beslenmemeli. window_model ve root'a wrapped-title stabilizasyon fixture önerildi. Bu ajan Home kaynaklarını değiştirmedi; final düzeltme/DOM doğrulaması bekleniyor.

### Kaynak chip tekrarları — uygulama checkpoint'i

Yeni kullanıcı bulgusunun gerçek UI nedeni: `refreshSourceChipsOnly` chip track'ini doğrudan innerHTML ile değiştirince yeni düğümler keyed updater'a kayıtlı değildi. Sonraki full render bunları runtime-owned sayıp bırakıyor, aynı chip'leri yeniden ekliyordu. `streamScreenMethods-08-build-web-os-native-player-launch-parameters.js` replacement childNodes'u mevcut helper'a kaydeder; `methods01` authoritative virtual-window row replacement aynı ownership düzeltmesini kullanır. Shared keyed helper değişmedi.

İkinci ayrı mantıksal hata `methods04.markSuccessfulSources`: bir batch'te bilinmeyen aynı kaynak adı tekrarlandığında `known` Set push sonrasında güncellenmiyordu. `known.add` eklendi. Filter ordering helper zaten adları tekilleştiriyordu; mantıksal array tekrarının tek başına görünen chip tekrarını açıklamadığı ayırt edildi. Provider identity/case veya addon ayarları değiştirilmedi.

`streamPerformance.test.mjs`: 2/2 geçti; chunk/final-only repeated names tek chip, farklı stream seçenekleri korunuyor, mevcut batch/stale producer kontrolü geçti. Hedefli ESLint ve fixture bundle build başarılı. `scripts/stream-chips-dom-check.js` actual partial/full/partial/full chain, loading→success spinner, unique source keys, filter/focus preservation kontrolü içerir. Bundle `/private/tmp/nuvio-stream-chips-dom-check.bundle.js`, global `NuvioStreamChipsDomCheck.run()`; gerçek DOM sonucu root tarafından çalıştırılacak, burada geçilmiş sayılmadı. TV kurulumu yok.

Badge hydration source markup kasıtlı boş placeholder + runtime `badgesHydrated` state kullanır. Kör registration full refresh'te çocukları silip hydrated=true bırakabilir; chip/root cause fix için bu farklı hydration yolu değiştirilmedi. Sonraki adım root gerçek DOM/TV fixture, build/package ve TV kurulum kabulü. Geçici Inspector portları yeniden keşfedilmeli; hesap bilgileri rapora yazılmadı.

Son yapılan iş: root LOAD-02 atamasıyla (mevcut kullanıcı yetkisi kapsamında; yeniden insan onayı gerekmeden) YUK-B01 stale-detail-rAF düzeltmesi; iki detay method dosyası ve `detailSectionsPerformance.test.mjs` değişti. Sonraki salt okunur incelemede canonical ID için hazır `TmdbService.tmdbToImdb` helper'ı bulundu; yukarıda gate/signal/timeout farklarıyla kaydedildi. Bulgu kimlikleri YUK-B01..YUK-B10, root iş panosundaki LOAD-* iş kimliklerinden ayrıldı. Diğer cache/canonicalization/comments kaynak kodlarına dokunulmadı. Daha büyük Home renderer değişimi diğer ajanın logical focus/model planıyla eşleşmeli. Kanıt saklanırken kullanıcı hesabı, secret backend config, token veya private addon URL bu rapora alınmadı.

### SRC-01 root cihaz kabulü

36/36 toplu Node testi, lint, webOS paketleme, build graph ve diffcheck geçti.
İzole kaynak şeridi fixture'ı gerçek TV tarayıcısında 17/17 geçti. Yeni paket
LG TV'ye kuruldu ve açıldı. Aynı film manual source flow 58 stream completed:
eski pakette iki fazla düğme/model duplicate 0; yeni pakette düğme/model
duplicate 0. Otomatik oynatma kapalı, test sonunda Home/önceki odak geri yüklendi.
