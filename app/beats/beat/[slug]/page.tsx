import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBeatBySlug } from "@/lib/catalog";
import { Beat } from "@/lib/store";
import { LGBNavbar } from "@/components/lgb/Navbar";
import { LGBFooter } from "@/components/lgb/Footer";
import { BeatDetail } from "@/components/lgb/BeatDetail";
import { DOMAINS } from "@/lib/site";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const beat = await getBeatBySlug(slug);
  if (!beat) return { title: "Beat no encontrado — Latino Gang Beats" };

  const artistPart = beat.artists?.[0] ? `${beat.artists[0]} Type Beat` : "Type Beat";
  const title = `${beat.title} — ${artistPart} | Latino Gang Beats`;
  const description = `Compra "${beat.title}", ${artistPart.toLowerCase()} de regional mexicano${
    beat.bpm > 0 ? ` · ${beat.bpm} BPM` : ""
  }${beat.key !== "—" ? ` · ${beat.key}` : ""}. Licencias desde $${beat.price} USD con entrega instantánea. By Árido Music Group 🌵`;
  const img = beat.artworkLarge || beat.artworkUrl;

  return {
    title,
    description,
    alternates: { canonical: `${DOMAINS.beats}/beat/${beat.slug}` },
    openGraph: {
      title,
      description,
      url: `${DOMAINS.beats}/beat/${beat.slug}`,
      siteName: "Latino Gang Beats",
      images: img ? [{ url: img, width: 1200, height: 1200 }] : undefined,
      locale: "es_MX",
      type: "music.song",
    },
  };
}

export default async function BeatPage({ params }: Props) {
  const { slug } = await params;
  const beat = await getBeatBySlug(slug);
  if (!beat) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MusicRecording",
    name: beat.title,
    byArtist: { "@type": "MusicGroup", name: "Latino Gang Beats" },
    url: beat.url,
    image: beat.artworkLarge || beat.artworkUrl || undefined,
    offers: {
      "@type": "Offer",
      price: beat.price,
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: beat.url,
    },
  };

  return (
    <main className="bg-lgb-black min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <LGBNavbar />
      <BeatDetail beat={beat as unknown as Beat} />
      <LGBFooter />
    </main>
  );
}
