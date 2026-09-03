import type { Metadata, Viewport } from "next";
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

export const metadata: Metadata = {
  metadataBase: new URL("https://market.tohokucssa.org"),
  title: "东北集市｜学友会二手平台",
  description: "面向东北地区中国留学生的可信闲置交易平台。",
  applicationName: "东北集市",
  alternates: {
    canonical: "/",
  },
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: [{ url: "/icons/favicon-64.png", type: "image/png", sizes: "64x64" }],
    shortcut: "/icons/favicon-64.png",
    apple: [{ url: "/icons/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "东北集市", statusBarStyle: "default" },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: "/",
    siteName: "东北集市",
    title: "东北集市｜学友会二手平台",
    description: "让闲置流动，让同学连接。面向东北地区中国留学生的可信闲置交易平台。",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "东北集市｜让闲置流动，让同学连接" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "东北集市｜学友会二手平台",
    description: "让闲置流动，让同学连接。",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = { themeColor: "#17352d" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
