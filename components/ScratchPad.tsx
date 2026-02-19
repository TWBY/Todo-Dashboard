'use client';

import { useState } from 'react';
import { useChatPanels } from '@/contexts/ChatPanelsContext';
import QuickTodoModal from '@/components/QuickTodoModal';

const DASHBOARD_PROJECT_ID = 'dashboard';
const DASHBOARD_PROJECT_NAME = 'Todo-Dashboard';

export default function ScratchPad() {
  const { addPanel } = useChatPanels();
  const [todoModalOpen, setTodoModalOpen] = useState(false);

  const openAskChat = () => {
    addPanel(DASHBOARD_PROJECT_ID, DASHBOARD_PROJECT_NAME, { emailMode: true });
  };


  return (
    <>
      <QuickTodoModal
        open={todoModalOpen}
        onClose={() => setTodoModalOpen(false)}
      />
    </>
  );
}
