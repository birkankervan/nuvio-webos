# macOS IPTV: minimal HUD + diziler (aktif plan)

Oluşturma: 2026-11-21. Sahip: root (Opus). Kural: kodu Sonnet subagent yazar, root
inceler; kod okuma/araştırma Haiku. Her adım sonunda: build → kurulum → kullanıcı
onayı → commit + push (`feat/macos-iptv`, remote `personal` =
github.com/birkankervan/NuvioDesktop). Adım bitince bu dosyada durumu güncelle.

## Bağlam (yeni chat için)

- Repo: `~/Desktop/projeler/NuvioDesktop` (KMP + Compose desktop, macOS libmpv JNI).
  Branch `feat/macos-iptv`. Bu TV reposu (`nuvio`) değil.
- IPTV kodu: `composeApp/src/commonMain/kotlin/com/nuvio/app/features/iptv/`
  (IptvApi.kt XtreamClient, IptvBrowser.kt, IptvPreviewPanel.kt, IptvUiState.kt,
  IptvPreviewSurface.kt) + `desktopMain/.../features/iptv/IptvPreviewSurface.desktop.kt`.
- Native: `composeApp/src/desktopMain/native/macos/player_bridge.mm`
  (preview modu: `NuvioPreviewContainerView`, `createPreview`, `PlayerControlsWebView`
  `preview` bayrağı = first responder almaz).
- HUD: `composeApp/src/desktopMain/resources/player-ui/controls.{html,js,css}`
  (Nuvio'nun WKWebView kontrol katmanı; görünürlük Kotlin `controlsVisible`).
- Tam ekran / VOD / bölüm oynatma: `gate.release` → `onIptvPlay` → PlayerRoute
  (Nuvio player). Sağlayıcı max_connections=1: önizleme kapanmadan oynatma açma.
- IPTV id'leri (`iptv:` öneki) watch progress/tracking/addon/meta'dan muaf.
- Build:
  `export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home; cd ~/Desktop/projeler/NuvioDesktop && ./gradlew :composeApp:createReleaseDistributable -Pcompose.desktop.packaging.checkJdkVendor=false`
  (çıktıyı `e:` için filtreleyip boş görmek yetmez; BUILD SUCCESSFUL'u gör).
- Kurulum:
  `osascript -e 'quit app id "com.nuvio.media.desktop"'; rm -rf /Applications/Nuvio.app && ditto composeApp/build/compose/binaries/main-release/app/Nuvio.app /Applications/Nuvio.app && codesign --force --deep -s - /Applications/Nuvio.app`
- Credential/sunucu URL'si MD'ye ve commit'e girmez.

## Adım 1 — Minimal HUD (durum: TAMAM)

Sorun: önizlemedeki HUD büyük ve hantal (normal player ölçüleri + 600px media query).

Yapılacak:

- `@media (max-width: 600px)` kompaktlaştırmasını kaldır (normal player'ı da
  etkiliyordu).
- Native preview modunda controls sayfası yüklenince köke `preview` sınıfı ekle
  (evaluateJavaScript, `controlsReady` sonrası). Common state'e alan ekleme.
- `.preview` CSS: yalnız alt şerit — oynat/duraklat, ses (ikon + kısa slider),
  CANLI rozeti, tam ekran. Küçük ikonlar (~18px), ince alt gradyan, üst başlık/
  header butonları/merkez büyük play/pause overlay/metadata gizli. Yumuşak fade.
- Kabul: 400x225 kutuda tek ince satır, video büyük ölçüde görünür; hover'da
  gelir, 3.5 sn sonra gider; çift tık/tam ekran Nuvio player'ı açar; ok tuşları
  listede çalışmaya devam eder; normal player görünümü değişmez.

### Adım 1b — Dinamik HUD (durum: TAMAM)

Kullanıcı geri bildirimi: minimal HUD'da altyazı (CC) ve ses dili butonları
kayboldu. Bazı yayınlarda bunlar var. Önizlemede ileride film/dizi de açılacak.

- CC butonu yalnız altyazı izi varsa, ses dili butonu yalnız 1'den fazla ses izi
  varsa görünür. İz listeleri native 0.5 sn timer'ındaki `playerUpdate`'ten gelir.
- Zaman çizgisi ve süre yalnız süre > 0 ise görünür (film/dizi). Canlıda gizli kalır.
- Ses/altyazı panelleri küçük kutuda kompakt açılır (kaydırılabilir, küçük font).
  İz seçimi gerçekten mpv'ye uygulanır.
- Adım 3 varsayılanı (kullanıcı aksini demedi): film/dizi önizlemede OTOMATİK OYNAMAZ,
  sağ panelde "Oynat"/bölüm seçimiyle oynar (tek bağlantı sınırı).

## Adım 2 — Xtream dizi API'si (durum: TAMAM)

- `XtreamClient`: `seriesCategories()` (get_series_categories),
  `series(categoryId)` (get_series → series_id, name, cover, plot, rating),
  `seriesInfo(seriesId)` (get_series_info → info + episodes{sezon: [{id, episode_num,
  title, container_extension, info.duration, info.plot, info.movie_image}]}).
- Bölüm URL: `{server}/series/{user}/{pass}/{episodeId}.{ext}` (enc ile).
- Yetişkin filtresi dizi kategori/isimlerine de uygulanır.
- Modeller: `IptvSeries`, `IptvSeason`, `IptvEpisode` (IptvApi.kt içinde, ayrı dosya yok).
- Kabul: saf parse testi (sahte JSON) geçer; gerçek hesapla kategori + bir dizinin
  sezon/bölüm sayısı doğrulanır (çıktıda URL/credential yok).

## Adım 3 — Diziler UI (durum: TAMAM)

- Üst sekmeler: Live | Movies | Series.
- Liste: dizi kategorileri → dizi listesi (poster + ad), mevcut ayraç/arama/klavye
  davranışı korunur.
- Sağ panel (önizleme yerine): kapak, özet, puan, sezon seçici, bölüm listesi
  (numara, ad, süre). Bölüm Enter/çift tık → release → onIptvPlay
  (başlık: "Dizi · S01E02 · Bölüm adı").
- Klavye: liste ↔ bölüm listesi arasında ←/→, sezon değişimi.
- `IptvUiState` seçim/scroll/sezon durumunu tutar; Back sonrası aynı yere dönülür.
- `seriesInfo` cache'i (süreç ömrü).
- Kabul: dizi seç → sezon/bölüm görünür → bölüm Nuvio player'da açılır → Back aynı
  diziye/sezona döner.

## Adım 4 — Cila (durum: TAMAM)

Araştırma: player'ın sonraki bölüm/bölümler paneli `isSeries` (parentMetaType ==
"series") + MetaDetails + addon stream aramasına bağlı. IPTV URL'si sokacak kanca
yok; gerçek player-içi "sonraki bölüm" ortak player koduna yeni yol ister (riskli,
ertelendi).

Yapılacak (hafif sürüm):

- `IptvPlaybackProgress` (iptv paketi): key = launch parentMetaId
  ("iptv:<url hash>"), pozisyon/süre; ≥%90 veya isEnded = izlendi. StateFlow +
  IptvStorage'a kalıcı (desktop properties, yalnız key→pozisyon/süre/izlendi, URL yok).
- Player snapshot effect'inde (PlayerScreenRuntimeEffects ~561-570) yalnız
  isIptvMetaId ise rapor; canlı (süre 0) yok sayılır. Ortak player'a tek küçük kanca.
- Bölüm satırında izlendi tiki + kısmi ilerleme çubuğu.
- Devam: %3–%90 arası kayıt varsa onIptvPlay initialPositionMs ile açar (film+bölüm).
- Sonraki bölüm (hafif): bitmiş bölümden dönünce seçim sıradaki bölüme (sezon
  sonuysa sonraki sezonun ilk bölümüne) kayar; Enter devam ettirir.

## Adım 5 — Tam ekrana kesintisiz geçiş (durum: TAMAM)

Sorun: tam ekran = önizleme release + PlayerRoute yeni mpv örneği → yayın yeniden
bağlanır (siyah + baştan). Sebep: iki ayrı native örnek; PlayerScreen controller'ı
PlayerEngine.desktop.kt:131'de kendisi yaratır, dışarıdan örnek almaz.

Çözüm (devir teslim): önizleme release edilmez; handle bir handoff slotuna konur
(url ile). PlayerScreen'in NativePlayerController.attach'ı aynı url'de slotu alır,
native `promotePreviewToFull` video+controls'u kaptan pencereye taşır,
previewMode kapatır, callback'i değiştirir, `preview` sınıfını kaldırır, durumu
yeniden yayınlar. 5 sn alınmazsa dispose. Başarısızlıkta eski release yolu.
Kabul: canlı kanalda çift tık/tam ekran → siyah/yeniden bağlanma yok, Nuvio
ayarları çalışır; Back → önizleme geri gelir; ses/iz/altyazı tam ekranda çalışır.

## Adım 6 — Tam ekranda kanal listesi (durum: TAMAM)

İstek: tam ekran Nuvio player'da canlı IPTV için kontrol çubuğundan kanal listesi,
seçince aynı ekranda kanal değişsin.
Karar: Nuvio'nun mevcut "Kaynaklar" (sources) paneli yeniden kullanılır; yeni panel
yok. IPTV canlıda liste kaynak yerine o kategorinin kanallarıyla dolar (StreamItem
eşlemesi), buton/panel başlığı "Kanallar". Seçim → switchToSource → attach →
loadfile replace (aynı mpv, tek bağlantı). Kanal listesi PlayerLaunch'a alan
eklemeden iptv paketindeki küçük bir tutucudan gelir. Değişen kanal IPTV seçimine
yansır, dönüşte devir yeni kanalla eşleşir. Film/dizi IPTV'de buton gizli.

## Günlük

- 2026-11-21: plan oluşturuldu. Önceki durum: HUD (c3c066d) push'lu.
- 2026-11-21: Adım 1 kodlandı (html.preview CSS + controlsReady'de native sınıf ekleme, 600px media query kaldırıldı). Build OK, kuruldu. Commit yok; kullanıcı onayı bekleniyor.
- 2026-11-21: Adım 1b kodlandı (controls.js data-has-subs/multi-audio/has-duration, preview altyazı listesi, native preview selectAudioTrack). Native zorla yeniden derlendi, kuruldu. Commit yok.
- 2026-11-22: Adım 2 tamam: seriesCategories/series/seriesInfo + parseSeriesList/parseSeriesInfo, XtreamSeriesParseTest 6/6. Gerçek hesap (yalnız sayılar): 15 dizi kategorisi, ilk kategoride 153 dizi, örnek dizi 8 sezon / ilk sezon 23 bölüm, episodes obje şekli, mkv, duration_secs var. Commit ve push yapıldı. Sonraki: Adım 3 (Diziler UI).
- 2026-11-22: Adım 3 kodlandı: IptvMode {LIVE,VOD,SERIES}, IptvSeriesPanel.kt (kapak/özet/sezon chip/bölüm listesi), seriesInfo cache, klavye →/← panel, [ ] / PgUp PgDn sezon, Enter/tık oynat. Build OK, kuruldu. Commit yok. Not: bölüme tek tık direkt oynatır (kanalda tek tık seçer); kullanıcı istemezse çift tığa çevrilir.
- 2026-11-22: Adım 3 kullanıcı onaylı; commit ve push yapıldı. Sonraki: Adım 4 (opsiyonel cila).
- 2026-11-22: Adım 4 kodlandı: IptvPlaybackProgress (store key progress, yalnız key→sayılar), player effect'e 2 satır kanca, onIptvPlay resume, bölüm tiki/ilerleme çubuğu, dönüşte sonraki bölüme kayma. Test 4/4, build OK, kuruldu. Film satırında ilerleme UI yok (ChannelRow ortak). Commit yok.
- 2026-11-22: Adım 4 kullanıcı onaylı; commit 5cb8ac3, push yapıldı. Plan tamamlandı. Açık kalanlar: player-içi gerçek sonraki bölüm (ortak player'a yol ister), film satırında ilerleme UI, tam ekranda stream yeniden başlıyor.
- 2026-11-22: Adım 5 kodlandı: native promotePreviewToFull (reparentSurfaceToHostView + previewMode kapat + sink değiş + remote commands), NativePlayerHandoff (tek slot, 5 sn timeout), NativePlayerController.detachForHandoff + attach'ta adopt, IptvBrowser canlıda handOff. Release build OK, dylib'de sembol var, kuruldu. NativePlayerHandoffTest 3/3, TeardownTest 23/23; desktopTest genelinde 21 başarısız (ilgisiz 7-8 sınıf, önceden var mı doğrulanmadı). Runtime test yok; commit yok.
- 2026-11-22: Adım 5 düzeltme: devirde anında promote (yükleme ekranı yok), dönüşte ters devir (demoteToPreview, handleAdopted → disposeOrGiveBack, 800 ms bekleme atlanır). Build OK, kuruldu. Runtime testi kullanıcıda; commit yok.
- 2026-11-22: Adım 5 kullanıcı onaylı (açılış + dönüş kesintisiz); commit 4339798, push yapıldı. Açık: player-içi sonraki bölüm, film satırı ilerleme UI, desktopTest'te ilgisiz 21 başarısız test (önceden var mı doğrulanmadı).
- 2026-11-23: Film satırına ilerleme çubuğu + izlendi tiki (ChannelRow opsiyonel progress, yalnız VOD). Build OK, kuruldu. Commit yok, kullanıcı onayı bekleniyor.
- 2026-11-23: Adım 6 kodlandı: IptvPlayerChannels tutucu, PlayerScreenContent'te IPTV için sourceStreamsState = kanallar, Sources etiketi Kanallar/Channels (values + values-tr), selectSource IPTV dalı (saveForReuse=false, pozisyon 0, seçim senkron), film/dizide buton gizli. Build OK, Iptv/NativePlayer/SourceAction testleri geçti, kuruldu. Zapping (↑↓) atlandı. Film satırı ilerleme çubuğu da commit bekliyor.
- 2026-11-23: Adım 6 düzeltmeleri: buton gizliydi (html.preview tam ekranda kalıyordu) → native her controls push'ta classList.toggle; opening reset; TV ikonu (sourcesAreChannels); panel açılışta güncel kanal ortada; canlı kanal ilerleme/resume dışı (IptvPlayerChannels.isLive); TEMP-DIAG temizlendi. Build OK, kuruldu, commit yok.
- 2026-11-23: Adım 6 kullanıcı onaylı (panel anında ortada). Haiku sızıntı/perf incelemesi: büyüyen sızıntı yok; düzeltilen: ilerleme StateFlow'u yalnız kayıt/flush'ta yayınlar, handoff dispose monitor dışında. Bırakılan: açık panelde DOM yeniden kurulumu (upstream, seyrek), statik fullscreen observer (kullanılmayan yol), swapEventSink JNIEnv attach hatasında eski ref sızıntısı (nadir). Commit fbd74da (film ilerleme dahil), push yapıldı.

## Ek düzeltme — Canlı yayın ~60 dk sonra donuyor (durum: commit ed90545, uzun izleme testi bekliyor)

- 2026-11-23: Belirti: canlı HLS ~60. dk eof'a ulaştı (pos==duration), keep-open ile durdu; play hemen yeniden pause. Neden: onSnapshot isEnded → shouldPlay=false; canlı için yeniden bağlanma yoktu.
- Düzeltme (uncommitted, PlayerScreenRuntimeUi.kt): canlı IPTV'de isEnded → `playerController.retry()` (aynı core loadfile replace, pos 0), en fazla 5 sn'de bir; log "live eof -> reload". VOD/dizi değişmedi. Build+kurulum OK.
- Açık: eof gerçek tetiği (sağlayıcı oturum kesmesi mi, playlist reload hatası mı) bilinmiyor; preview (küçük player) için aynı koruma yok. Doğrulama: uzun izleme sonrası logda "live eof -> reload" ve yayının devam etmesi.

## Ek — HUD çözünürlük etiketi (durum: TAMAM, commit 3347b5f)

- 2026-11-23: Sağ alttaki süre etiketinin soluna çözünürlük: w>=3800 veya h>=2100 → "4K", aksi `${h}p`, video yoksa gizli. player_bridge.mm syncControls `video-params/w,h` → playerUpdate `resolution`; controls.{html,js,css}. Uncommitted, build+kurulum OK.

## Ek — Tam ekranda canlı yayın takılması (durum: TAMAM, kullanıcı akıcı dedi)

- 2026-11-23: Neden: handoff ile tam ekran, preview core'unun ayarlarını devralıyordu (live_start_index=-1 → canlı uçta ~1.4s tampon, hls-bitrate=min, cache-pause-wait=1 → her takılmada 1s doldurup tekrar donma).
- Düzeltme (player_bridge.mm, uncommitted): setLiveTuning — promote'ta hls-bitrate=max, live_start_index=-3, cache-pause-initial=yes, cache-pause-wait=4, readahead 10; demote'ta preview değerleri geri. Doğrudan tam ekran core'larda cache-pause-wait=4.
- Not: createReleaseDistributable native değişiklikte eski dylib'i paketleyebiliyor (UP-TO-DATE). Kurulumdan önce `strings ... libplayer_bridge.dylib` ile kontrol et; gerekirse composeApp/build/compose/binaries/main-release sil.
- Açık: devralınan mevcut yayın ilk takılmaya kadar uçta kalır, sonra 4s tampon toplar; kanal değiştirince -3'ten başlar.
