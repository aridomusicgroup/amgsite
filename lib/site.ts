// Shared site-wide constants — real data from LGB / ARIDO accounts
export const SOCIALS = {
  instagramLGB: "https://www.instagram.com/latinogangbeats/",
  instagramArido: "https://www.instagram.com/aridomusicgroup/",
  youtube: "https://www.youtube.com/@LatinoGangBeats",
  tiktok: "https://www.tiktok.com/@latinogangbeats",
  beatstars: "https://www.beatstars.com/latinogangbeats",
  email: "latinogangbeats@gmail.com",
  whatsapp: "https://wa.me/524881780213",
  whatsappDisplay: "+52 488 178 0213",
};

export const DOMAINS = {
  main: "https://aridomusicgroup.com",
  beats: "https://beats.aridomusicgroup.com",
};

/** Stripe direct checkout: flip to "1" in Vercel env when the Stripe account is ready */
export const DIRECT_CHECKOUT_ENABLED =
  process.env.NEXT_PUBLIC_DIRECT_CHECKOUT === "1";

/** Artists whose style inspires the type beats (shown as marquee / SEO) */
export const TYPE_BEAT_ARTISTS = [
  "Junior H",
  "Peso Pluma",
  "Fuerza Regida",
  "Netón Vega",
  "Oscar Maydon",
  "Gabito Ballesteros",
  "Ivan Cornejo",
  "Luis R Conriquez",
  "Calle 24",
  "Tito Double P",
];
