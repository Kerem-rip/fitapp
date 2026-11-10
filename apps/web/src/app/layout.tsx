// Tüm sayfaları saran ana çerçeve.
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "fitapp",
  description: "Sağlıklı yaşam, beslenme ve egzersiz uygulaması",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
