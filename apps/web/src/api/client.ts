import type {
  ApiErrorCode,
  ProjectDetail,
  ProjectSummary,
  UpdateProjectRequest,
} from '@factory-sim/schema';

export class ApiRequestError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const notImplemented = (): never => {
  throw new Error('not implemented');
};

export const api = {
  listProjects: async (): Promise<ProjectSummary[]> => notImplemented(),
  createProject: async (_name: string): Promise<ProjectDetail> => notImplemented(),
  getProject: async (_id: string): Promise<ProjectDetail> => notImplemented(),
  updateProject: async (_id: string, _req: UpdateProjectRequest): Promise<ProjectSummary> =>
    notImplemented(),
  deleteProject: async (_id: string): Promise<void> => notImplemented(),
};
