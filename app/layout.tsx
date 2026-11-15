import type { Metadata, Viewport } from "next";
import { Lora, Nunito_Sans } from "next/font/google";
import "./globals.css";
import { Dock, Footer, Header } from "@/components/SiteChrome";
import ThemeProvider from "@/components/ThemeProvider";
import { Aurora, Toaster } from "@/components/Motion";

const jakarta = Nunito_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const newsreader = Lora({ variable: "--font-newsreader", subsets: ["latin"], weight: ["400", "500", "600"] });
export const metadata: Metadata = { title: "Somewhere. Space to breathe", description: "A calm, guided companion for panic, racing thoughts and overwhelm, and a path to real care." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#FAF8F5" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: `try{var m=localStorage.getItem("sw_mode")||"system";var d=m==="dark"||(m==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.mode=d?"dark":"light";var u=JSON.parse(localStorage.getItem("sw_ui")||"null");if(u){var e=document.documentElement;e.dataset.palette=u.palette;e.dataset.density=u.density;e.dataset.motion=u.motion;e.dataset.focus=u.focus;e.dataset.contrast=u.contrast;e.style.setProperty("--fs",String(u.fontScale))}}catch(e){}` }} /></head>
      <body className={`${jakarta.variable} ${newsreader.variable} antialiased`}>
        <a href="#main" className="skip-link">Skip to main content</a>
        <Aurora />
        <ThemeProvider />
        <Header />
        <main id="main" className="max-w-[1040px] mx-auto px-4 lg:px-6 pt-6">{children}</main>
        <Footer />
        <Dock />
        <Toaster />
      </body>
    </html>
  );
}
