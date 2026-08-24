"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, Pause, ShoppingCart, ExternalLink, ArrowLeft } from "lucide-react";
import { WhatsappIcon } from "@/components/shared/BrandIcons";
import { Beat, License } from "@/lib/store";
import { usePlayerStore } from "@/lib/player";
import { useLang } from "@/lib/i18n";
import { SOCIALS } from "@/lib/site";
import { LicenseModal } from "./LicenseModal";
import { PlayerBar } from "./PlayerBar";

export function BeatDetail({ beat }: { beat: Beat }) {
  const [imgError, setImgError] = useState(false);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [showLicenses, setShowLicenses] = useState(false);
  const { current, isPlaying, play } = usePlayerStore();
  const { lang } = useLang();

  useEffect(() => {
    fetch("/api/licenses")
      .then((r) => r.json())
      .then((d) => setLicenses(d.licenses))
      .catch(() => {});
  }, []);

  const cover = beat.artworkLarge || beat.artworkUrl;
  const hasCover = cover && !imgError;
  const playable = Boolean(beat.previewUrl || beat.hlsUrl);
  const isThisPlaying = current?.id === beat.id && isPlaying;

  const togglePlay = () => {
    if (playable) play(beat, [beat]);
    else if (beat.beatstarsUrl) window.open(beat.beatstarsUrl, "_blank", "noopener,noreferrer");
  };

  const t = {
    back: lang === "es" ? "Volver al catálogo" : "Back to catalog",
    listen: lang === "es" ? "Escuchar preview" : "Play preview",
    pause: lang === "es" ? "Pausar" : "Pause",
    buy: lang === "es" ? "Ver licencias y comprar" : "View licenses & buy",
    from: lang === "es" ? "Desde" : "From",
    onBS: lang === "es" ? "Escuchar en BeatStars" : "Listen on BeatStars",
    details: lang === "es" ? "Detalles" : "Details",
    bpm: "BPM",
    key: lang === "es" ? "Tono" : "Key",
    genre: lang === "es" ? "Género" : "Genre",
    plays: lang === "es" ? "Reproducciones" : "Plays",
    ask: lang === "es" ? "Preguntar por este beat" : "Ask about this beat",
  };

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-8 py-10 sm:py-16">
      <Link
        href="/#catalogo"
        className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm mb-8 transition-colors"
      >
        <ArrowLeft size={15} />
        {t.back}
      </Link>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        {/* Cover */}
        <div className="relative aspect-square rounded-3xl overflow-hidden border border-white/10 bg-lgb-surface group">
          {hasCover ? (
            <Image
              src={cover!}
              alt={beat.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
              onError={() => setImgError(true)}
              unoptimized
              priority
            />
          ) : (
            <div
              className="w-full h-full"
              style={{
                background: `linear-gradient(135deg, ${beat.coverGradient[0]}, ${beat.coverGradient[1]})`,
              }}
            />
          )}
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
            aria-label={isThisPlaying ? t.pause : t.listen}
          >
            <span className="w-20 h-20 rounded-full bg-lgb-red flex items-center justify-center shadow-lg shadow-lgb-red/50 hover:scale-110 active:scale-95 transition-transform">
              {isThisPlaying ? (
                <Pause size={28} className="text-white" />
              ) : (
                <Play size={28} className="text-white ml-1" />
              )}
            </span>
          </button>
        </div>

        {/* Info */}
        <div className="flex flex-col">
          {beat.artists?.[0] && (
            <p className="text-lgb-red text-xs font-asphaltic tracking-[0.3em] uppercase mb-3">
              {beat.artists.join(" · ")} {lang === "es" ? "Type Beat" : "Type Beat"}
            </p>
          )}
          <h1 className="text-4xl sm:text-5xl font-coolvetica text-white leading-tight mb-4">
            {beat.title}
          </h1>

          {/* Specs */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {beat.bpm > 0 && (
              <div className="rounded-xl bg-white/3 border border-white/8 px-3 py-2.5">
                <p className="text-white/30 text-[10px] uppercase tracking-wider">{t.bpm}</p>
                <p className="text-white font-coolvetica text-lg">{beat.bpm}</p>
              </div>
            )}
            {beat.key !== "—" && (
              <div className="rounded-xl bg-white/3 border border-white/8 px-3 py-2.5">
                <p className="text-white/30 text-[10px] uppercase tracking-wider">{t.key}</p>
                <p className="text-white font-coolvetica text-lg">{beat.key}</p>
              </div>
            )}
            <div className="rounded-xl bg-white/3 border border-white/8 px-3 py-2.5">
              <p className="text-white/30 text-[10px] uppercase tracking-wider">{t.genre}</p>
              <p className="text-white font-coolvetica text-lg leading-tight">{beat.genre}</p>
            </div>
          </div>

          {/* Tags */}
          {beat.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {beat.tags.slice(0, 8).map((tag) => (
                <span
                  key={tag}
                  className="text-[11px] text-white/50 border border-white/10 rounded-full px-3 py-1"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <div className="mt-auto space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-white/40 text-sm">{t.from}</span>
              <span className="text-white font-coolvetica text-3xl">${beat.price}</span>
              <span className="text-white/30 text-sm">USD</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowLicenses(true)}
                className="flex-1 flex items-center justify-center gap-2 bg-lgb-red text-white px-6 py-3.5 rounded-full font-medium hover:bg-red-700 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
              >
                <ShoppingCart size={17} />
                {t.buy}
              </button>
              <button
                onClick={togglePlay}
                className="flex items-center justify-center gap-2 border border-white/15 text-white/80 hover:text-white hover:border-white/30 px-6 py-3.5 rounded-full transition-colors cursor-pointer"
              >
                {isThisPlaying ? <Pause size={17} /> : <Play size={17} />}
                {isThisPlaying ? t.pause : t.listen}
              </button>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2 pt-2">
              <a
                href={`${SOCIALS.whatsapp}?text=${encodeURIComponent(
                  lang === "es"
                    ? `Hola! Me interesa el beat "${beat.title}"`
                    : `Hi! I'm interested in the beat "${beat.title}"`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors"
              >
                <WhatsappIcon size={14} />
                {t.ask}
              </a>
              {beat.beatstarsUrl && (
                <a
                  href={beat.beatstarsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors"
                >
                  <ExternalLink size={14} />
                  {t.onBS}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {showLicenses && licenses.length > 0 && (
        <LicenseModal beat={beat} licenses={licenses} onClose={() => setShowLicenses(false)} />
      )}

      <PlayerBar onBuyClick={() => setShowLicenses(true)} />
    </section>
  );
}
