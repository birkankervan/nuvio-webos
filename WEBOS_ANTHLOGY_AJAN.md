# Anthology kaynak araştırması

**Kök neden TV’de doğrulandı: yeni paket boş TMDB API key ile kurulmuş.** Stream chip’i doğru şekilde loading → error oluyor; hata DOM kaybı veya Anthology repository/provider silinmesi değil.

- Root’un güvenli TV ölçümünde `tmdbApiKeyConfigured=false`, bir plugin request, IMDb `ensureTmdbId(requireEnabled:false)` sonucu yok, plugin execution `0`, plugin groups `0`; diğer addon’lar 128 stream döndürdü. Chip durumu `loading → error → absent` oldu. Repo açık, 34 sağlayıcı enabled, plugin runtime ready.
- [envProperties.mjs:106](/Users/birkan.kervan/Desktop/projeler/nuvio/scripts/envProperties.mjs:106) `local.properties` ardından `local.example.properties` seçiyor; varsayılan TMDB key alanı boş ([satır 43](/Users/birkan.kervan/Desktop/projeler/nuvio/scripts/envProperties.mjs:43)). Bu checkout’taki güvenli yerel kontrol `local.example.properties` seçimini ve `ensureTmdbId` için ID üretmediğini doğruladı; key değeri gösterilmedi.
- [tmdbService.js:132](/Users/birkan.kervan/Desktop/projeler/nuvio/js/core/tmdb/tmdbService.js:132) key yoksa IMDb dönüşümünü null yapar; [streamRepository.js:593](/Users/birkan.kervan/Desktop/projeler/nuvio/js/data/repository/streamRepository.js:593) normal IMDb kimliğinde plugin isteğini çalıştırmadan döner. Sonuçta success callback gelmez; [methods04:276](/Users/birkan.kervan/Desktop/projeler/nuvio/js/ui/screens/stream/streamScreenMethods-04-load-streams.js:276) chip’i error yapar ve [methods05:217](/Users/birkan.kervan/Desktop/projeler/nuvio/js/ui/screens/stream/streamScreenMethods-05-maybe-auto-resume-stream.js:217) 1.6 saniye sonra kaldırır.
- Stream diffindeki chunk tamponlama callback geldikten sonra işler; bu akışta plugin execution başlamadığı için neden değildir. `load-app.js` webOS’ta ESM seçse de plugin worker ayrı IIFE olarak paketleniyor ([build.mjs:552](/Users/birkan.kervan/Desktop/projeler/nuvio/scripts/build.mjs:552)). Kaynak değişikliği gerekmedi.

**Onarım durumu: tamam.** Yapılandırılmış paket TV'ye kuruldu. TV'de anahtar
varlığı yalnız boolean ile doğrulandı; IMDb → TMDB dönüşümü başarılı. Matrix
kaynak testinde Anthology chip'i loading → success oldu; 15 grup callback ve
26 stream callback toplamı görüldü (benzersiz sonuç sayısı değil). Dizi/bölüm
ayrı test edilmedi. 39/39 Node, lint, strict package ve buildgraph geçti.
`NUVIO_REQUIRE_LOCAL_PROPERTIES` yalnız dosya varlığını denetler; release'te
anahtar doluluğu gizli değeri göstermeden ayrıca doğrulandı.

## TV performans ayarı denetimi

Root yerel yapılandırmayı ekleyip TV’de `tmdbApiKeyConfigured=true` ve IMDb → TMDB dönüşümünü (`requireEnabled:false`) doğruladı; credential değeri bu rapora alınmadı. Aktif profil için mevcut kısmi-yazma API’leri `LayoutPreferences.set(partial)`, `TmdbSettingsStore.set(partial)` ve `PlayerSettingsStore.set(partial)`; bunlar mevcut ayarları birleştirir ([layoutPreferences.js:201](/Users/birkan.kervan/Desktop/projeler/nuvio/js/data/local/layoutPreferences.js:201), [tmdbSettingsStore.js:63](/Users/birkan.kervan/Desktop/projeler/nuvio/js/data/local/tmdbSettingsStore.js:63), [playerSettingsStore.js:428](/Users/birkan.kervan/Desktop/projeler/nuvio/js/data/local/playerSettingsStore.js:428)).

Önerilen hafif profil: `focusedPosterBackdropExpandEnabled:false` (şu an true; Home odak akışındaki 3 sn sonra büyütme işini kapatır), `focusedPosterBackdropTrailerEnabled:false`, `cardDepthEnabled:false`, `blurUnwatchedEpisodes:false`, `blurContinueWatchingNextUp:false`, `useEpisodeThumbnailsInCw:false` (CW kalır, episode-art yükü azalır), `preferExternalMetaAddonDetail:false`, `detailPageTrailerButtonEnabled:false`, `heroSectionEnabled:false`. Hero’yu kapatmak görsel bölümü gizler; tek başına arka plan hero işini durdurmaz. `preferExternalMetaAddonDetail:false` odaklı Home enrichment’ını keser; detail sayfasının addon metadata akışı korunur. Trailer düğmesi yalnızca arayüzü gizler.

TMDB’yi `enabled:false` ve `modernHomeEnabled:false` tut; `enrichContinueWatching:false` ile isteğe bağlı `useArtwork/useBasicInfo/useDetails/useReleaseDates/useCredits/useProductions/useNetworks/useEpisodes/useTrailers/useMoreLikeThis/useCollections` alanlarını da kapalı ayarla. Ana `enabled:false` TMDB enrichment isteklerini zaten engeller; kalan bayraklar koruyucu ayardır ve bazıları ancak TMDB açıksa ek istekleri sınırlar. IMDb plugin dönüşümü bu ayardan bağımsız çalışır, yapılandırılmış anahtarı kullanır. Kullanılmıyorsa `PlayerSettingsStore.set({postPlayRecommendationsEnabled:false})` post-play isteğini keser; `subtitleRenderMode:"native"` ve diğer player davranışları korunmalı. Continue Watching, auth/profiller, addon’lar ve provider’lar açık kalmalı.

Uygulama sonucu: yukarıdaki hafif profil TV'de kaydedildi; ayrıca
`trailerAutoplay:false` ve `showAddonLogo:false` uygulandı. Ana sayfa, bağlı
odak ve birkan belirteci doğrulandı. Ölçülmüş FPS/RAM iyileşmesi iddiası yok;
PATCH-01 gerçek Home güncelleme kabulü açık kalıyor.
