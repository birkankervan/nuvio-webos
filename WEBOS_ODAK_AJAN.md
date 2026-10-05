# Mantıksal Home odağı — FOC-01

Güncelleme: 5 Ekim 2026. Sahip: focus_model ajanı. Durum: saf veri adapter'ı ve testleri tamamlandı; **çalışan Home akışına bağlanmadı**. TV'ye kurulmadı; uygulamanın kumanda davranışını henüz değiştirmez.

## Amaç ve tamamlanan iş

`js/ui/screens/home/homeLogicalFocus.js` odak kararını DOM'dan ayırır. `resolveHomeLogicalFocus` veriye göre mevcut odağı onarır; `moveHomeLogicalFocus` yatay/dikey hedef veya sınır kararı döndürür. DOM, framework, ağ ve global uygulama durumuna erişmez. Mevcut `homeFocusPolicy.js` kimlik normalizer'ı yeniden kullanılır.

`homeLogicalFocus.test.mjs` içindeki üç test geçti. İncelenen durumlar: 250 öğeli satırda 200. indeks ve sonraki öğe, yeniden sıralamada kimlikle koruma, silinmede indeks sınırlama, boş/silinen satırlar, satır başına tercih edilen sütun, yatay/dikey sınırlar, aynı serinin farklı CW bölümleri, Classic hero ve see-all eylemi. Yeni JS dosyasının ESLint kontrolü geçti.

## Giriş ve çıkış sözleşmesi

Her satırın benzersiz, kararlı `rowKey` değeri ve **yalnız görünür pencereyi değil bütün gezinilebilir öğeleri** içeren `items` dizisi vardır. Öğeler birer kimlik kaydıdır; DOM düğümü veya ham metadata değildir:

```js
const rows = [
  { rowKey: "continue_watching", kind: "continue", items: [
    { itemId: "tt-series", itemType: "series", videoId: "tt-series:1:2", season: "1", episode: "2" }
  ] },
  { rowKey: "addon:movie:popular", kind: "catalog", items: [
    { itemId: "tt-movie", itemType: "movie" },
    { itemId: "__see_all__:addon:movie:popular", itemType: "action" }
  ] }
];
const state = {
  rowKey: "addon:movie:popular", rowIndex: 1, itemIndex: 0,
  itemIdentity: { itemId: "tt-movie", itemType: "movie" },
  preferredItemIndexByRowKey: { continue_watching: 0 }
};
```

Normalizasyon ekran veri adapter'ına aittir. Catalog: poster renderer'ın normalize ettiği `id` ve `type`/satır türü → `itemId`/`itemType`. CW: `normalizeContinueWatchingItem` çıktısındaki `contentId`, `type`, `videoId`, `season`, `episode` kullanılır. Kaynak satırın `media.type` benzeri alanları varsa mevcut poster normalizer'ı esas alınır; yalnız ham `item.id` eşlemek yeterli değildir. Koleksiyon klasörünün `itemType` değeri `collection_folder` kalır.

See-all gerçek bir navigable eylemdir ve sentetik kimlikle son öğeye eklenir. Loading placeholder'ların focusable olup olmadığı render davranışıyla tutarlı belirlenmelidir; sessizce çıkarılması mevcut ilk odak/skeleton davranışını değiştirir. Adapter ham içerik kayıtlarını veya eylem payload'larını saklamaz; bunlar veri modelinde kalır.

Sonuç: `{rowKey,rowIndex,itemIndex,itemIdentity,preferredItemIndexByRowKey}`. Hareket ayrıca `{boundary:null|'left'|'right'|'top'|'bottom',action:null|'rotateHero'}` döndürür. Hero yatay hareketinde `delta` -1/+1 olur. Boş bütün veri için `null` döner. Sağ sınırda sayfalama, sol sınırda sidebar ekranın işidir; adapter otomatik döngü veya ağ isteği başlatmaz.

Mevcut tercih korunur: yukarı/aşağıda hedef satırın hatırlanan indeksi, yoksa 0 seçilir; mevcut sütun otomatik kopyalanmaz. Boş satırlar atlanır. Kaybolan satır eski `rowIndex` yakınındaki sonraki dolu satıra, yoksa önceki dolu satıra düşer. Kaybolan öğe indeksi satır uzunluğuna sınırlanır. Başka satırlarda aynı içerik bulunması odağı başka satıra taşımaz. Kullanımdan çıkan satırların tercih kayıtları temizlenir.

Modern hero dekoratiftir; navigasyon satırlarına **eklenmez**. Classic hero tek öğeli `kind:'hero'`, `rowKey:'__hero__'` satırıdır. Grid mevcut DOM `offsetTop` gruplaması yerine hesaplanmış görsel alt satırlar ister; her alt satır benzersiz kararlı anahtar taşımalıdır. Bu dosya Grid sütun hesabı yapmaz.

## Mevcut DOM bağımlılıkları ve geçiş sırası

| Nokta | Mevcut bağımlılık | Gereken değişim |
| --- | --- | --- |
| methods-18 `buildNavigationModel` | Bütün `.focusable` kartları tarar; `rows`, `rowNodesByRowKey`, `lastMainFocus` DOM tutar; eski virtualizer `restore()` ile bütün düğümleri geçici bağlar | Veri adapter'ından mantıksal satırları oluştur. DOM haritası yalnız mounted pencereyi gösteren ikincil görünüm olsun; otorite olmasın |
| methods-19 `handleHomeDpad` | `dataset.navRow/navCol` ile `nav.rows[row][col]` seçer | Mantıksal hareket → pencereyi hedef indeks etrafında oluştur → mounted hedefi bul → mevcut focus effects uygula |
| methods-05 | `rememberMainRowFocus`, `resolvePreferredNodeForRow`, `getNavigationRowNodes`, `currentFocusedNode` | Tercih/odak kayıtlarını mantıksal state'e taşı; DOM getter'ları yalnız mevcut pencere için kullan |
| methods-01/02 | Back state yakalama `.isConnected` ister; restore DOM'da identity arar | Mantıksal state + scroll/pencere bilgisi sakla. Önce identity ile veride çöz, sonra pencere oluştur ve DOM'a odak ver |
| methods-06 | Hero kaynağı, bekleyen CW/menu dönüşü DOM satırından hedef bulur | Aynı logical identity üzerinden kaynak veri ve eylem payload'ını bul |
| methods-15 | Sidebar dönüşünde `lastMainFocus` DOM referansı kullanır | Son content logical state'i koru; sidebar kapanırken pencereyi oluştur |
| methods-16/17 | Wheel/fast-scroll landing görünür DOM `getBoundingClientRect` tarar | Satır ölçüm modelinden hedef satırı bul, önce render et. Çizilen hedefin geometri doğrulaması kalabilir |
| methods-28 | CW render-ahead DOM kart sayısı hesaplar, `nav.rows` dizisine append eder | CW veri uzunluğu/yüklenmiş sayfa ve window indeksleri esas olsun; yeni veri odağı kimlikle korusun |
| methods-29 | Catalog pagination DOM sayısı, track handler ve append üzerinden yürür | `loadedCount/hasMore/nextSkip` veri alanlarına bağla. İstek token'ı korunur; append yerine pencere güncellenir |
| methods-07/08/09 | Hold menu, watched/remove işlem dönüşü DOM node'u veya satır/indeks saklar | Item identity + rowKey sakla; silinen içerikten sonra logical fallback uygula |
| `homeRowVirtualizer` | Detached satır/kart DOM'u bellekte saklar | Yalnız sayısal ölçümler, veri state'i ve mounted DOM tut. Uzak kartlar için DOM referansı bırakma |

Önerilen sıralama: (1) canonical veri satırları, (2) renderer'ın hedef logical focus indeksini oluşturması, (3) D-pad ve capture/restore bağlantısı, (4) CW/catalog pagination'ın veri esasına geçmesi, (5) sidebar/hold/wheel/fast-scroll ve Grid migrasyonu, (6) eski DOM cache yolunun kaldırılması. İki farklı authoritative odak modeli aynı anda kalmamalı; geçişte eski alanlar yalnız compatibility projection olmalı.

CW `partitionContinueWatchingRows` davranışı korunmalı: `split_upcoming` kipinde `isNextUp && hasAired===false` öğeler `upcoming_section` satırına ayrılır ve release zamanıyla sıralanır; diğerleri `continue_watching` içinde kalır. Hareket öncesi sıralama yapan normalizasyon tekrar tekrar çalışmamalı; veri değişiminde model yenilenmeli.

## TV kabul kontrolleri ve açık işler

- Modern ve Classic: 200. karta kadar gezin, detay aç, Back ile aynı içerik ve scroll konumuna dön; sıraya yeni katalog sayfası eklense de kimlik korunsun.
- CW: aynı serinin farklı bölümleri doğru ayrışsın; split-upcoming geçişi, watched/remove, hold menü dönüşü ve boşalan satır kontrol edilsin.
- Sol uç sidebar, sidebar'dan dönüş, sağ uç pagination, son öğe see-all; ağ sonucu geldiğinde odak kendiliğinden başka öğeye atlamasın.
- Magic Remote pointer/wheel, uzun up/down basışında fast scroll, hero güncellemesi ve poster expansion sırasında hedef DOM kaldırılmasın.
- Grid sütun sayısı değişiminde mantıksal içerik kimliği korunsun; Classic hero sağ/sol rotasyonu ve aşağı geçişi çalışsın.
- Profillemede `navModel`, eski node cache, event handler/closure ve route snapshot'ların uzak kart DOM'unu tutmadığı heap üzerinden doğrulansın. Saf adapter testleri bellek/FPS iyileşmesi kanıtı değildir.

FOC-01 altyapısı tamamlandı. Yukarıdaki runtime bağlantıları, gerçek TV regresyonu ve performans ölçümleri **açık**. Ajan yalnız yeni logical-focus dosyaları ile bu raporu değiştirdi; mevcut runtime, deployment, Git index ve hesap verisi değiştirilmedi.

## Context devir notu

Yeniden başlarken bu raporun giriş sözleşmesi ve DOM tablosu okunmalı. Önemli kararlar: Modern hero dekoratif; Classic hero focusable. Vertical hedef yeni satırda 0, hatırlanan satırda kendi eski sütunu. CW kimliği title id'den ibaret değil, video/season/episode dahil. See-all synthetic action. Model tüm öğeleri içerir; visible DOM modeli authoritative değildir. Test komutu: `node --test js/ui/screens/home/homeLogicalFocus.test.mjs`. Entegrasyonun henüz yapılmadığını ve TV'ye kurulmadığını koru.

## MEASURE-01 — değişken satır yüksekliği ledger'ı

İkinci bağımsız altyapı işi tamamlandı: `homeRowMetrics.js` içindeki `HomeRowMetrics` yalnız rowKey, sayısal tahmin/ölçüm, indeks ve prefix offset tutar. DOM düğümü, observer, handler veya kullanıcı callback'i saklamaz. Dört yeni test ile dosya ESLint kontrolü geçti. **Runtime'a bağlı değildir; TV'ye kurulmadı.**

```js
const metrics = new HomeRowMetrics({ gap: 24, layoutKey: "modern:1920:landscape" });
metrics.setRows([
  { rowKey: "continue_watching", estimatedHeight: 300 },
  { rowKey: "addon:movie:popular", estimatedHeight: 440 }
]);
metrics.setMeasuredHeight("continue_watching", 312);
const view = metrics.getWindow({
  offset: 0, viewportExtent: 800, overscan: 300,
  focusedRowKey: "addon:movie:popular"
});
```

`setRows(rows,{gap?,layoutKey?})` yeniden sıralamada aynı anahtarın ölçümünü korur; silinen anahtarların ölçümünü atar. `layoutKey` değişimi veya açık `resetMeasurements()` bütün ölçümleri sıfırlar. Layout anahtarı ölçüyü değiştiren kip, viewport genişliği ve poster tercihini içermelidir. Row height, başlık dahil bölüm yüksekliğidir; `gap` bölümler arasındaki tek ortak aralıktır ve height içine iki kez dahil edilmez. Farklı bölümlerin farklı boşluğu gerekiyorsa caller'ın bölüm yüksekliğine dahil ederek ortak gap'ı 0 seçmesi gerekir.

`setMeasuredHeight` ölçümleri toplar; prefix yalnız `getWindow`/`getRowMetrics` sorgusunda kirliyse yeniden hesaplanır. Bir frame'deki bütün ölçümleri önce yazıp sonra tek pencere sorgusu yapılmalı; her ölçüm sonrasında ayrı sorgu yapılmamalıdır. `getRowMetrics(rowKey)` mevcut satırın `{index,offset,height}` kaydını verir; silinen anahtar için `null` döner.

`getWindow` çıktısı `homeVirtualWindow` ile aynı `{offset,totalExtent,renderedCount,ranges,segments}` sözleşmesini kullanır. Range end exclusive'dir; items segment `{start,end,offset,extent}`, spacer segment `{kind:'spacer',extent}` biçimindedir. Segment parent gap:0 olmalı; ortak satır gap'ı sadece items segmentinin içindeki satırlar arasına uygulanır. Uzak odak ayrı tek satırlık range ekler; aradaki bütün satırların DOM'unu istemez. Visible intersection için prefix üzerinde ikili arama yapılır; yalnız kesişen data indeksleri işlenir.

Negatif/NaN/sonsuz tahmin ve pencere boyutları 0'a indirgenir. Geçersiz veya negatif measured height reddedilir; 0 gerçek bir collapsed ölçüm kabul edilir ve o satır render range'ine eklenmez. Anahtarsız/tekrarlanan satırlar atlanır; sıfır veri ve toplam extent overflow'u boş pencere verir. Ölçüm map'i mevcut satır kümesiyle sınırlıdır.

Kontroller: değişken CW/catalog yüksekliği ve exact toplam gap, viewport tamamen gap içinde, overscan, batch sonrası tek lazy prefix, reorder/shrink/delete, layout reset, 10.000 satırda uzak 9.000. satır odağı için yalnız 4 render satırı, zero/invalid/overflow, çeşitli offsetlerde brute-force intersection karşılaştırması. Test komutu: `node --test js/ui/screens/home/homeRowMetrics.test.mjs`.

Sonraki bağlantı: veri satırlarını metrics'e geçir → renderer yalnız items segmentlerini oluşturup spacer extent'lerini uygulasın → çizilen satırların ölçümlerini frame içinde toplasın → logical focus hedefini pinlesin → scroll/fast-scroll landing sayısal row offsetlerini kullansın. Mevcut DOM saklayan virtualizer'a eklemek yerine onun yerini alacak renderer'a bağlanmalıdır. Kalıcı pointer/wheel/Back durumunu henüz kendisi yönetmez. Bir batch measure sonrasında scroll anchor korunması runtime ekran işidir.

## NAV-01 read-only çağıran haritası — checkpoint 5 sonrası

Modern runtime migrasyonundan **önceki** kaynak konumlarıdır; renderer sahibi window_model'e iletildi. Bu incelemede mevcut JS dosyası değiştirilmedi.

- `homeScreenMethods-19-handle-home-dpad.js:95` — `nav.rows[row][col]` yetkili hedef. Mounted slice indeksleri mutlak logical `navCol` değildir; sparse array oluşturmak da detached bütün düğümleri tutan eski modelin devamı olmamalı.
- `homeScreenMethods-01-get-route-state-key.js:153,202` ve `homeScreenMethods-02-restore-modern-focus-state.js:35` — CW return ve Back `cards[state.itemIndex]` lookup. Önce full logical row'da identity çöz, hedef window'u oluştur, mounted node bul.
- `homeScreenMethods-06-get-hero-source-from-focus-state.js:25,34` — hero kaynak lookup eski raw source indeksini kullanır. Canonical `row.items[cursor.itemIndex].source/itemIndex` üzerinden eşle; filtered malformed kayıtlar iki indeksi ayırır.
- `homeScreenMethods-15-schedule-focused-poster-flow.js:205,213` — sidebar dönüş `lastMainFocus` DOM ref'i ve ilk-kart fallback. Logical content cursor korunmalı; reselection `:221` ise bilinçli başlangıca dönüş kararıdır.
- `homeScreenMethods-19-handle-home-dpad.js:148,192` — delegated focusin ve pointer hover programatik D-pad dışından odak değiştirir. `setFocusedNode` ve delegated focusin logical cursor'ı da güncellemeli; expanded sidebar hover kilidi korunmalı.
- `homeScreenMethods-16-get-modern-main-aligned-scroll-target.js:222` ve `homeScreenMethods-17-end-modern-vertical-fast-scroll.js:110` — wheel/fast-scroll landing yalnız mounted DOM geometri tarar. Scroll rAF önce pencereyi güncellesin; uzak focused pin viewport landing'i kilitlemesin.
- `homeScreenMethods-07-mount-continue-watching-dialog.js:258,295` — poster menu `index` raw source, CW menu `index` logical column. Bunları aynı indeks sayma. `homeScreenMethods-06-get-hero-source-from-focus-state.js:222,244` — hold restore önce logical resolve+mount gerektirir; yalnız mounted kartları araması yanlış hedef/sessiz odak kaybı üretir.
- `homeScreenMethods-09-toggle-continue-watching-watched.js:110,131` — CW remove sonrası eski logical anchor bir sonraki kalan öğeye clamp edilir; aynı title'ın birden fazla bölümü title/video kimliğiyle ayrışmalı.
- `homeScreenMethods-23-render.js:122,396` — pending poster kaynak indeksi restore cursor'ına yazılıyor; pending CW indeksinde mounted slice'a doğrudan erişiliyor. Renderer bridge bu pending state'i identity/source eşlemesiyle dönüştürmeli.
- `homeScreenMethods-06-get-hero-source-from-focus-state.js:185` — hold scroll snapshot yalnız mounted track'leri toplar. Numeric virtual trackStates ile merge gerekir; uzak row mount edilmeden de eski scroll konumu saklanmalı.
- `homeScreenMethods-28-on-key-down.js:199,253` — CW progressive append DOM kart sayısını veri uzunluğu sanır. `homeScreenMethods-29-setup-modern-track-scroll-pagination.js:41,97,253` — catalog append/nav push ve pagination aynı bağımlılığı taşır. New runtime bunları bypass edip loadedCount/nextSkip ve window refresh kullanmalı; near-right-end repeated input isteklerini dedup etmeli.

Güncel adapter notu: `homeVirtualRows.js` Modern davranışını koruyarak **see-all eklemez**. Önceki sözleşmedeki synthetic see-all örneği genel navigasyon kapasitesidir; Modern'a yeni eylem eklenmesi anlamına gelmez. Loading catalog kartları navigasyon dışı, synthetic CW loading kartı ise eski focusable semantiğini korur; Enter bu kartı detail/player'a göndermemeli.

Runtime kabul fixture hedefleri: Modern 20×100 kayıtta ilk paint yalnız pencere markup'ı; uzak row ve item200 Back restore; not-mounted hedefe D-pad; focus pin tek ayrı segment, prefix DOM yok; pagination mountedCount değil logical loadedCount; malformed kaynakta doğru hero/menu içerik; parent gap:0 ve exact extent; cleanup mounted map + image queue + observer + stale rAF temizliği. Ayrı regresyonlar: sidebar dönüş/reselect, hover/focusin, hold close/remove, CW split/loading Enter, wheel ve uzun vertical repeat. Bunlar henüz çalıştırılmadı; browser fixture dosya sahipliği root atamasıyla netleşecek.

### Browser fixture görevi — API bekleniyor

Root `scripts/performance-data-window-check.js` yeni dosyasını focus_model'e atadı. Mevcut `performance-dom-check.js` değişmeyecek; Home runtime edit sahibi window_model. Yeni renderer export/constructor/update/focus/cleanup API'si doğrudan o ajandan istendi.

Fixture planı: gerçek document içinde izole 320×240 viewport, sabit test kart CSS'i ve farklı CW/catalog satır yükseklikleri; 20×100 veri ile ilk markup callback sayısı ve mounted bütçe; tek uzun satırda item200 ve uzak satır odağı; gap:0 spacer exact scroll boyutu; viewport ve track scroll; row/item removal + reorder; destroy sonrası mounted map/DOM ve planlı frame temizliği. Async frame kontrolü en az iki rAF bekler; finally renderer/root'u kaldırıp eski aktif DOM odağını geri verir. İçerik/hesap/network değiştirilmez. API gelmeden varsayılan yöntem adlarıyla kod yazılmayacak. Gerçek browser/TV çalıştırma root'a ait; testin varlığı başarı kanıtı sayılmaz.

### Browser fixture teslimi

`HomeDataWindow` API window_model tarafından teyit edildi. `scripts/performance-data-window-check.js` artık async `run()` export eder; **900×560** izole viewport kullanır (önceki 320×240 taslak değişti). CSS yalnız `.nuvio-data-window-fixture` altında kalır. İlk 20×100 data'nın render callback/mounted bütçesi, uzak row17/item200 prefix yokluğu, actual focus korunması, horizontal/vertical scroll ve loaded250 extent, Back restore requested-track-state overwrite regresyonu, reorder source201→logical48 ayrımı, row removal/numeric cleanup, değişken CW282/catalog364 yüksekliği+24gap ve destroy sonrası iki-frame kontrolü var. Focus ve DOM finally temizlenir; hesabı/ağı kullanmaz.

Node syntax kontrolü ve esbuild IIFE bundle **başarılı**. Gerçek DOM/browser/TV run **bekliyor**, başarılı iddiası yok. Root çalıştırma örneği: esbuild ile `--bundle --format=iife --global-name=NuvioDataWindowCheck` çıktı üret, Inspector'da bundle'ı değerlendir ve `await NuvioDataWindowCheck.run()` sonucunu al. HomeDataWindow API/source değişirse aynı bundle yeniden üretilmeli; eski bundle'a güvenme. Fixture eski cached-DOM harness dosyasını değiştirmez.

### Gerçek TV DOM sonucu — başarısız kontrol kaydı

Root izole fixture'ı gerçek TV tarayıcısında çalıştırdı. İlk başarısız assertion: **`Back requested scroll was overwritten by previous mounted track state`**. Source owner window_model düzeltme için bilgilendirildi. Syntax/bundle başarısı bu runtime kontrolünün geçtiği anlamına gelmez; tam fixture kabulü açık. Sorun: desired numeric restore trackState yazıldıktan sonra sync eski canlı scrollLeft'i capture edip üzerine yazabiliyor. Fix sonrası root IIFE'yi yeniden üretip aynı fixture'ı tekrar çalıştıracak. Geçici bundle stale; testin beklentisi gevşetilmeyecek. Fixture finally DOM/style kaldırıp önceki focus'u restore eder.

İkinci TV çalıştırmasında Back restore kontrolü geçti. Yeni başarısız assertion: **`removed row retained numeric state`**. Root'un izlediği neden: setRows silinen rowKey state'ini prune eder, fakat sync eski mounted track'i capture edip silinen anahtarı yeniden ekler. Owner window_model bilgilendirildi. Removed key için capture guard gerekir; cleanup beklentisi korunuyor. Tam fixture kabulü yine açık; source fix sonrası root yeniden bundle/run yapacak.

### Son fixture kabulü

Root güncel source'u yeniden bundle edip gerçek TV tarayıcısında izole çalıştırdı: **59/59 kontrol başarılı**. İlk 20×100 veri için markup callback **8** kez çağrıldı; **2 satır / 8 kart** mounted. Uzak pin'de yalnız `row-0`, `row-1`, `row-17` vardı; ara prefix DOM oluşmadı. Toplam vertical extent **7736 px**. Item200, Back scroll restore, reorder/source-logical ayrımı, row removal, değişken CW yüksekliği ve destroy/frame kontrolleri geçti.

Bu sonuç gerçek browser'da **izole renderer kabulüdür**; installed uygulama Home/D-pad/hold/pagination runtime smoke veya genel TV FPS kabulü değildir. Root installed runtime smoke henüz yapmadı. Karışık collection shape/satır-height fixture genişletmesi ayrıca atanabilir; mevcut 59 kontrol bu semantiği kapsamıyor. Başarısız ilk iki koşu yukarıda hata nedenleriyle tutuldu; son source düzeltmeleri window_model'e ait.

### Collection wrapped-header regresyon fixture'ı

Root yeni scope verdi: collection track yüksekliğinin ölçülmüş section yüksekliğinden sabit 46 çıkarması, gerçek wrapped header 76.4 olduğunda her rAF'de büyüme döngüsü üretebiliyor. Fix owner window_model; Home source bu ajan tarafından değiştirilmedi.

Harness genişletildi: scoped 76.4 px header, karışık POSTER318/LANDSCAPE179 kartlar; collection track tallest-card yüksekliği318, section=header+track bir kez, dört explicit sync/two-frame geçişinde değişmeyen yükseklik, frame'in0'a yerleşmesi ve sonraki satırla24px gap/overlap kontrolü. Önceki59 kontrol korunuyor. Syntax ve IIFE bundle başarılı; genişletilmiş gerçek-TV-run root tarafından **bekliyor**. Önceki59 pass bu yeni regresyon kabulü sayılmaz.

Son root gerçek-TV full rerun: yeni harness **77/77**, değişmeyen legacy harness aynı çağrıda **21/21 başarılı**. Wrapped collection header/card yüksekliği sabit kaldı; frame döngüsü ve next-row overlap kontrolü geçti. Güncel izole renderer kabulü77'dir; yukarıdaki59 önceki tarihsel teslimdir. Root paket hazırlıyor; installed uygulama smoke bu checkpoint'te hâlâ bekliyor. Standalone fixture başarısı FPS/uygulama gezinmesi kabulü olarak sunulmayacak.
