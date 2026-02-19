import type { Metadata } from 'next';
import { Noto_Sans_TC } from 'next/font/google';
import './globals.css';
import Providers from '@/components/Providers';
import EnvironmentIndicator from '@/components/EnvironmentIndicator';
import BotModeIndicator from '@/components/BotModeIndicator';
import ComponentDebugOverlay from '@/components/ComponentDebugOverlay';
import DashboardHost from '@/components/DashboardHost';

const notoSansTC = Noto_Sans_TC({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-noto-sans-tc',
});

export const metadata: Metadata = {
  title: {
    default: 'Dashboard',
    template: '%s - Dashboard',
  },
  description: 'Brickverse 專案待辦監控中心',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW" className={notoSansTC.variable} suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body className={notoSansTC.className} suppressHydrationWarning>
        <EnvironmentIndicator />
        <BotModeIndicator />
        <ComponentDebugOverlay />
        <main className="min-h-screen">
          <Providers>
            <DashboardHost>{children}</DashboardHost>
          </Providers>
        </main>
      </body>
    </html>
  );
}
