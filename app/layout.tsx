import type { Metadata, Viewport } from "next";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/cinzel/500.css";
import "@fontsource/cinzel/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bitcase | Skill Operating Library",
  description: "收集、审查、匹配并组装你的私人 Skills。",
  applicationName: "Bitcase",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Bitcase",
  },
  other: {
    "codex-preview": "development",
    "mobile-web-app-capable": "yes",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/app-icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e8eef1" },
    { media: "(prefers-color-scheme: dark)", color: "#071520" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" data-theme="dark" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var value=JSON.parse(localStorage.getItem('bitcase-theme')||'\"dark\"');document.documentElement.dataset.theme=value==='light'?'light':'dark'}catch(error){document.documentElement.dataset.theme='dark'}",
          }}
        />
        {children}
      </body>
    </html>
  );
}
