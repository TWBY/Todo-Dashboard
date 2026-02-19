'use client';

import { usePathname } from 'next/navigation';
import DashboardContent from '@/components/DashboardContent';

export default function DashboardHost({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === '/';

  return (
    <>
      {/* 主頁面：顯示 DashboardContent（含 Chat Panels） */}
      <div className={isHome ? 'block' : 'hidden'}>
        <DashboardContent />
      </div>

      {/* 子頁面：顯示頁面內容 */}
      <div className={isHome ? 'hidden' : 'block'}>
        {children}
      </div>
    </>
  );
}
