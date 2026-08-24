import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { ThemeProvider } from "@/components/shared/ThemeProvider";
import { Attribution } from "@/components/shared/Attribution";
import { AnalyticsBehavior } from "@/components/shared/AnalyticsBehavior";
import { LangProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  metadataBase: new URL("https://aridomusicgroup.com"),
  title: {
    default: "Árido Music Group",
    template: "%s · Árido Music Group",
  },
  description:
    "Casa productora 100% mexicana de regional mexicano. The sound hotter than the sun.",
  icons: {
    icon: "/icon-arido.png",
    apple: "/apple-icon-arido.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Aplica el tema (sistema o guardado) antes del primer render para evitar flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}if(t==="dark"){document.documentElement.classList.add("dark")}}catch(e){}})();`,
          }}
        />
        {/* Vercel Web Analytics: el componente encola eventos, este script los envía */}
        <script defer src="/_vercel/insights/script.js" />
      </head>
      <body className="min-h-full antialiased">
        <ThemeProvider>
          <LangProvider>{children}</LangProvider>
        </ThemeProvider>
        <Attribution />
        <Analytics />
        <AnalyticsBehavior />
      </body>
    </html>
  );
}
