'use client';

import { useState, useCallback, useMemo } from 'react';
import type { Project } from '@/lib/types';
import DevServerPanel from './DevServerPanel';
import ScratchPad from './ScratchPad';
import { MemoryCpuBar } from './SystemStatusBar';
import ResizableLayout from './ResizableLayout';
import { ProcessKillButtons } from './MemoryWarningBanner';

interface DashboardContentProps {
  initialProjects: Project[];
  initialCourseFiles: Project[];
  initialUtilityTools: Project[];
  initialAllProjects: Project[];
}

// Client-safe version of flattenProjectsWithChildren
function flattenProjects(projects: Project[]): Project[] {
  const result: Project[] = [];
  for (const p of projects) {
    result.push(p);
    if (p.children) {
      for (const child of p.children) {
        if (child.devPort) {
          result.push({
            ...p,
            id: `${p.id}::${child.name}`,
            name: child.name,
            displayName: child.name,
            path: `${p.path}/${child.name}`,
            devPort: child.devPort,
            devAddedAt: child.devAddedAt,
          });
        }
      }
    }
  }
  return result;
}


export default function DashboardContent({
  initialProjects,
  initialCourseFiles,
  initialUtilityTools,
}: DashboardContentProps) {
  const [projects, setProjects] = useState(initialProjects);
  const [courseFiles, setCourseFiles] = useState(initialCourseFiles);
  const [utilityTools, setUtilityTools] = useState(initialUtilityTools);

  const allProjects = useMemo(
    () => flattenProjects([...projects, ...courseFiles, ...utilityTools]),
    [projects, courseFiles, utilityTools]
  );

  const updateProject = useCallback((updatedProject: Project, category: 'projects' | 'courseFiles' | 'utilityTools') => {
    const setState = category === 'projects' ? setProjects : category === 'courseFiles' ? setCourseFiles : setUtilityTools;

    setState(prev => prev.map(p => {
      if (p.id === updatedProject.id) {
        return updatedProject;
      }
      if (p.children) {
        const updatedChildren = p.children.map(child => {
          if (child.name === updatedProject.name) {
            return { ...child, devPort: updatedProject.devPort };
          }
          return child;
        });
        if (JSON.stringify(updatedChildren) !== JSON.stringify(p.children)) {
          return { ...p, children: updatedChildren };
        }
      }
      return p;
    }));
  }, []);

  return (
    <ResizableLayout
      left={
        <div className="animate-fade-in flex flex-col h-full">
          {/* Quick Actions: ScratchPad */}
          <div className="flex-shrink-0">
            <ScratchPad />
          </div>

          {/* Main: Dev Server panel (fills remaining space) */}
          <div className="flex-1 min-h-0 overflow-y-auto mt-3">
            <DevServerPanel projects={allProjects} onUpdate={updateProject} />
          </div>

          {/* Bottom: Memory/CPU + Process Kill Buttons */}
          <div className="flex-shrink-0 space-y-2 mt-3">
            <MemoryCpuBar />
            <ProcessKillButtons />
          </div>
        </div>
      }
    />
  );
}
