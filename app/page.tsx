import { readJsonFile, flattenProjectsWithChildren } from '@/lib/data';
import type { Project } from '@/lib/types';
import DashboardShell from '@/components/DashboardShell';
import DashboardContent from '@/components/DashboardContent';

export const metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

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
      <DashboardContent
        initialProjects={projects}
        initialCourseFiles={courseFiles}
        initialUtilityTools={utilityTools}
        initialAllProjects={allProjects}
      />
    </DashboardShell>
  );
}
