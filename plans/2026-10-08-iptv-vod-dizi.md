# IPTV-10: Xtream VOD (film) + dizi kataloğu ve oynatma

Tarih: 2026-10-08. Aktif plan. Üst plan: `plans/2026-10-06-iptv-plani.md`
(IPTV-10 satırı). Kullanıcı kararı: Tizen kabulünden önce VOD + dizi.

## Ölçüm (sağlayıcı, Mac, 2026-10-08)

- Kategoriler: film 61 (4,9 KB), dizi 15 (1,2 KB).
- `get_vod_streams` tümü: 23.975 öğe, 7,1 MB, 1,5 sn. Kategori başına
  medyan 184 öğe / 46 KB, en büyük 2.079 öğe / 660 KB.
- `get_series` tümü: 4.685 öğe, 3,9 MB (plot/cast içerir). Kategori medyan
  170 öğe / 124 KB, en büyük 1.860 öğe / 1,3 MB.
- `get_vod_info` 2,7 KB; `get_series_info` 29-337 KB (121 bölüme kadar).
- Kapsayıcı: mkv %60, mp4 %37, avi %3 (avi webOS'ta ölçülmedi).
- Poster: %69 image.tmdb.org (`w600_and_h900_bestv2` -> `w342` 3x küçük),
  %28,5 boş (baş harf), uzun kuyrukta ölü hostlar (onerror şart).
- Oynatma URL: `/movie/u/p/{id}.{ext}`, `/series/u/p/{episodeId}.{ext}`;
  302 ile farklı http hosta yönlenir, Range destekli. TV'de doğrulanacak.
- Ağır uçlarda ara sıra 520: 5xx/520/timeout için 2 deneme (0,5/1,5 sn).

## Kararlar

1. Aynı `iptv` route'u, başlıkta sekmeler: Canlı / Filmler / Diziler.
   Sidebar ve router değişmez.
2. Varsayılan kategori bazlı tembel yükleme. 7,1 MB tam liste yalnız arama
   veya "Tümü" açılınca, bir kez, ince öğeye maplenip bellekte tutulur.
   Hiçbir katalog localStorage'a yazılmaz. TV'de parse > 1,5 sn veya heap
   > 25 MB ise arama yüklü kategorilerle sınırlanır.
3. İnce öğe. Film: `{id, name, categoryId, ext, rating, added, poster}`.
   Dizi: `{id, name, categoryId, rating, poster}`. Plot/cast detayda gelir.
4. Poster ızgarası mevcut `iptvVirtualList` ile (5 sütun), yeni poster kart
   fabrikası; src yalnız mount edilen düğümde.
5. Detay: IPTV'ye özel hafif overlay (metaDetailsScreen kullanılmaz).
   Dizi: sezon seçici + bölüm listesi (uzun sezonda sanal liste).
6. İlerleme yalnız yerel: yeni `iptvProgressStore` (profile-scoped,
   silentSync, en fazla 500 kayıt, kaynak silinince temizlenir, %90'da
   tamamlandı sayılıp silinir). Trakt/Simkl/cloud/CW/watched'a asla gitmez.
7. Player: yeni itemType `iptvvod`. `isLivePlaybackItemType` canlıya özel
   kalır (seek ve ended'i kapatır). Ayrı `isLocalOnlyProgressItemType`
   predicate'i flushProgress ve buildScrobbleContext'i keser; ilerleme
   `iptvProgressStore`'a yazılır.

## Sözleşmeler (ajanlar arası)

- Repository (T1 sağlar, T2/T3/T4 kullanır):
  - `IptvRepository.getVodCategories(sourceId)`,
    `getVodStreams(sourceId, categoryId | null)` (null = tüm liste),
    `getSeriesCategories(sourceId)`, `getSeries(sourceId, categoryId | null)`,
    `getVodInfo(sourceId, vodId)`, `getSeriesInfo(sourceId, seriesId)` ->
    `{ info, seasons: [{ number, name, episodes: [{ id, number, title, ext,
    durationSecs, plot, image }] }] }`.
  - `resolveVodPlaybackUrl(sourceId, kind, id, ext)`; kind `movie` |
    `episode`. URL yalnız bellekte döner, loglanmaz.
- Player route params (T2/T3 üretir, T4 tüketir):
  `playIptv: { sourceId, kind: "movie" | "episode", streamId, ext, title,
  seriesId?, season?, episode? }`, `itemType: "iptvvod"`,
  `resumePositionMs`. Canlı `playIptv` şekli (channelId) aynen korunur.
- İlerleme anahtarı: `${sourceId}:movie:${id}` / `${sourceId}:ep:${id}`.

## İşler ve dosya sahipliği

| İş | Sahip | Dosyalar | Bağımlılık | Test |
|---|---|---|---|---|
| T1 veri | Sonnet | `xtreamApi.js` (+test), `iptvRepository.js` (+test) | - | normalizer fixture, retry 520/5xx/timeout, too_large, URL builder, dup id |
| T4 player ilerleme | Sonnet | yeni `iptvProgressStore.js` (+test), `playerScreenMethods-01-mount.js`, `playerControllerMethods-20-flush-progress.js`, scrobble context dosyası, Back hedefi dosyası, `playerControllerMethods-11-*` predicate | sözleşme | sync guard, barrier, %90 tamamlanma, resume |
| T2 liste UI | Sonnet | yeni `iptvPosterCards.js`, `iptvVodScreenData.js`, `iptvScreen.js`, `iptvScreenFocus.js`, `iptvNavigation.js`, `css/iptv.css` | T1 | 5 sütun pencere, sekme navigasyonu, 24k arama süresi, odak geri yükleme |
| T3 detay + dizi | Sonnet | yeni `iptvDetail*.js`, CSS bölümü T2 sonrası | T1, T2 | sezon gruplama, boş sezon, 121 bölüm penceresi |
| T5 entegrasyon | root | paket, kurulum, TV kabulü | hepsi | aşağıdaki kabul |

T1 ve T4 paralel başlar. T2, T1 bitince; T3, T2'nin ızgara sözleşmesinden sonra.

## Kabul (TV, webOS)

- Kategori açma < 1 sn (medyan kategori), arama sonucu < 300 ms (yüklü indeks).
- Tam liste parse süresi ve heap ölçülür (karar 2 eşiği).
- mp4/mkv/avi ilk kare ölçümü; 302 farklı host yönlendirmesi oynuyor.
- Resume: çık, geri gir, kaldığı yerden; %90 sonra baştan.
- Ağ isteklerinde Trakt/Simkl/cloud progress çağrısı yok.
- Back: sekme, kategori ve odak geri gelir. Canlı IPTV regresyonu yok.
- input p95 < 16,7 ms, rAF p95 <= 33,4 ms kaydırmada.

## Tam sonraki adım

T1 ve T4 ajanlarını başlat.
