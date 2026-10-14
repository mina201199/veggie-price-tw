import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "菜市漫遊 · GPS 與同步採買筆記",
  description: "桃園 3D 採買地圖與私人帳號筆記。",
  icons: {
    icon: "/app-icon.svg",
    shortcut: "/app-icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body className="antialiased">{children}</body>
    </html>
  );
}
