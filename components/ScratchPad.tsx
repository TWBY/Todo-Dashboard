'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useChatPanels } from '@/contexts/ChatPanelsContext';
import { useLeftPanel } from '@/contexts/LeftPanelContext';
import QuickTodoModal from '@/components/QuickTodoModal';

const DASHBOARD_PROJECT_ID = 'dashboard';
const DASHBOARD_PROJECT_NAME = 'Todo-Dashboard';

export default function ScratchPad() {
  const router = useRouter();
  const { addPanel } = useChatPanels();
  const { toggle: toggleLeftPanel } = useLeftPanel();
  const [todoModalOpen, setTodoModalOpen] = useState(false);

  const openAskChat = () => {
    addPanel(DASHBOARD_PROJECT_ID, DASHBOARD_PROJECT_NAME, { emailMode: true });
  };

  return (
    <div>
      <div className="flex flex-col gap-2">
        {/* 第一排：動作類 + 收合 */}
        <div className="flex gap-2">
          <button
            onClick={() => setTodoModalOpen(true)}
            className="flex-1 py-2 rounded-lg text-base transition-all duration-200 cursor-pointer"
            style={{
              backgroundColor: 'var(--background-tertiary)',
              color: 'var(--text-tertiary)',
            }}
          >
            待辦
          </button>
          <button
            onClick={openAskChat}
            className="flex-1 py-2 rounded-lg text-base transition-all duration-200 cursor-pointer"
            style={{
              backgroundColor: 'var(--background-tertiary)',
              color: 'var(--text-tertiary)',
            }}
            suppressHydrationWarning
          >
            Email
          </button>
          <button
            onClick={toggleLeftPanel}
            className="px-2 py-2 rounded-lg transition-all duration-200 cursor-pointer flex items-center justify-center"
            style={{
              backgroundColor: 'var(--background-tertiary)',
              color: 'var(--text-secondary)',
            }}
            title="收合專案列表"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="10 3 5 8 10 13" />
            </svg>
          </button>
        </div>

        {/* 第二排：導覽類 */}
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/chat/center')}
            className="flex-1 py-2 rounded-lg text-base transition-all duration-200 cursor-pointer"
            style={{
              backgroundColor: 'var(--background-tertiary)',
              color: 'var(--text-tertiary)',
            }}
            title="Chat 功能中心"
          >
            Chat
          </button>
          <button
            onClick={() => router.push('/ports')}
            className="flex-1 py-2 rounded-lg text-base transition-all duration-200 cursor-pointer"
            style={{
              backgroundColor: 'var(--background-tertiary)',
              color: 'var(--text-tertiary)',
            }}
            title="Port 管理（國家全貌 + Station 居民表）"
          >
            Ports
          </button>
          <button
            onClick={() => router.push('/blog/pipeline')}
            className="flex-1 py-2 rounded-lg text-base transition-all duration-200 cursor-pointer"
            style={{
              backgroundColor: 'var(--background-tertiary)',
              color: 'var(--text-tertiary)',
            }}
            title="Blog 編輯流水線"
          >
            Blog
          </button>
          <button
            onClick={() => router.push('/skills')}
            className="flex-1 py-2 rounded-lg text-base transition-all duration-200 cursor-pointer"
            style={{
              backgroundColor: 'var(--background-tertiary)',
              color: 'var(--text-tertiary)',
            }}
            title="Skills 總覽"
          >
            Skills
          </button>
        </div>
      </div>

      <QuickTodoModal
        open={todoModalOpen}
        onClose={() => setTodoModalOpen(false)}
      />
    </div>
  );
}
