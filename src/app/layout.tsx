import type { Metadata, Viewport } from "next";
import { Manrope, Unbounded } from "next/font/google";
import { site } from "@/content";
import "@/styles/globals.scss";

// Заголовки — широкий мягкий гротеск Unbounded, текст — Manrope.
const display = Unbounded({
  variable: "--font-display",
  subsets: ["latin", "cyrillic"],
  weight: ["600", "700", "800"],
});
const sans = Manrope({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  // опубликованный концепт не должен попадать в поиск
  robots: process.env.PAGES_EXPORT === "1" ? { index: false, follow: false } : undefined,
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_ORIGIN || "http://localhost:3500"),
  title: site.title,
  description: site.description,
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/favicon.svg` },
  openGraph: { title: site.title, description: site.description, type: "website", locale: "ru_RU" },
};

export const viewport: Viewport = {
  themeColor: "#ffd6d3",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${display.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
