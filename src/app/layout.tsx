import type { Metadata } from "next";
import { Header } from "@/components/header";
import { InstallPrompt } from "@/components/install-prompt";
import { siteMetadataBase, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  // metadataBase is what lets every child page use a relative OG image path
  // and still emit an absolute URL. Without it, Next.js drops the image and
  // every shared link renders as a bare URL.
  metadataBase: siteMetadataBase,
  // Deliberately NOT using a `template` here: the existing pages already
  // append "| Top5DOA" to their own titles, and a template would double it.
  title: SITE_NAME,
  description: SITE_TAGLINE,
  applicationName: SITE_NAME,
  icons: {
    icon: "/images/logo-header.png",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_TAGLINE,
    url: SITE_URL,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_TAGLINE,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#e8ff00" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;700&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js'); }); }`,
          }}
        />
      </head>
      <body className="bg-brand-bg text-white antialiased font-body">
        <InstallPrompt />
        <Header />
        {children}
      </body>
    </html>
  );
}
