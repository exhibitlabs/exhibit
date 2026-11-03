import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

const TITLE = "Exhibit: the dispute agent for PayPal merchants";
const DESCRIPTION =
  "Exhibit reads each PayPal dispute through the Disputes API, investigates it with Claude, cites every claim to a real record and files the response. When the buyer is right, it refunds.";

export const metadata: Metadata = {
  metadataBase: new URL("https://exhibit.9to5code.com"),
  title: { default: TITLE, template: "%s · Exhibit" },
  description: DESCRIPTION,
  applicationName: "Exhibit",
  authors: [{ name: "Shivansh Dwivedi", url: "https://github.com/shvuuuu" }, { name: "Someet Shende", url: "https://github.com/someetshende" }],
  creator: "KaDeep AI",
  keywords: ["PayPal disputes", "chargebacks", "PayPal Disputes API", "AI agent", "Claude", "MCP", "merchant tools"],
  openGraph: {
    type: "website",
    siteName: "Exhibit",
    url: "/",
    locale: "en_US",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
