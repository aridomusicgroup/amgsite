"use client";
import { useState, useEffect } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Beat, License } from "@/lib/store";
import { BeatCard } from "./BeatCard";
import { LicenseModal } from "./LicenseModal";
import { PlayerBar } from "./PlayerBar";
import { useLang } from "@/lib/i18n";

export function BeatGrid() {
  const [beats, setBeats] = useState<Beat[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [artist, setArtist] = useState("all");
  const [sort, setSort] = useState("newest");
  const [search, setSearch] = useState("");
  const [selectedBeat, setSelectedBeat] = useState<Beat | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [artists, setArtists] = useState<string[]>([]);
  const { lang } = useLang();

  const SORTS = [
    { value: "newest", label: lang === "es" ? "Más nuevos" : "Newest" },
    { value: "popular", label: lang === "es" ? "Más populares" : "Most popular" },
    { value: "price-low", label: lang === "es" ? "Menor precio" : "Lowest price" },
    { value: "price-high", label: lang === "es" ? "Mayor precio" : "Highest price" },
  ];

  useEffect(() => {
    const params = new URLSearchParams({ artist, sort, search });
    fetch(`/api/beats?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setBeats(d.beats);
        if (d.artists?.length) setArtists(["all", ...d.artists]);
        setLoading(false);
      });
  }, [artist, sort, search]);

  useEffect(() => {
    fetch("/api/licenses")
      .then((r) => r.json())
      .then((d) => setLicenses(d.licenses));
  }, []);

  return (
    <section id="catalogo" className="py-16 px-4 sm:px-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-lgb-red text-xs font-asphaltic tracking-[0.3em] uppercase mb-2">
            {lang === "es" ? "Catálogo" : "Catalog"}
          </p>
          <h2 className="text-4xl sm:text-5xl font-coolvetica text-white">
            {lang === "es" ? "Todos los Beats" : "All Beats"}
          </h2>
        </div>
        <p className="text-white/30 text-sm">
          {beats.length} {lang === "es" ? "beats disponibles" : "beats available"}
        </p>
      </div>

      {/* Search + Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30"
          />
          <input
            type="text"
            placeholder={
              lang === "es" ? "Buscar beats, artistas..." : "Search beats, artists..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 text-white placeholder-white/30 rounded-full pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:border-lgb-red/50 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="bg-white/5 border border-white/10 text-white/70 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-lgb-red/50 cursor-pointer appearance-none"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value} className="bg-lgb-dark text-white">
              {s.label}
            </option>
          ))}
        </select>

        {/* Filter toggle (mobile) */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="sm:hidden flex items-center gap-2 border border-white/10 rounded-full px-4 py-2.5 text-white/60 text-sm cursor-pointer hover:border-lgb-red/40"
        >
          <SlidersHorizontal size={14} />
          {lang === "es" ? "Filtros" : "Filters"}
        </button>
      </div>

      {/* Artist pills */}
      <div
        className={`flex gap-2 overflow-x-auto hide-scrollbar pb-1 mb-8 ${
          showFilters || "hidden sm:flex"
        }`}
      >
        {(artists.length > 0 ? artists : ["all"]).map((a) => (
          <button
            key={a}
            onClick={() => setArtist(a)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-xs border transition-all cursor-pointer ${
              artist === a
                ? "bg-lgb-red border-lgb-red text-white"
                : "border-white/15 text-white/50 hover:border-white/30 hover:text-white/80"
            }`}
          >
            {a === "all" ? (lang === "es" ? "Todos" : "All") : a}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-white/3 animate-pulse aspect-[3/4]" />
          ))}
        </div>
      ) : beats.length === 0 ? (
        <div className="text-center py-20 text-white/30">
          <p className="text-4xl mb-3">🎵</p>
          <p>{lang === "es" ? "No se encontraron beats" : "No beats found"}</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {beats.map((beat) => (
            <BeatCard
              key={beat.id}
              beat={beat}
              queue={beats}
              onBuyClick={(b) => setSelectedBeat(b)}
            />
          ))}
        </div>
      )}

      {/* License Modal */}
      {selectedBeat && (
        <LicenseModal
          beat={selectedBeat}
          licenses={licenses}
          onClose={() => setSelectedBeat(null)}
        />
      )}

      {/* Global sticky player */}
      <PlayerBar onBuyClick={(b) => setSelectedBeat(b)} />
    </section>
  );
}
