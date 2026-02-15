'use client';

import { useState } from 'react';
import type { Project } from '@/lib/types';

import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { formatPort } from '@/lib/format';

interface DirectoryTreeProps {
  projects: Project[];
  basePath: string;
  title: string;
  onUpdate?: (project: Project) => void;
}

type TreeEntry =
  | { type: 'project'; project: Project }
  | { type: 'group'; name: string; description: string; projects: Project[] };

function buildTreeEntries(projects: Project[]): TreeEntry[] {
  const groups = new Map<string, { description: string; projects: Project[] }>();
  const entries: TreeEntry[] = [];

  for (const p of projects) {
    if (p.group) {
      if (!groups.has(p.group)) {
        groups.set(p.group, { description: p.groupDescription || '', projects: [] });
      }
      groups.get(p.group)!.projects.push(p);
    } else {
      entries.push({ type: 'project', project: p });
    }
  }

  for (const [name, data] of groups) {
    data.projects.sort((a, b) => a.name.localeCompare(b.name));
    entries.push({ type: 'group', name, description: data.description, projects: data.projects });
  }

  entries.sort((a, b) => {
    const nameA = a.type === 'project' ? a.project.name : a.name;
    const nameB = b.type === 'project' ? b.project.name : b.name;
    return nameA.localeCompare(nameB);
  });

  return entries;
}

function TreePrefix({ ancestors }: { ancestors: boolean[] }) {
  let prefix = '';
  for (let i = 0; i < ancestors.length - 1; i++) {
    prefix += ancestors[i] ? '    ' : '│   ';
  }
  if (ancestors.length > 0) {
    prefix += ancestors[ancestors.length - 1] ? '└── ' : '├── ';
  }
  return <span style={{ color: 'var(--text-tertiary)' }}>{prefix}</span>;
}

function DevPortBadge({ projectId, childName, devPort: existingPort, onAdded }: {
  projectId: string;
  childName?: string;
  devPort?: number;
  onAdded: (port: number, devAddedAt?: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [assignedPort, setAssignedPort] = useState<number | null>(null);
  const [fadeIn, setFadeIn] = useState(false);

  const port = existingPort || assignedPort;

  if (port) {
    return (
      <span
        className={`text-sm font-mono px-1.5 py-0.5 rounded transition-opacity duration-300 ${fadeIn ? 'opacity-100' : 'opacity-0'}`}
        style={{ backgroundColor: 'var(--background-tertiary)', color: 'var(--text-tertiary)' }}
        onAnimationEnd={() => setFadeIn(true)}
      >
        {formatPort(port)}
      </span>
    );
  }

  const handleAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, childName, action: 'add-to-dev' }),
      });
      if (res.ok) {
        const data = await res.json();
        setAssignedPort(data.devPort);
        setFadeIn(true);
        onAdded(data.devPort, data.devAddedAt);
      }
    } catch (error) {
      console.error('Failed to add project:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleAdd}
      disabled={loading}
      className="text-sm px-1.5 py-0.5 rounded transition-all duration-200 hover:scale-110 disabled:opacity-50"
      style={{
        backgroundColor: 'var(--background-tertiary)',
        color: 'var(--text-tertiary)',
      }}
      title="加入 Dev Server"
    >
      {loading ? (
        <svg className="animate-spin h-3 w-3 inline-block" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        '+'
      )}
    </button>
  );
}

function ChildrenList({ project, ancestorPrefix, showDescription, copy, isCopied, onAdded }: {
  project: Project;
  ancestorPrefix: boolean[];
  showDescription?: boolean;
  copy: (text: string) => void;
  isCopied: (text: string) => boolean;
  onAdded: (projectId: string, childName: string | undefined, port: number, devAddedAt?: string) => void;
}) {
  if (!project.children || project.children.length === 0) return null;
  return (
    <div>
      {project.children.map((child, j) => {
        const isChildLast = j === project.children!.length - 1;
        const childPath = `${project.path}/${child.name}`;
        return (
          <div key={child.name} className="flex items-center gap-2">
            <TreePrefix ancestors={[...ancestorPrefix, isChildLast]} />
            <span
              className="cursor-pointer hover:opacity-70 transition-opacity"
              onClick={() => copy(childPath)}
              style={{ color: 'var(--text-secondary)' }}
              title="點擊複製路徑"
            >
              {child.name}/
              {isCopied(childPath) && (
                <span className="ml-2 text-sm text-green-500">已複製！</span>
              )}
            </span>
            <DevPortBadge
              projectId={project.id}
              childName={child.name}
              devPort={child.devPort}
              onAdded={(port, devAddedAt) => onAdded(project.id, child.name, port, devAddedAt)}
            />
            {showDescription && child.description && (
              <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                {child.description}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function DirectoryTree({ projects, basePath, title, onUpdate }: DirectoryTreeProps) {
  const entries = buildTreeEntries(projects);
  const { copy, isCopied } = useCopyToClipboard();

  const handleAdded = (projectId: string, childName: string | undefined, port: number, devAddedAt?: string) => {
    if (!onUpdate) return;

    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    if (childName) {
      // 更新子專案的 devPort
      const updatedChildren = project.children?.map(child =>
        child.name === childName ? { ...child, devPort: port, devAddedAt } : child
      );
      onUpdate({ ...project, children: updatedChildren });
    } else {
      // 更新專案本身的 devPort
      onUpdate({ ...project, devPort: port, devAddedAt });
    }
  };

  return (
    <div
      className=""
    >
      <div className="flex items-center gap-2 mb-4">
        <h2
          className="font-semibold text-lg cursor-pointer hover:opacity-70 transition-opacity"
          onClick={() => copy(title)}
          title="點擊複製名稱"
        >
          {title}
        </h2>
        {isCopied(title) && (
          <span className="text-sm text-green-500">已複製！</span>
        )}
      </div>
      <div className="font-mono text-base leading-7">
      {entries.map((entry, i) => {
        const isLast = i === entries.length - 1;

        if (entry.type === 'project') {
          const { project } = entry;
          return (
            <div key={project.id}>
              <div className="flex items-center gap-2">
                <TreePrefix ancestors={[isLast]} />
                <span
                  className="font-medium cursor-pointer hover:opacity-70 transition-opacity relative"
                  onClick={() => copy(project.path)}
                  title="點擊複製路徑"
                >
                  {project.displayName || project.name}/
                  {isCopied(project.path) && (
                    <span className="ml-2 text-sm text-green-500">已複製！</span>
                  )}
                </span>
                <DevPortBadge
                  projectId={project.id}
                  devPort={project.devPort}
                  onAdded={(port, devAddedAt) => handleAdded(project.id, undefined, port, devAddedAt)}
                />
              </div>
              <ChildrenList project={project} ancestorPrefix={[isLast]} copy={copy} isCopied={isCopied} onAdded={handleAdded} />
            </div>
          );
        }

        // group entry
        const groupPath = `${basePath}${entry.name}`;
        return (
          <div key={entry.name}>
            <div className="flex items-center gap-2">
              <TreePrefix ancestors={[isLast]} />
              <span
                className="font-medium cursor-pointer hover:opacity-70 transition-opacity"
                onClick={() => copy(groupPath)}
                title="點擊複製路徑"
              >
                {entry.name}/
                {isCopied(groupPath) && (
                  <span className="ml-2 text-sm text-green-500">已複製！</span>
                )}
              </span>
            </div>
            {entry.projects.map((project, pi) => {
              const isProjectLast = pi === entry.projects.length - 1;
              return (
                <div key={project.id}>
                  <div className="flex items-center gap-2">
                    <TreePrefix ancestors={[isLast, isProjectLast]} />
                    <span
                      className="font-medium cursor-pointer hover:opacity-70 transition-opacity"
                      onClick={() => copy(project.path)}
                      title="點擊複製路徑"
                    >
                      {project.displayName || project.name}/
                      {isCopied(project.path) && (
                        <span className="ml-2 text-sm text-green-500">已複製！</span>
                      )}
                    </span>
                    <DevPortBadge
                      projectId={project.id}
                      devPort={project.devPort}
                      onAdded={(port, devAddedAt) => handleAdded(project.id, undefined, port, devAddedAt)}
                    />
                  </div>
                  <ChildrenList project={project} ancestorPrefix={[isLast, isProjectLast]} showDescription copy={copy} isCopied={isCopied} onAdded={handleAdded} />
                </div>
              );
            })}
          </div>
        );
      })}
      </div>
    </div>
  );
}
