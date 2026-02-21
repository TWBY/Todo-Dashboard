'use client';

import PortsPage from '@/app/ports/page';
import { usePortsPanel } from '@/contexts/PortsPanelContext';
import { useLeftPanel } from '@/contexts/LeftPanelContext';

export default function PortsPanel() {
  const { close } = usePortsPanel();
  const { collapsed, toggle } = useLeftPanel();

  const handleBack = () => {
    close();
    if (collapsed) setTimeout(() => toggle(), 130);
  };

  return <PortsPage onBack={handleBack} />;
}
