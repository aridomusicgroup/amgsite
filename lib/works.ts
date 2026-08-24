import worksData from "@/data/works.json";

export interface Work {
  title: string;
  artist: string;
  cover: string;
  spotify: string;
  youtube: string;
  streams: number;
}

const data = worksData as {
  featuredVideoId: string;
  beatstarsPlays: number;
  works: Work[];
};

export const featuredVideoId = data.featuredVideoId;
export const works = data.works;

/** Reproducciones totales = streams de temas trabajados + plays de BeatStars */
export function totalPlays(): number {
  const songStreams = data.works.reduce((a, w) => a + (w.streams || 0), 0);
  return data.beatstarsPlays + songStreams;
}

/** Formatea un número grande a "1.2M" / "88.8K" */
export function formatPlays(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}
