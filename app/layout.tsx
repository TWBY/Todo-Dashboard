import type { Metadata } from 'next';
import { Noto_Sans_TC } from 'next/font/google';
import './globals.css';
import Providers from '@/components/Providers';

const notoSansTC = Noto_Sans_TC({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-noto-sans-tc',
});

export const metadata: Metadata = {
  title: {
    default: 'Brickverse To Do Dashboard',
    template: '%s - Brickverse To Do Dashboard',
  },
  description: 'Brickverse 專案待辦監控中心',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW" className={notoSansTC.variable} suppressHydrationWarning>
      <body className={notoSansTC.className} suppressHydrationWarning>
        <main className="min-h-screen">
          <Providers>{children}</Providers>
        </main>
      </body>
    </html>
  );
}
