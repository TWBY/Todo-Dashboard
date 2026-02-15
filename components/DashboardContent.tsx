'use client';

import { useState, useCallback, useMemo } from 'react';
import type { Project } from '@/lib/types';
import DirectoryTree from './DirectoryTree';
import ArchitectureOverview from './ArchitectureOverview';
import SkillArchitecture from './SkillArchitecture';
import DevServerPanel from './DevServerPanel';
import ScratchPad from './ScratchPad';
import ClaudeUsagePanel from './ClaudeUsagePanel';
import ResizableLayout from './ResizableLayout';
import MemoryWarningBanner from './MemoryWarningBanner';

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

  // 動態計算 allProjects（當 projects/courseFiles/utilityTools 變更時自動更新）
  const allProjects = useMemo(
    () => flattenProjects([...projects, ...courseFiles, ...utilityTools]),
    [projects, courseFiles, utilityTools]
  );

  // 樂觀更新專案資料
  const updateProject = useCallback((updatedProject: Project, category: 'projects' | 'courseFiles' | 'utilityTools') => {
    const setState = category === 'projects' ? setProjects : category === 'courseFiles' ? setCourseFiles : setUtilityTools;

    setState(prev => prev.map(p => {
      if (p.id === updatedProject.id) {
        return updatedProject;
      }
      // 處理 children
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
        <div className="animate-fade-in space-y-6 pb-12">
          <ScratchPad />
          <hr className="border-0 h-px" style={{ backgroundColor: 'var(--border-color)' }} />
          <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(400px, 100%), 1fr))' }}>
            <DevServerPanel projects={allProjects} onUpdate={updateProject} />
            <div className="space-y-4">
              <ClaudeUsagePanel />
              <MemoryWarningBanner />
            </div>
          </div>
          <hr className="border-0 h-px" style={{ backgroundColor: 'var(--border-color)' }} />
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            <DirectoryTree
              projects={projects}
              basePath="/Users/ruanbaiye/Documents/Brickverse/"
              title="Brickverse Projects"
              onUpdate={(updated) => updateProject(updated, 'projects')}
            />
            <DirectoryTree
              projects={courseFiles}
              basePath="/Users/ruanbaiye/Documents/Brickverse/CourseFiles/"
              title="CourseFiles"
              onUpdate={(updated) => updateProject(updated, 'courseFiles')}
            />
            <DirectoryTree
              projects={utilityTools}
              basePath="/Users/ruanbaiye/Documents/UtilityTools/"
              title="UtilityTools"
              onUpdate={(updated) => updateProject(updated, 'utilityTools')}
            />
          </div>

          <hr className="border-0 h-px" style={{ backgroundColor: 'var(--border-color)' }} />
          <SkillArchitecture />

          <hr className="border-0 h-px" style={{ backgroundColor: 'var(--border-color)' }} />
          <div>
            <h2 className="text-lg font-semibold mb-4">架構關係</h2>
            <ArchitectureOverview />
          </div>
        </div>
      }
    />
  );
}
