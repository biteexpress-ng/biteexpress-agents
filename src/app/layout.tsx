import type { Metadata, Viewport } from "next";
import { dmSans, dmSerifDisplay } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "BiteExpress Agents",
    template: "%s | BiteExpress Agents",
  },
  description:
    "The working tool of the BiteExpress Agent Program — training, certification, and your referral code.",
  applicationName: "BiteExpress Agents",
  formatDetection: { email: false, address: false, telephone: false },
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: "/brand/biteexpress_favicon.ico", sizes: "any" },
      { url: "/brand/biteexpress_favicon.png", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#fafaf7",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${dmSerifDisplay.variable} h-full antialiased`}
    >
      <body className="flex min-h-dvh flex-col bg-background font-sans text-foreground">
        {children}
      </body>
    </html>
  );
}
