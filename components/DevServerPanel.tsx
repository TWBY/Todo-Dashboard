'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Project } from '@/lib/types';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import PulsingDots from '@/components/PulsingDots';
import { useChatPanels } from '@/contexts/ChatPanelsContext';
import { useBuildPanel } from '@/contexts/BuildPanelContext';
import { formatPort } from '@/lib/format';
import pkg from '@/package.json';

interface PortStatus {
  projectId: string;
  port: number;
  isRunning: boolean;
  pid?: number;
  projectPath?: string;
  memoryMB?: number;
  cpuPercent?: number;
}

interface DevServerPanelProps {
  projects: Project[];
  onUpdate?: (project: Project, category: 'projects' | 'courseFiles' | 'utilityTools') => void;
}

interface Toast {
  message: string;
  type: 'success' | 'error';
}

export default function DevServerPanel({ projects, onUpdate }: DevServerPanelProps) {
  const [statuses, setStatuses] = useState<PortStatus[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [recentlyStarted, setRecentlyStarted] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<Toast | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const { copy, isCopied } = useCopyToClipboard();
  const router = useRouter();
  const [prodLoading, setProdLoading] = useState(false);
  const [prodRunning, setProdRunning] = useState(false);
  const { addPanel } = useChatPanels();
  const { toggle: toggleBuildPanel } = useBuildPanel();
  const [compact, setCompact] = useState(false);
  const headerBtnsRef = useRef<HTMLDivElement>(null);
  const [currentPort, setCurrentPort] = useState<number>(0);

  // 偵測當前瀏覽器 port
  useEffect(() => {
    setCurrentPort(parseInt(window.location.port) || 80);
  }, []);

  // ResizeObserver: 偵測按鈕區寬度，切換 compact 模式
  useEffect(() => {
    const el = headerBtnsRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setCompact(entry.contentRect.width < 350);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // 檢查 Production server 狀態
  const checkProdStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/dev-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 'dashboard', action: 'check-production' }),
      });
      if (res.ok) {
        const data = await res.json();
        setProdRunning(data.isRunning);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleProdStart = useCallback(async () => {
    setProdLoading(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch('/api/dev-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 'dashboard', action: 'start-production' }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      if (res.ok) {
        setProdRunning(true);
        showToast(data.message || 'Production 已啟動', 'success');
      } else {
        showToast(data.error || '啟動 Production 失敗', 'error');
      }
    } catch (error) {
      showToast(
        error instanceof Error && error.name === 'AbortError'
          ? '啟動逾時（API 無回應超過 15 秒）'
          : 'Production 啟動請求失敗',
        'error',
      );
    } finally {
      setProdLoading(false);
    }
  }, [showToast]);

  const handleProdStop = useCallback(async () => {
    setProdLoading(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch('/api/dev-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 'dashboard', action: 'stop-production' }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      if (res.ok) {
        setProdRunning(false);
        showToast(data.message || 'Production 已停止', 'success');
      } else {
        showToast(data.error || '停止 Production 失敗', 'error');
      }
    } catch (error) {
      showToast(
        error instanceof Error && error.name === 'AbortError'
          ? '停止逾時（API 無回應超過 10 秒）'
          : 'Production 停止請求失敗',
        'error',
      );
    } finally {
      setProdLoading(false);
    }
  }, [showToast]);

  const handleProdReload = useCallback(async () => {
    setProdLoading(true);
    try {
      // Step 1: Stop
      const stopCtrl = new AbortController();
      const stopTimeout = setTimeout(() => stopCtrl.abort(), 10000);
      const stopRes = await fetch('/api/dev-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 'dashboard', action: 'stop-production' }),
        signal: stopCtrl.signal,
      });
      clearTimeout(stopTimeout);
      if (!stopRes.ok) {
        const d = await stopRes.json();
        showToast(d.error || 'Reload 失敗（stop 階段）', 'error');
        return;
      }
      setProdRunning(false);
      // Step 2: Start
      const startCtrl = new AbortController();
      const startTimeout = setTimeout(() => startCtrl.abort(), 15000);
      const startRes = await fetch('/api/dev-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 'dashboard', action: 'start-production' }),
        signal: startCtrl.signal,
      });
      clearTimeout(startTimeout);
      const startData = await startRes.json();
      if (startRes.ok) {
        setProdRunning(true);
        showToast(startData.message || 'Production 已重新啟動', 'success');
        // 等 server 就緒後重整 4000 頁面
        setTimeout(() => window.location.reload(), 1500);
      } else {
        showToast(startData.error || 'Reload 失敗（start 階段）', 'error');
      }
    } catch (error) {
      showToast(
        error instanceof Error && error.name === 'AbortError'
          ? 'Reload 逾時（API 無回應）'
          : 'Production Reload 請求失敗',
        'error',
      );
    } finally {
      setProdLoading(false);
    }
  }, [showToast]);

  const fetchStatuses = useCallback(async (signal?: AbortSignal) => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/dev-server', { signal });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setStatuses(data.data || []);
    } catch {
      // 靜默處理，dev:watch 會自動重啟 server
    } finally {
      setIsRefreshing(false);
      setIsInitialLoad(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchStatuses(controller.signal);
    checkProdStatus();
    // Refresh every 15 seconds
    const interval = setInterval(() => {
      fetchStatuses(controller.signal);
      checkProdStatus();
    }, 15000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [fetchStatuses, checkProdStatus]);

  // Auto-refresh when projects list changes (e.g., new project added to dev server)
  useEffect(() => {
    if (!isInitialLoad) {
      fetchStatuses();
    }
  }, [projects, isInitialLoad, fetchStatuses]);

  const handleAction = async (projectId: string, action: 'start' | 'stop') => {
    setLoading(prev => ({ ...prev, [projectId]: true }));
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      const res = await fetch('/api/dev-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, action }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || `${action} 失敗`, 'error');
      } else {
        showToast(data.message || `${action} 成功`, 'success');
      }
      // Refresh statuses after action
      await fetchStatuses();

      // If server not yet detected after start, schedule extra refreshes as safety net
      if (action === 'start' && !data.isRunning) {
        setTimeout(() => fetchStatuses(), 3000);
        setTimeout(() => fetchStatuses(), 6000);
      }

      // 標記為最近啟動，觸發動畫效果
      if (action === 'start') {
        setRecentlyStarted(prev => ({ ...prev, [projectId]: true }));
        // 3 秒後移除標記
        setTimeout(() => {
          setRecentlyStarted(prev => ({ ...prev, [projectId]: false }));
        }, 3000);
      }
    } catch (error) {
      showToast(
        error instanceof Error && error.name === 'AbortError'
          ? `${action === 'start' ? '啟動' : '停止'}逾時（API 無回應超過 20 秒）`
          : `${action} 請求失敗`,
        'error',
      );
    } finally {
      setLoading(prev => ({ ...prev, [projectId]: false }));
    }
  };

  const handleOpenBrowser = async (project: Project) => {
    const url = `http://localhost:${project.devPort}${project.devBasePath || ''}`;
    const isCourseFiles = project.path?.startsWith('/Users/ruanbaiye/Documents/Brickverse/CourseFiles');
    if (isCourseFiles) {
      try {
        const res = await fetch('/api/dev-server', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: project.id, action: 'open-browser' }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || '開啟 Dia 失敗', 'error');
        }
      } catch (error) {
        showToast('開啟 Dia 請求失敗', 'error');
      }
    } else {
      window.open(url, '_blank');
    }
  };

  const handleRemoveFromDev = async (project: Project) => {
    const status = getStatus(project.id);
    // If running, stop first
    if (status?.isRunning) {
      await handleAction(project.id, 'stop');
    }
    // Trigger fade-out animation first
    setRemovingIds(prev => new Set(prev).add(project.id));
    // Wait for animation to complete, then call API
    await new Promise(resolve => setTimeout(resolve, 500));
    try {
      // Parse composite id for child projects (format: "parentId::childName")
      const isChild = project.id.includes('::');
      const [actualProjectId, childName] = isChild ? project.id.split('::') : [project.id, undefined];
      const res = await fetch('/api/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: actualProjectId, childName, action: 'remove-from-dev' }),
      });
      if (res.ok) {
        showToast(`已移除 ${project.displayName || project.name}`, 'success');

        // Optimistic update: notify parent to remove devPort from state
        if (onUpdate) {
          // Determine category from project path
          const category = project.path.includes('/CourseFiles/')
            ? 'courseFiles'
            : project.path.includes('/UtilityTools/')
              ? 'utilityTools'
              : 'projects';

          // Create updated project with devPort removed
          const updatedProject = { ...project, devPort: undefined };
          onUpdate(updatedProject, category);
        }
      } else {
        showToast('移除失敗', 'error');
        setRemovingIds(prev => { const next = new Set(prev); next.delete(project.id); return next; });
      }
    } catch {
      showToast('移除請求失敗', 'error');
      setRemovingIds(prev => { const next = new Set(prev); next.delete(project.id); return next; });
    }
  };

  const projectsWithPort = projects
    .filter(p => p.devPort)
    .sort((a, b) => {
      // 排隊邏輯：先加入的在前，後加入的在後
      const aTime = a.devAddedAt || a.updatedAt || '';
      const bTime = b.devAddedAt || b.updatedAt || '';
      return aTime.localeCompare(bTime);
    });

  const getStatus = (projectId: string): PortStatus | undefined => {
    return statuses.find(s => s.projectId === projectId);
  };

  // Production 自我保護：從 4000 訪問時，不能停止 Production server
  const isProdSelf = currentPort === 4000;

  return (
    <div
      className="relative"
    >
      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg text-base font-medium shadow-lg animate-fade-in"
          style={{
            backgroundColor: toast.type === 'error' ? 'rgba(220, 38, 38, 0.9)' : 'rgba(5, 150, 105, 0.9)',
            color: 'white',
          }}
        >
          {toast.message}
        </div>
      )}

      <div ref={headerBtnsRef} className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <span
            className="cursor-pointer hover:opacity-70 transition-opacity"
            onClick={() => copy('Dev Servers')}
            title="點擊複製名稱"
          >
            Dev Servers
          </span>
          {isCopied('Dev Servers') && (
            <span className="text-sm text-green-500">已複製！</span>
          )}
          <span
            className="text-xs px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}
          >
            v{pkg.version}
          </span>
          {isUpdating && (
            <span className="text-sm px-2 py-0.5 rounded-full animate-pulse"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', color: '#999999' }}>
              更新中...
            </span>
          )}
        </h2>
        <div className="flex items-center gap-1.5 relative">
          <button
            onClick={handleProdReload}
            disabled={prodLoading}
            className={`${compact ? 'w-7 h-7 justify-center' : 'px-2.5 py-1'} rounded-lg transition-all duration-200 hover:shadow-md hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 flex items-center ${
              prodRunning && !prodLoading ? '' : 'hidden'
            }`}
            style={{
              backgroundColor: '#222222',
              color: '#cccccc',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-weight-semibold)',
              lineHeight: 'var(--leading-compact)',
              letterSpacing: 'var(--tracking-ui)',
              border: '1px solid #333333',
            }}
            title="重新啟動 Production (stop → start)"
          >
            {compact ? 'R' : 'Reload'}
          </button>
          {!(isProdSelf && prodRunning) && (
          <button
            onClick={prodRunning ? handleProdStop : handleProdStart}
            disabled={prodLoading}
            className={`${compact ? 'w-7 h-7 justify-center' : 'px-2.5 py-1'} rounded-lg transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 hover:shadow-md hover:scale-[1.02] flex items-center`}
            style={{
              backgroundColor: prodLoading ? '#333333' : prodRunning ? '#3d1515' : '#15332a',
              color: prodLoading ? '#999999' : prodRunning ? '#ef4444' : '#10b981',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-weight-semibold)',
              lineHeight: 'var(--leading-compact)',
              letterSpacing: 'var(--tracking-ui)',
              border: prodLoading ? '1px solid #444444' : prodRunning ? '1px solid #5c2020' : '1px solid #1a4a3a',
            }}
            title={prodRunning ? '停止 Production server' : '啟動 Production server'}
          >
            {prodLoading ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {!compact && <span className="ml-1">{prodRunning ? '停止中' : '啟動中'}</span>}
              </>
            ) : compact ? (prodRunning ? 'S' : 'S') : (prodRunning ? 'Stop' : 'Start')}
          </button>
          )}
          <button
            onClick={toggleBuildPanel}
            className={`${compact ? 'w-7 h-7 justify-center' : 'px-2.5 py-1'} rounded-lg transition-all duration-200 hover:shadow-md hover:scale-[1.02] flex items-center`}
            style={{
              backgroundColor: '#332815',
              color: '#f59e0b',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-weight-semibold)',
              lineHeight: 'var(--leading-compact)',
              letterSpacing: 'var(--tracking-ui)',
              border: '1px solid #4a3520',
            }}
            title="打包 Dashboard (npm run build)"
          >
            {compact ? 'B' : 'Build'}
          </button>
          <button
            onClick={() => router.push('/changelog')}
            className={`${compact ? 'w-7 h-7 justify-center' : 'px-2.5 py-1'} rounded-lg transition-all duration-200 hover:shadow-md hover:scale-[1.02] flex items-center`}
            style={{
              backgroundColor: '#1f1533',
              color: '#a78bfa',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-weight-semibold)',
              lineHeight: 'var(--leading-compact)',
              letterSpacing: 'var(--tracking-ui)',
              border: '1px solid #3b2663',
            }}
            title="版本歷史"
          >
            {compact ? 'L' : 'Log'}
          </button>
        </div>
      </div>

      {isInitialLoad ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="py-2.5 px-3 rounded-[var(--radius-medium)] animate-pulse"
              style={{ backgroundColor: 'var(--background-secondary)' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="h-4 rounded" style={{ backgroundColor: 'var(--background-tertiary)', width: `${100 + i * 30}px` }} />
                  <div className="h-4 w-8 rounded" style={{ backgroundColor: 'var(--background-tertiary)' }} />
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-7 w-12 rounded-lg" style={{ backgroundColor: 'var(--background-tertiary)' }} />
                  <div className="h-7 w-12 rounded-lg" style={{ backgroundColor: 'var(--background-tertiary)' }} />
                  <div className="h-7 w-6 rounded-lg" style={{ backgroundColor: 'var(--background-tertiary)' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          {projectsWithPort.map((project, index) => {
            const status = getStatus(project.id);
            const isRunning = status?.isRunning || false;
            const isLoading = loading[project.id] || false;
            const isRecentlyStarted = recentlyStarted[project.id] || false;
            const isRemoving = removingIds.has(project.id);
            const isSelf = project.devPort === currentPort;

            return (
              <div
                key={project.id}
                className="grid transition-[grid-template-rows] duration-500"
                style={{ gridTemplateRows: isRemoving ? '0fr' : '1fr' }}
              >
              <div className={`overflow-hidden min-h-0${index > 0 ? ' pt-2' : ''}`}>
              <div
                className={`py-2.5 px-3 rounded-[var(--radius-medium)] transition-[opacity,transform] duration-300 ${
                  isRemoving ? 'opacity-0 scale-95 -translate-x-4' :
                  isLoading ? 'ring-2 ring-yellow-500/30' :
                  isRecentlyStarted ? 'ring-2 ring-green-500/30' : ''
                }`}
                style={{ backgroundColor: 'var(--background-secondary)', containerType: 'inline-size' }}
              >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-medium text-base truncate cursor-pointer hover:opacity-70 transition-opacity"
                        onClick={() => copy(project.path)}
                        title="點擊複製路徑"
                      >
                        {project.displayName || project.name}
                      </span>
                      {isCopied(project.path) && (
                        <span className="text-sm text-green-500 flex-shrink-0">已複製！</span>
                      )}
                      <span
                        className="text-sm font-mono px-1.5 py-0.5 rounded hidden @[280px]:inline-flex"
                        style={{ backgroundColor: 'var(--background-tertiary)', color: 'var(--text-tertiary)' }}
                      >
                        {formatPort(project.devPort!)}
                      </span>
                      {isLoading && (
                        <span className="text-sm px-2 py-0.5 rounded-full animate-pulse"
                          style={{ backgroundColor: 'rgba(250, 204, 21, 0.2)', color: '#facc15' }}>
                          {isRunning ? '停止中...' : '啟動中...'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 justify-end">
                  <button
                    onClick={() => handleOpenBrowser(project)}
                    className={`px-2.5 py-1.5 rounded-lg transition-all duration-200 hover:shadow-md hover:scale-[1.02] ${
                      isRunning && !isLoading ? '' : 'hidden'
                    }`}
                    style={{
                      backgroundColor: '#222222',
                      color: '#cccccc',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 'var(--font-weight-semibold)',
                      lineHeight: 'var(--leading-compact)',
                      letterSpacing: 'var(--tracking-ui)',
                      border: '1px solid #333333',
                    }}
                    title="在瀏覽器中開啟"
                    tabIndex={isRunning && !isLoading ? 0 : -1}
                  >
                    <span className="@[420px]:hidden">O</span>
                    <span className="hidden @[420px]:inline">Open</span>
                  </button>
                  {!(isSelf && isRunning) && (
                  <button
                    onClick={() => handleAction(project.id, isRunning ? 'stop' : 'start')}
                    disabled={isLoading}
                    className="px-2.5 py-1.5 rounded-lg transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 flex items-center gap-2 justify-center hover:shadow-md hover:scale-[1.02]"
                    style={{
                      backgroundColor: isLoading ? '#333333' : isRunning ? '#3d1515' : '#15332a',
                      color: isLoading ? '#999999' : isRunning ? '#ef4444' : '#10b981',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 'var(--font-weight-semibold)',
                      lineHeight: 'var(--leading-compact)',
                      letterSpacing: 'var(--tracking-ui)',
                      border: isLoading ? '1px solid #444444' : isRunning ? '1px solid #5c2020' : '1px solid #1a4a3a',
                    }}
                    title={isRunning ? '停止' : '啟動'}
                  >
                    {isLoading ? (
                      <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : isRunning ? (
                      <>
                        <span className="@[420px]:hidden">S</span>
                        <span className="hidden @[420px]:inline">Stop</span>
                      </>
                    ) : (
                      <>
                        <span className="@[420px]:hidden">S</span>
                        <span className="hidden @[420px]:inline">Start</span>
                      </>
                    )}
                  </button>
                  )}
                  <button
                    onClick={() => addPanel(project.id, project.displayName || project.name)}
                    className="px-2.5 py-1.5 rounded-lg transition-all duration-200 hover:shadow-md hover:scale-[1.02]"
                    style={{
                      backgroundColor: '#111a22',
                      color: '#999999',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 'var(--font-weight-semibold)',
                      lineHeight: 'var(--leading-compact)',
                      letterSpacing: 'var(--tracking-ui)',
                      border: '1px solid #333333',
                    }}
                    title="開啟 Claude 對話視窗"
                  >
                    <span className="@[420px]:hidden">C</span>
                    <span className="hidden @[420px]:inline">Chat</span>
                  </button>
                  <button
                    onClick={() => handleRemoveFromDev(project)}
                    disabled={isLoading}
                    className="px-1.5 py-1.5 rounded-lg transition-all duration-200 hover:shadow-md hover:scale-[1.02] disabled:opacity-50"
                    style={{
                      backgroundColor: 'var(--background-tertiary)',
                      color: 'var(--text-tertiary)',
                      fontSize: 'var(--text-sm)',
                      lineHeight: 'var(--leading-compact)',
                    }}
                    title="從 Dev Server 移除"
                  >
                    ✕
                  </button>
                </div>
              </div>
              </div>
              </div>
              </div>
            );
          })}
        </div>
      )}

      {projectsWithPort.length === 0 && (
        <p className="text-base text-center py-4" style={{ color: 'var(--text-tertiary)' }}>
          No projects with devPort configured
        </p>
      )}
    </div>
  );
}
