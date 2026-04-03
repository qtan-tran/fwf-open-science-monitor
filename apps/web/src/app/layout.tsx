import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FWF Open Science Monitor",
  description: "Monitor open-science compliance across FWF-funded research projects",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
