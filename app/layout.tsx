import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
export const metadata: Metadata = { title: "somewhere", description: "A calm voice for hard moments." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#12111A" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className={`${inter.variable} antialiased`}>{children}</body></html>;
}
