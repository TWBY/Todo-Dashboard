'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Project } from '@/lib/types';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { useChatPanels } from '@/contexts/ChatPanelsContext';
import { useBuildPanel } from '@/contexts/BuildPanelContext';
import { useDevServer } from '@/contexts/DevServerContext';
import { formatPort } from '@/lib/format';
import Spinner from '@/components/Spinner';
import { useToast } from '@/contexts/ToastContext';

interface DevServerPanelProps {
  projects: Project[];
  onUpdate?: (project: Project, category: 'projects' | 'courseFiles' | 'utilityTools') => void;
}

export default function DevServerPanel({ projects, onUpdate }: DevServerPanelProps) {
  const { statuses, isInitialLoad, refresh } = useDevServer();
  const { showToast } = useToast();
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [recentlyStarted, setRecentlyStarted] = useState<Record<string, boolean>>({});
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
  const [versionConfig, setVersionConfig] = useState({ development: '', production: '' });

  // 偵測當前瀏覽器 port + runtime 讀取版本
  useEffect(() => {
    setCurrentPort(parseInt(window.location.port) || 80);
    fetch('/api/version').then(r => r.json()).then(setVersionConfig).catch(() => {});
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

  // fetchStatuses is now handled by DevServerContext — use refresh() for on-demand updates
  const fetchStatuses = refresh;

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

  // Check production status on mount
  useEffect(() => {
    checkProdStatus();
  }, [checkProdStatus]);

  const handleProdReload = useCallback(async () => {
    setProdLoading(true);
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch('/api/dev-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 'dashboard', action: 'pm2-restart', pm2AppName: 'todo-dashboard' }),
        signal: ctrl.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      if (res.ok) {
        setProdRunning(true);
        showToast('重啟中，即將重新整理…', 'success');
        // 3秒後淡出，4秒後 hard reload
        setTimeout(() => {
          document.body.classList.add('page-exit');
        }, 3000);
        setTimeout(() => {
          window.location.reload();
        }, 4000);
      } else {
        showToast(data.error || 'Reload 失敗', 'error');
      }
    } catch (error) {
      showToast(
        error instanceof Error && error.name === 'AbortError'
          ? 'Reload 逾時'
          : 'Reload 請求失敗',
        'error',
      );
    } finally {
      setProdLoading(false);
    }
  }, [showToast]);

  // Auto-refresh when projects list changes (e.g., new project added to dev server)
  const prevProjectsLenRef = useRef(projects.length);
  useEffect(() => {
    if (!isInitialLoad && projects.length !== prevProjectsLenRef.current) {
      prevProjectsLenRef.current = projects.length;
      refresh();
    }
  }, [projects.length, isInitialLoad, refresh]);

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
      const aTime = a.devAddedAt || a.updatedAt || '';
      const bTime = b.devAddedAt || b.updatedAt || '';
      return aTime.localeCompare(bTime);
    });

  const getStatus = (projectId: string) => {
    return statuses.find(s => s.projectId === projectId);
  };

  // Pin Todo-Dashboard to top, then split running vs stopped
  const todoDashboard = projectsWithPort.find(p => p.id === 'dashboard');
  const otherProjects = projectsWithPort.filter(p => p.id !== 'dashboard');
  const runningProjects = otherProjects.filter(p => getStatus(p.id)?.isRunning);
  const stoppedProjects = otherProjects.filter(p => !getStatus(p.id)?.isRunning);
  const pinnedRunning = todoDashboard && getStatus(todoDashboard.id)?.isRunning ? [todoDashboard] : [];
  const pinnedStopped = todoDashboard && !getStatus(todoDashboard.id)?.isRunning ? [todoDashboard] : [];

  // Production 自我保護：從 3001 訪問時，不能停止 Production server
  const isProdSelf = currentPort === 3001;

  // 統一按鈕樣式
  const btnBase = 'w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 hover:shadow-md hover:scale-[1.02]';
  const btnStyle = {
    fontSize: 'var(--text-sm)',
    fontWeight: 'var(--font-weight-semibold)' as const,
    lineHeight: 'var(--leading-compact)',
    letterSpacing: 'var(--tracking-ui)',
  };

  const renderProjectRow = (project: Project) => {
    const status = getStatus(project.id);
    const isRunning = status?.isRunning || false;
    const isLoading = loading[project.id] || false;
    const isRemoving = removingIds.has(project.id);
    const isSelf = project.devPort === currentPort;
    const showO = isRunning && !isLoading;
    const showS = !(isSelf && isRunning);

    return (
      <div
        key={project.id}
        className="grid transition-[grid-template-rows] duration-500"
        style={{ gridTemplateRows: isRemoving ? '0fr' : '1fr' }}
      >
        <div className="overflow-hidden min-h-0">
          <div
            className={`py-2 px-3 rounded-[var(--radius-medium)] transition-[opacity,transform] duration-300 ${
              isRemoving ? 'opacity-0 scale-95 -translate-x-4' : ''
            }`}
            style={{ backgroundColor: 'var(--background-secondary)' }}
          >
            {/* Grid: [名稱 1fr] [port] [O] [S] [C] [X] — 固定 4 欄按鈕 */}
            <div className="flex items-center gap-2">
              {/* 左：名稱（truncate） */}
              <span
                className="font-medium text-sm truncate cursor-pointer hover:opacity-70 transition-opacity min-w-0 flex-1"
                onClick={() => copy(project.path)}
                title={project.path}
              >
                {project.displayName || project.name}
              </span>
              {isCopied(project.path) && (
                <span className="text-xs text-green-500 flex-shrink-0">Copied</span>
              )}
              {isLoading && (
                <span className="text-xs px-1.5 py-0.5 rounded-full animate-pulse flex-shrink-0"
                  style={{ backgroundColor: 'rgba(250, 204, 21, 0.2)', color: '#facc15' }}>
                  {isRunning ? '...' : '...'}
                </span>
              )}

              {/* 右：固定 4 欄（O + S + C + X），每欄 w-8 */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* O: Open browser — 佔位或按鈕 */}
                {showO ? (
                  <button
                    onClick={() => handleOpenBrowser(project)}
                    className={btnBase}
                    style={{ backgroundColor: '#222222', color: '#cccccc', border: '1px solid #333333', ...btnStyle }}
                    title="在瀏覽器中開啟"
                  >
                    O
                  </button>
                ) : (
                  <span className="w-8" />
                )}

                {/* S: Start/Stop — 佔位或按鈕 */}
                {showS ? (
                  <button
                    onClick={() => handleAction(project.id, isRunning ? 'stop' : 'start')}
                    disabled={isLoading}
                    className={`${btnBase} disabled:cursor-not-allowed disabled:opacity-60`}
                    style={{
                      backgroundColor: isLoading ? '#333333' : isRunning ? '#3d1515' : '#15332a',
                      color: isLoading ? '#999999' : isRunning ? '#ef4444' : '#10b981',
                      border: isLoading ? '1px solid #444444' : isRunning ? '1px solid #5c2020' : '1px solid #1a4a3a',
                      ...btnStyle,
                    }}
                    title={isRunning ? '停止' : '啟動'}
                  >
                    {isLoading ? <Spinner /> : 'S'}
                  </button>
                ) : (
                  <span className="w-8" />
                )}

                {/* C: Claude chat */}
                <button
                  onClick={() => addPanel(project.id, project.displayName || project.name)}
                  className={btnBase}
                  style={{ backgroundColor: '#111a22', color: '#999999', border: '1px solid #333333', ...btnStyle }}
                  title="開啟 Claude 對話視窗"
                >
                  C
                </button>

                {/* X: Remove */}
                <button
                  onClick={() => handleRemoveFromDev(project)}
                  disabled={isLoading}
                  className={`${btnBase} disabled:opacity-50`}
                  style={{ backgroundColor: 'var(--background-tertiary)', color: 'var(--text-tertiary)', ...btnStyle }}
                  title="離開 Station"
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative">
      <div ref={headerBtnsRef} className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <span
            className="cursor-pointer hover:opacity-70 transition-opacity"
            onClick={() => copy('Station')}
            title="點擊複製名稱"
          >
            Station
          </span>
          {currentPort === 3002 && versionConfig.development && (
            <span
              className="text-xs font-mono px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
              title="Development 版本"
            >
              Dev {versionConfig.development}
            </span>
          )}
          {currentPort === 3001 && versionConfig.production && (
            <span
              className="text-xs font-mono px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}
              title="Production 版本"
            >
              Prod {versionConfig.production}
            </span>
          )}
          {isCopied('Station') && (
            <span className="text-sm text-green-500">Copied</span>
          )}
        </h2>
        <div className="flex items-center gap-1.5">
          <span className="w-8" />
          <button
            onClick={handleProdReload}
            disabled={prodLoading}
            className={`${btnBase} disabled:opacity-60 disabled:cursor-not-allowed`}
            style={{ backgroundColor: '#1f2937', color: '#9ca3af', border: '1px solid #374151', ...btnStyle }}
            title="重新啟動 Production 3001"
          >
            {prodLoading ? <Spinner /> : 'R'}
          </button>
          <button
            onClick={toggleBuildPanel}
            className={btnBase}
            style={{ backgroundColor: '#332815', color: '#f59e0b', border: '1px solid #4a3520', ...btnStyle }}
            title="版本升級與打包流程"
          >
            P
          </button>
          <button
            onClick={() => router.push('/changelog')}
            className={btnBase}
            style={{ backgroundColor: '#1f1533', color: '#a78bfa', border: '1px solid #3b2663', ...btnStyle }}
            title="版本歷史"
          >
            L
          </button>
        </div>
      </div>

      {isInitialLoad ? (
        <div className="space-y-1">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="p-3 rounded-lg animate-pulse"
              style={{ backgroundColor: 'var(--background-secondary)' }}
            >
              <div className="flex items-center gap-3">
                <div className="h-4 rounded flex-1" style={{ backgroundColor: 'var(--background-tertiary)' }} />
                <div className="h-8 w-8 rounded-lg" style={{ backgroundColor: 'var(--background-tertiary)' }} />
                <div className="h-8 w-8 rounded-lg" style={{ backgroundColor: 'var(--background-tertiary)' }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {pinnedRunning.map(p => renderProjectRow(p))}
          {runningProjects.map(p => renderProjectRow(p))}
          {[...pinnedStopped, ...stoppedProjects].map(p => renderProjectRow(p))}
        </div>
      )}

      {projectsWithPort.length === 0 && !isInitialLoad && (
        <p className="text-xs text-center py-4" style={{ color: 'var(--text-tertiary)' }}>
          Station 目前沒有進駐的專案
        </p>
      )}
    </div>
  );
}
