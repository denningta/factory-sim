import type { ProjectDetail, ProjectSummary } from '@factory-sim/schema';

export interface ProjectsApi {
  listProjects: () => Promise<ProjectSummary[]>;
  createProject: (name: string) => Promise<ProjectDetail>;
  renameProject: (p: ProjectSummary, name: string) => Promise<ProjectSummary>;
  deleteProject: (id: string) => Promise<void>;
}

export function ProjectList(_props: { api: ProjectsApi; onOpen: (id: string) => void }) {
  return null;
}
