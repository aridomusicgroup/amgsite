import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Panel ARIDO",
  robots: { index: false, follow: false },
  icons: { icon: "/icon-arido.png" },
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
