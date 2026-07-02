import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// the site is served from Vercel; the base URL lets the social preview image resolve
export const metadata = {
  metadataBase: new URL("https://carverdict.vercel.app"),
  title: "CarVerdict",
  description:
    "Find out what owners actually complain about for a specific car, compare two cars, and see how problems trend across model years, all from real NHTSA records.",
  openGraph: {
    title: "CarVerdict",
    description: "What owners actually complain about, from real NHTSA records.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CarVerdict",
    description: "What owners actually complain about, from real NHTSA records.",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
