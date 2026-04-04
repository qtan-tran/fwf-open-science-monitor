import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "FWF Open Science Monitor",
    template: "%s · FWF Open Science Monitor",
  },
  description:
    "Monitor open-science compliance and output metrics across FWF-funded research projects.",
  openGraph: {
    title: "FWF Open Science Monitor",
    description:
      "Monitor open-science compliance and output metrics across FWF-funded research projects.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "FWF Open Science Monitor",
    description:
      "Monitor open-science compliance and output metrics across FWF-funded research projects.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
         * Inline script: reads `theme` from localStorage before first paint so
         * the correct class is applied to <html> without any flash.
         */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(t==null&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${inter.variable} font-sans antialiased bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-50`}
      >
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main
            id="main-content"
            className="flex-1 overflow-y-auto lg:ml-64"
            tabIndex={-1}
          >
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
