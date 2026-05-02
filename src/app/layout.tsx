import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "مافيا - لعبة الاستنتاج الاجتماعية",
  description: "لعبة مافيا - لعبة استنتاج اجتماعية بين المافيا والمواطنين الصالحين. اكتشف المافيا قبل فوات الأوان!",
  icons: {
    icon: "🔫",
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
