import '../styles/globals.css'
// Note: ArcGIS CSS moved to MapApp component to avoid webpack issues
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from "@/components/ui/toaster"
import { ChatProvider } from '@/contexts/ChatContext'
import ThemeProvider from '@/components/theme/ThemeProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MPIQ',
  description: '',
  icons: {
    icon: '/mpiq_pin2.png',
  },
}

/**
 * Preload critical data resources for faster initial page load
 * These are the most critical files loaded on political-ai page:
 * 1. blob-urls.json - Maps blob keys to Vercel Blob Storage URLs
 * 2. ingham_precincts.geojson - Precinct boundaries for map visualization
 *
 * Note: Other data files (targeting scores, demographics, etc.) are loaded
 * from Vercel Blob Storage via URLs in blob-urls.json
 */

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preload critical data files for faster initial load */}
        <link rel="preload" href="/data/blob-urls.json" as="fetch" crossOrigin="anonymous" />
        <link rel="preload" href="/data/political/ingham_precincts.geojson" as="fetch" crossOrigin="anonymous" />

        {/* Preconnect to Vercel Blob Storage - set NEXT_PUBLIC_BLOB_STORE_URL in .env.local */}
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider>
          <ChatProvider>
            {children}
          </ChatProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}