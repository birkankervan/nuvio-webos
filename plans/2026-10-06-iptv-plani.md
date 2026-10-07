# IPTV uygulama planı (tek kaynak)

6 Ekim 2026. Plan sahibi root. Bu belge IPTV için tek geçerli belgedir; önceki
`plans/2026-10-05-iptv-plani.md` ve `WEBOS_IPTV_AJAN.md` buraya birleştirildi ve
silindi. İş durumu [iş panosunda](../WEBOS_IS_TAKIBI.md), devam bilgisi
[checkpoint dosyasında](../WEBOS_DEVAM_NOTLARI.md); performans planı
[nihai mimari](2026-10-05-webos-nihai-mimari.md).

## Kullanıcı kararları (kesin)

- Kaynak sırası: **Xtream canlı → M3U canlı → EPG**.
- Hedef platform: **webOS ve Tizen**. Her IPTV teslimi iki platformda kabul edilir.
- Menü: sol sidebar'da **IPTV**, **Kütüphanem'in hemen üstünde** (sıra tablosu aşağıda).
- Hesap kurulumu: TV formu (sunucu/kullanıcı/şifre) MVP'dir. **QR/telefonla kurulum
  ayrı iş (IPTV-09)**; MVP kabulüne bağlı değildir.
- Tasarım: mevcut Nuvio dili; yeni framework, dependency, tema, font yok.
- D1 credential saklama ve ilk kare p75 ≤ 3 sn hedefi onaylı.
- Uygulama başlangıcı: TV-01 performans kabulü kapanmadan IPTV kaynak kodu yazılmaz.

## Kapsam

MVP (Xtream): hesap ekle/düzenle/sil/manuel yenile; hesap durumu (aktif, süre
sonu, bağlantı limiti); canlı kategoriler/kanallar; yerel arama; favoriler; son
izlenen kanala dönüş; mevcut player'da canlı oynatma. Sağlayıcı hatası Nuvio auth
hatasına çevrilmez.

Sonra: M3U URL import (aynı kanal/ekran/player sözleşmesi); EPG şimdi/sonraki,
ardından kısa günlük liste. EPG hatası liste ve oynatmayı bozmaz.

Canlı MVP'den sonra, M3U'dan önce (kullanıcı kararı 2026-10-07): sağlayıcı
VOD ve dizi kataloğu (IPTV-10). Hesapta 23.972 film (mkv/mp4/avi) ve 4.684
dizi var; webOS `<video>` mkv ve mp4 oynatıyor (mkv ilk oynatma 5,6-7,2 sn,
mp4 0,5-1 sn). Mevcut Nuvio player (ses/altyazı seçimi) kullanılır; VOD'da
kaldığı yerden devam vardır, canlıda yoktur.

Kapsam dışı (bilinçli): kayıt, catch-up/timeshift, haftalık
iki eksenli rehber, cloud sync. Aşağıdakiler MVP dışı ama sonraki sürüm adayıdır,
gerekçe: önce temel liste/oynatma kararlılığı ölçülecek.
- Player içinde CH+/CH- zapping ve kanal numarası girişi (kodda kanal tuşu desteği yok).
- Yetişkin kategori gizleme / ebeveyn kilidi.
- Birden fazla kaynak arasında geçiş UI'ı (veri modeli çoklu kaynağı baştan destekler,
  MVP UI tek kaynak gösterir).

Geri alma: `js/config.js` içinde tek IPTV bayrağı; kapalıyken sidebar öğesi ve
route kaydı yok. Ayrı ayar ekranı eklenmez.

## Sidebar sırası

`sidebarItems()` (sidebarNavigationHelpers-01-root-sidebar-items.js) şu an
Discover açıkken `[0], [1], DISCOVER, ...slice(2)` döndürür. IPTV
`ROOT_SIDEBAR_ITEMS` içinde Library'nin önüne eklenir ve `slice(2)` mantığı
korunur:

| Discover | Sıra |
| --- | --- |
| in_search (varsayılan) | Home, Search, IPTV, Library, Settings |
| in_sidebar | Home, Search, Discover, IPTV, Library, Settings |

Bayrak kapalıysa IPTV listeden çıkar. Sidebar sıra testi eklenir; aktif öğe
vurgusu, action/shell eşleşmesi ve i18n anahtarı (`sidebar.iptv`) aynı işte.

## Ekran ve kullanıcı akışı

1. Kaynak yoksa kurulum ekranı: TV formu (sunucu adresi, kullanıcı adı, maskeli
   şifre + göster/gizle, Kaydet, hata alanı). IPTV-09 hazır ve capability
   doğrulanmışsa "Telefonla giriş" ikinci seçenek olarak görünür.
2. Kaydet: hesap `user_info` ile doğrulanır, başarılıysa kalıcı store'a atomik
   yazılır. Kanal isteği başarısız olsa bile hesap korunur ve Yeniden Dene görünür.
   Hatalı yeni hesap mevcut geçerli kaynağı ezmez.
3. Hesap varsa IPTV doğrudan kanal ekranına girer. Üstte başlık, kaynak adı, arama,
   kaynak yönetimi; altında kategori bölgesi ve kanal alanı. "Tümü" ve "Favoriler"
   önce gelir. Kart: logo (object-fit:contain, yoksa fallback), ad/numara, favori
   işareti. EPG öncesi sahte program bilgisi yok.
4. OK oynatır; favori ayrı erişilebilir eylem. Player'dan Back aynı kanal,
   kategori ve scroll'a döner.

Stiller `css/base.css` token'ları, mevcut sidebar, Search/Library kart ve account
form/QR stillerinden gelir. Kontrast, uzun isim kırpma, belirgin odak fixture ile
doğrulanır.

## Mevcut kaynakta ne var (doğrulandı)

- `js/ui/navigation/router.js:129-156`: lazy route altyapısı; IPTV route yok.
- `sidebarNavigationHelpers-01-root-sidebar-items.js:15-75`: `ROOT_SIDEBAR_ITEMS`,
  `sidebarItems()`.
- `playerControllerMethods-11-get-av-play-diagnostic-snapshot.js:~208-227`:
  `isLivePlaybackItemType` channel/live/tvchannel/stream ve bölümsüz tv tanır.
  Bu, progress/scrobble yollarının kapalı olduğu anlamına gelmez.
- `playerControllerMethods-17` `saveProgressIfNeeded` ve `-20` `flushProgress`:
  live kontrolü yok. `playerVideoLifecycleHandlers.js:143-149` scrobble start koşulsuz.
- `playerScreenMethods-01-mount.js:~104-130`: `params.streamUrl` "Current source"
  sentetik aday olarak `streamCandidates`'e girer; ardından stream persist bloğu var.
- `streamScreenMethods-10-play-stream.js:59-97` ve routerMethods-01/02: route
  paramları history state'e yazılır. IPTV URL'si route paramı olamaz.
- `js/core/network/httpClient.js`: `includeSessionAuth:false`, `credentials:"omit"`,
  timeout/signal/responseType var; hata gövdesi `error.message`'e taşınır; akışlı
  okuma/limit yok.
- `profileScopedStore.js:141-148,231,249-274`: `seedFromPrimary`, `silentSync`.
- Plugin servisleri: webOS `services/webos/plugin/src/index.js` ve Tizen
  `services/tizen/plugin-service.js` (port 2711) `http.createServer` ile yalnız
  `127.0.0.1`'e bind eder ve `fetch` route'u (admission/validation/redirect) sunar.
  İstemciler: `js/platform/tizen/tizenPluginService.js`, webOS plugin client.
- `js/platform/tizen/tizenPlaybackProxy.js`: AVPlay/HLS header ve proxy kararları.
- `QrCodeGenerator` (js/core/qr), `homeVirtualWindow.js`, `homeLogicalFocus.js`,
  `RouteStateStore`.
- `index.html`'de CSP meta yok.

## Ön spike'lar (IPTV-02 başlamadan, gerçek TV, iki platform)

Sonuçlar bu plana ve panoya yazılmadan IPTV-02 dosya sınırı kilitlenmez.

- **S1 Transport:** gerçek bir Xtream `player_api.php` çağrısı uygulama içinden
  doğrudan `fetch` ile CORS/mixed-content engeline takılıyor mu (webOS ve Tizen
  ayrı)? Takılıyorsa mevcut plugin servis `fetch` route'unun IPTV host'larını
  kabul edip etmediği, boyut/timeout davranışı. Karar: doğrudan fetch / servis
  fetch / platforma göre karışık.
- **S2 Liste boyutu:** 10k, 20k, 50k kanallık `get_live_streams` JSON'unun parse
  süresi ve heap'i (webOS ve Tizen). Tavan ve "aşımda kategori bazlı yükleme"
  eşiği bu ölçümle kilitlenir.
- **S3 Akış formatı:** aynı kanal için `.m3u8` ve `.ts` URL'leri mevcut player
  engine'lerinde (webOS native/HLS, Tizen AVPlay) ilk kare ve kararlılık.
  Varsayılan çıkış formatı bu sonuçla seçilir.

### S1-S3 sonuçları — webOS (nuvio-lg-145, 2026-10-07)

Gerçek kullanıcı test hesabıyla (bilgiler yalnız gitignore'lu `.env` içinde).
Tizen cihazı henüz yok; Tizen sonuçları açık.

- **S1:** uygulama `file:` origin'inden doğrudan `fetch` çalışıyor (CORS/mixed
  content engeli yok, response type basic). Karar webOS: doğrudan fetch;
  servis proxy'si gerekmiyor. Yanlış bilgi `auth:0` ile 200 döner.
- **Hesap:** `max_connections` 1, `allowed_output_formats` m3u8+ts, timezone
  Europe/Istanbul. Tek bağlantı limiti gerçek: kanal değişiminde eski oturum
  kapanmadan yenisi açılmaz (1,5 sn arayla ardışık 6 açılış sorunsuz).
- **S2:** 29 kategori, 1693 kanal, 488 KB, gövde ~230 ms, parse 5,6 ms; 1445
  kanalda logo, 248'inde epg_channel_id. Çoğaltılmış listeyle parse: 10k
  kanal 2,8 MB 55 ms, 20k 5,6 MB 91 ms, 50k 14 MB 262 ms; hafif normalize
  2-8 ms. Karar: tek `get_live_streams` yüklemesi 50k kanal / 20 MiB'ye kadar
  (yükleme ekranında tek seferlik iş), aşımda kategori bazlı yükleme.
- **S3:** webOS `<video>` m3u8 ve ts'yi 1080p oynatıyor. İlk oynatma: ts
  745-913 ms, m3u8 915-1418 ms (3 kanal). DÜZELTME (2026-10-07, 20 sn test):
  webOS progressive canlı `.ts`'yi sonlu dosya gibi oynatıp ~4,8 sn sonra
  `ended` veriyor (player canlıda yeniden başlatınca sonsuz döngü); `.m3u8`
  20 sn kesintisiz. Karar: varsayılan `m3u8`, `ts` yalnız hesap HLS'e izin
  vermiyorsa. 3 sn ilk kare hedefi karşılanıyor.

## Xtream sözleşmesi (IPTV-02)

Doğrulama sağlayıcı fixture'ı ve S1-S3 ile yapılır; aşağıdaki uç noktalar
yaygın Xtream Codes API davranışıdır, belirli sağlayıcıyla test edilmeden
uyumlu sayılmaz.

- Hesap: `GET {server}/player_api.php?username=&password=` →
  `user_info.auth`, `status`, `exp_date`, `max_connections`, `active_cons`,
  `allowed_output_formats`; `server_info` (url, port, https_port, protocol,
  timezone). `auth:0` = hatalı bilgi; `status != Active` veya geçmiş `exp_date` =
  süresi dolmuş mesajı. Süre sonu yaklaşıyorsa kaynak ekranında bilgi.
- Kategoriler: `&action=get_live_categories`.
- Kanallar: `&action=get_live_streams` (tümü) veya `&category_id=` (kategori
  bazlı). S2 tavanı aşan hesaplarda kategori bazlı lazy yükleme kullanılır.
- Oynatma URL'si: `{server}/live/{user}/{pass}/{stream_id}.{ext}`; `ext`
  `allowed_output_formats` ve S3 sonucuna göre (`m3u8` tercih, `ts` yedek).
  URL yalnız player oturumu belleğinde kurulur.
- Bağlantı limiti: kanal değiştirirken önceki native oturum ve fetch kapanmadan
  yenisi açılmaz; `max_connections` aşımı (genelde 403/458 benzeri) ayrı
  anlaşılır hata. Kod değerleri fixture ile doğrulanır.
- Hata sınırı: IPTV istekleri `includeSessionAuth:false`; UI hata metni
  status/koddan üretilir, ham gövde/URL gösterilmez. 401 Nuvio oturumunu kapatmaz.

## Veri, credential ve odak

- Kaynak: `profileId + opaque sourceId`. Kanal: `sourceId + kararlı anahtar`
  (Xtream `stream_id`; M3U'da çakışması denetlenen tvg-id veya yerel eşleme).
  Kimlikte URL/şifre yok; başlık tek başına kimlik değil.
- Saklama kararı (D1, kullanıcı onaylı 2026-10-06): profil bazlı yerel store,
  `seedFromPrimary:false`, her yazmada `silentSync:true`; sync collector/export
  whitelist'inde IPTV alanlarının olmadığı testle kanıtlanır. Yerel saklama
  "güvenli vault" diye sunulmaz; düz yerel saklama kabul edilmiş risk olarak
  kayda geçer. Kaynak silme, Nuvio logout ve profil silme o profilin IPTV
  kaynaklarını, favorilerini, son kanalını ve cache'ini siler.
- Son izlenen kanal ve favoriler: aynı profil store'unda, sync dışı, yalnız
  kimlik taşır.
- Route/history/snapshot yalnız profileId, sourceId, channelId, kategori, arama,
  logical index ve sayısal scroll tutar. Player route paramı `playIptv:{sourceId,
  channelId}`; player mount URL'yi aktif profilden çözer ve `streamCandidates`,
  stream persist, diagnostic snapshot ve loglara yazmaz. Profil geçişi ve kaynak
  silme generation/token ile eski sonucu geçersiz kılar.
- Liste: veriden görünür pencere + küçük overscan; odak logical identity/index ile,
  DOM child index'iyle değil. Arama/kategori/favori değişince odak identity ile
  korunur; silinen kanalda yakın hedef. Logo hydration yalnız görünür/yakın öğede.
  `homeVirtualWindow`/`homeLogicalFocus` saf yardımcıları yeterliyse kullanılır;
  Home renderer'ı taşınmaz.
- Ağ: 15 sn katalog timeout, abort (refresh/profil/route değişimi), boyut sınırı
  gövde okunurken uygulanır (Content-Length yetmez). Refresh başarısızsa eski
  liste korunur. Açılışta son başarılı katalog gösterilir, yenileme yalnız
  manuel veya cache 24 saatten eskiyse arka planda yapılır. Büyük katalog her
  tuşta senkron localStorage'dan okunmaz; IndexedDB uygunluğu IPTV-02'de ölçülür.
- Offline: son cache gösterilir, oynatma hatası anlaşılır mesaj verir.

## Canlı playback sözleşmesi (IPTV-04)

- Player'a `itemType:"channel"`, bölümsüz kimlik, `resumePosition:0`.
- Live bariyeri tek yerde: `PlayerController.saveProgressIfNeeded`,
  `flushProgress` ve scrobble start içinde `isLivePlaybackItemType` guard'ı;
  çağıran tarafa tek tek koşul eklenmez. TMDB enrichment, next episode, post-play
  canlıda çalışmaz.
- Yayın kopunca en çok 3 deneme, 2/4/8 sn aralık; sonra hata ve Yeniden Dene.
- Back, route değişimi, profil geçişi native oturumu, fetch, timer, observer'ı
  temizler. DVR yoksa seek/resume UI gösterilmez.
- Uzun canlı oturumda ayrıca ölçülecek mevcut riskler (blocker değil, kanıt
  çıkarsa ayrı iş): R-01 keepAwake her timeupdate çağrısı, R-03/R-04 subtitle ve
  UI tick maliyeti, M-03 bitmap subtitle cache temizliği.

## QR ile telefon kurulumu (IPTV-09, ayrı iş)

MVP'ye bağlı değil; IPTV-05 sonrası veya paralel yürür. TV formu her zaman
çalışır; QR yalnız capability doğrulanmışsa görünür (fail-closed).

- **Spike önce:** webOS (`services/webos/plugin/src`) ve Tizen
  (`services/tizen/plugin-service.js`) servislerinde ayrı, minimal setup listener
  TV LAN adresine bind olabiliyor mu, telefon erişebiliyor mu, servis ömrü/keep-alive,
  guest Wi-Fi izolasyonu. Mevcut loopback media/plugin/proxy listener'ları LAN'a açılmaz.
  Spike sonucuna göre dosya yeri, port ve servis manifest'i
  (`services/webos/services.json` / `plugin/services.json`, Tizen paketleme)
  ve mevcut plugin client watchdog'una bağlanma kararı yazılır.
- Güvenlik: aktif profile bağlı tek kullanımlık ≥128-bit token, 5 dk TTL; TV
  ekranında 4 haneli doğrulama kodu telefonda girilir. QR yalnız yerel adres/port +
  token taşır, credential taşımaz. Token fragment'te; form belleğe alır ve
  `history.replaceState` ile adres çubuğundan siler (tarayıcı geçmiş kaydını
  silmez, bu sınır kabul edilir). Exact Host/Origin allowlist, wildcard CORS ve
  cookie auth yok, JSON dışı istek reddi, 16 KiB gövde, sınırlı deneme ve timeout,
  no-store/no-referrer, loglarda body/token yok.
- Kabul edilmiş risk: LAN HTTP şifresizdir; aynı ağda pasif dinleme ile şifre
  görülebilir. UI'da TLS varmış gibi sunulmaz.
- Akış: credential yalnız kısa ömürlü bellekte; TV aktif profil/generation
  kontrolüyle alıp store'a yazar. Telefona başarı yalnız kalıcı yazma ACK'inden
  sonra; requestId ile çift gönderim tek kayıt. Back/İptal, yeni QR, timeout,
  route çıkışı, logout/profil değişimi listener'ı, pending submit'i ve buffer'ı temizler.

## İş sırası ve sahiplik

Ajan ataması yok. Atamada gerçek ajan adı ve kesin dosya listesi panoya yazılır;
ortak player/router/sidebar/build/i18n dosyalarında aynı anda tek edit sahibi.

| ID | Teslim | Sahip / dosya sınırı | Bağımlılık | Çıkış ölçütü |
| --- | --- | --- | --- | --- |
| IPTV-01 | Plan | root | — | Bu belge |
| IPTV-S | S1-S3 spike'ları | root (TV ölçüm), kaynak edit yok | TV-01 | Transport kararı, liste tavanı, varsayılan akış formatı; iki platform |
| IPTV-02 | Xtream veri/credential/transport | data ajanı: `js/data/local/iptvSourcesStore.js`, `js/data/repository/iptvRepository.js`, Xtream adapter/normalizer + test | IPTV-S, D1 | Hesap/kategori/kanal fixture; auth/expired/limit; boyut/timeout/abort; atomik refresh; profil/sync izolasyonu testi |
| IPTV-03 | IPTV ekranı + TV hesap formu | UI ajanı: yeni `js/ui/screens/iptv/*` + ekran CSS | IPTV-02 | Görünür pencere, uzak odak, Back, loading/empty/error |
| IPTV-03R | Ortak entegrasyon | root: `router.js`, `sidebarNavigationHelpers-01-root-sidebar-items.js`, sidebar action/shell, i18n, `js/config.js` bayrağı, build wiring | IPTV-03 | Sidebar sıra testi (iki Discover modu), bayrak kapalı/açık, lazy route |
| IPTV-04 | Player canlı entegrasyonu | player ajanı: `playerScreenMethods-01-mount.js`, controller methods-17/-20, scrobble start, test | IPTV-02/03 | Live progress/CW/scrobble çağrı sayısı 0; URL route/history/candidates/persist/diagnostic'te yok; VOD regresyonu |
| IPTV-05 | Xtream MVP TV kabulü | root: test/lint/paket/install, webOS + Tizen | IPTV-03R, IPTV-04 | Kabul bölümündeki MVP maddeleri iki platformda |
| IPTV-10 | Xtream VOD + dizi kataloğu ve oynatma | data + UI ajanları; player root review | IPTV-05 | Kategori/arama, mkv/mp4 oynatma, VOD resume, büyük liste stratejisi (24k film) |
| IPTV-06 | M3U import | data ajanı parser/test; UI formu ayrı sahip | IPTV-10 | BOM/CRLF/EXTINF/kimlik/limit/iptal fixture + gerçek M3U TV kabulü |
| IPTV-07 | EPG şimdi/sonraki + günlük liste | data ajanı XMLTV/API adapter/test; UI ayrı sahip | IPTV-06 | Eşleme, timezone/DST, bounded data, EPG'den bağımsız playback |
| IPTV-08 | Tam regresyon | root | IPTV-07 | Xtream + M3U + EPG ve auth/profil/addon/VOD birlikte, iki platform |
| IPTV-09 | QR/telefon kurulumu (ayrı) | service ajanı (spike sonrası dosya listesi); UI/bridge ayrı sahip | IPTV-05 | QR kabul maddeleri, gerçek telefon + iki platform |

## Kabul ve ölçüm

Sayısal eşikler: input handler p95 < 16,7 ms, rAF p95 ≤ 33,4 ms. Kanal seç → ilk
gerçek video karesi hedefi p75 ≤ 3 sn (kullanıcı onaylı); IPTV-S ölçümü bu
hedefi karşılamıyorsa sebep ve plan değişikliği bu belgeye yazılır. rAF veya `playing` olayı ilk
kare sayılmaz.

- MVP fonksiyon: hatalı/expired hesap, boş kategori, duplicate ID, bağlantı
  limiti, refresh hatasında eski liste, profil B'nin A kaynağını görmemesi,
  app token'ının sağlayıcıya gitmemesi, 401'in Nuvio oturumunu kapatmaması.
- Sızıntı: IPTV URL/credential route, history, log, hata UI, sync payload,
  `streamCandidates`, stream persist ve diagnostic snapshot'ta yok (grep + runtime).
- DOM: 1.000 ve 10.000 kanal fixture'ında mounted/retained DOM katalog boyutuyla
  büyümez (başlangıç tavanı ~24 kart, layout fixture'ında kesinleşir). 200. ve
  9.000. kanal, arama/kategori dönüşü, silme/reorder, uzun basış, sidebar, Magic
  Remote.
- TV: aynı kaynak/profil/ayar, cold ve warm ayrı, en az 3 (tercihen 5) tekrar,
  webOS ve Tizen. 20 liste → kanal → player → Back döngüsünde odak/kategori/scroll
  korunur; fetch/listener/timer/native session sayısı ve (destek varsa) heap büyümez.
- Menü/tasarım: sidebar sırası iki Discover modunda; logo yok, uzun ad, boş kategori.
- M3U: BOM/CRLF/EXTINF quoted attribute, duplicate kimlik, bozuk/boş veri, relative
  URL, yanlış scheme, aşırı gövde; superseded istek stale commit üretmez.
- EPG: source-scoped tvg-id, timezone/DST/gece yarısı, çakışma, boş/hatalı feed;
  24-48 saatlik pencere, tam XML DOM uzun ömürlü tutulmaz.
- QR (IPTV-09): aynı ağdan kurulum, doğrulama kodu, kalıcı kayıt + app restart,
  TTL/replay, yanlış Host/Origin, çift submit, iptal/Back/logout/profil geçişi,
  Wi-Fi/guest izolasyonu, servis durması, storage hatası, ACK yarışı, listener kapanışı.
- Her runtime değişikliğinde: ilgili Node testleri + lint + strict webOS paket +
  Tizen paket + check-performance-build + diff check, sonra gerçek TV kurulumu.
  Saf parser testi TV kabulü değildir; fiziksel kumanda ile alınan ölçüm kontrollü
  sayılmaz.

## Açık kararlar ve tam sonraki adım

- S1-S3 webOS kapandı (yukarıda). Tizen S1-S3 cihaz bulununca.
- IPTV-09 spike: LAN listener iki platformda mümkün mü.

Performans fazı kullanıcı kararıyla durduruldu (TV-01 kalan maddeleri IPTV
sonrası). Tam sonraki adım: IPTV-02 Xtream veri/credential/transport
katmanı (doğrudan fetch, ts varsayılan, 50k/20 MiB tavan).
