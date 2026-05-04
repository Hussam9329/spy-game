import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#dc2626",
};

export const metadata: Metadata = {
  title: "مافيا - لعبة الاستنتاج الاجتماعية",
  description: "لعبة مافيا - لعبة استنتاج اجتماعية بين المافيا والمواطنين الصالحين. اكتشف المافيا قبل فوات الأوان!",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/icon-180.png", sizes: "180x180", type: "image/png" },
      { url: "/icon-152.png", sizes: "152x152", type: "image/png" },
    ],
    shortcut: "/icon-96.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "مافيا",
  },
  openGraph: {
    title: "مافيا - لعبة الاستنتاج الاجتماعية",
    description: "اكتشف المافيا قبل فوات الأوان! لعبة استنتاج اجتماعية ممتعة",
    images: ["/splash.png"],
    type: "website",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#dc2626",
    "msapplication-TileImage": "/icon-144.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="dark" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon-180.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icon-152.png" />
        <link rel="apple-touch-icon" sizes="144x144" href="/icon-144.png" />
        <link rel="apple-touch-icon" sizes="120x120" href="/icon-120.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="مافيا" />
      </head>
      <body className="antialiased bg-background text-foreground min-h-screen overscroll-none">
        {children}
        <Toaster />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(err) {
                    console.log('SW registration failed: ', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
