import type { Metadata, Viewport } from "next";
import { Newsreader, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Footer, Header } from "@/components/SiteChrome";
import ThemeProvider from "@/components/ThemeProvider";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"] });
export const metadata: Metadata = { title: "Somewhere. Space to breathe", description: "A calm, guided companion for panic, racing thoughts and overwhelm, and a path to real care." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#FAF8F5" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${jakarta.variable} ${newsreader.variable} antialiased`}>
        <ThemeProvider />
        <Header />
        <main className="max-w-[1040px] mx-auto px-4 lg:px-6 pt-6">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
