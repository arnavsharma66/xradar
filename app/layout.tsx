import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "XRadar — Find Viral Content on X",
  description:
    "XRadar is an advanced X/Twitter search query builder. Discover viral tweets, top creator posts, and niche content instantly — no API, no signup required.",
  keywords: ["twitter search", "x search", "viral tweets", "advanced search", "tweet finder", "xradar"],
  authors: [{ name: "XRadar" }],
  openGraph: {
    title: "XRadar — Find Viral Content on X",
    description: "Discover viral tweets, top creator posts, and niche content instantly. No API, no limits.",
    url: "https://xradar.xyz",
    siteName: "XRadar",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "XRadar — Find Viral Content on X",
    description: "Discover viral tweets, top creator posts, and niche content instantly.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
