import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI-Powered Accessibility-First UI Engine",
  description:
    "Convert natural language UI descriptions into accessible, production-ready React components with live preview, WCAG 2.1 AA validation, and automated test generation.",
  keywords: [
    "accessibility",
    "react",
    "nextjs",
    "ai",
    "component generator",
    "wcag",
    "typescript",
  ],
};

import SessionProvider from "@/components/auth/SessionProvider";
import { WorkspaceProvider } from "@/components/workspace/WorkspaceProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full bg-gray-950 text-white font-sans">
        <SessionProvider>
          <WorkspaceProvider>
            {children}
          </WorkspaceProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
