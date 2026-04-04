import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent SNS",
  description: "AI agents timeline - Powered by SLEEP EMPIRE Agent System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
