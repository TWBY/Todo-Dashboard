import { readJsonFile, flattenProjectsWithChildren } from '@/lib/data';
import type { Project } from '@/lib/types';
import DirectoryTree from '@/components/DirectoryTree';
import ArchitectureOverview from '@/components/ArchitectureOverview';
import SkillArchitecture from '@/components/SkillArchitecture';
import DevServerPanel from '@/components/DevServerPanel';
import ScratchPad from '@/components/ScratchPad';
import ClaudeUsagePanel from '@/components/ClaudeUsagePanel';
import ResizableLayout from '@/components/ResizableLayout';
import DashboardShell from '@/components/DashboardShell';
import MemoryWarningBanner from '@/components/MemoryWarningBanner';


export const metadata = { title: 'Brickverse Dashboard' };

export default async function DashboardPage() {
  const projects = await readJsonFile<Project>('projects.json');
  projects.sort((a, b) => a.name.localeCompare(b.name));

  const courseFiles = await readJsonFile<Project>('coursefiles.json');
  courseFiles.sort((a, b) => a.name.localeCompare(b.name));

  const utilityTools = await readJsonFile<Project>('utility-tools.json');
  utilityTools.sort((a, b) => a.name.localeCompare(b.name));

  const allProjects = flattenProjectsWithChildren([...projects, ...courseFiles, ...utilityTools]);

  return (
    <DashboardShell>
      <ResizableLayout
        left={
          <div className="animate-fade-in space-y-6 pb-12">
            <ScratchPad />
            <hr className="border-0 h-px" style={{ backgroundColor: 'var(--border-color)' }} />
            <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(400px, 100%), 1fr))' }}>
              <DevServerPanel projects={allProjects} />
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
              />
              <DirectoryTree
                projects={courseFiles}
                basePath="/Users/ruanbaiye/Documents/Brickverse/CourseFiles/"
                title="CourseFiles"
              />
              <DirectoryTree
                projects={utilityTools}
                basePath="/Users/ruanbaiye/Documents/UtilityTools/"
                title="UtilityTools"
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
    </DashboardShell>
  );
}
