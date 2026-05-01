import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "الجاسوس - لعبة الأدوار الاجتماعية",
  description: "لعبة الجاسوس - لعبة استنتاج اجتماعية مشابهة ل لعبة المافيا",
  icons: {
    icon: "🔍",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="dark" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground min-h-screen">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
