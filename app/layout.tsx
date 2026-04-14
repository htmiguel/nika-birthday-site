import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { THEME_STORAGE_KEY } from "@/lib/theme-storage";
import "./globals.css";

const themeInitScript = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)},s=localStorage.getItem(k);if(s==="light"||s==="dark")document.documentElement.setAttribute("data-theme",s);}catch(e){}})();`;

export const metadata: Metadata = {
  title: "Nika — birthday guest book",
  description: "Leave Nika a message, voice note, or photo for her birthday.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeToggle />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
