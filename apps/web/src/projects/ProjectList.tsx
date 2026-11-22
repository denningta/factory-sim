import { useEffect, useState } from 'react';
import type { ProjectDetail, ProjectSummary } from '@factory-sim/schema';

export interface ProjectsApi {
  listProjects: () => Promise<ProjectSummary[]>;
  createProject: (name: string) => Promise<ProjectDetail>;
  renameProject: (p: ProjectSummary, name: string) => Promise<ProjectSummary>;
  deleteProject: (id: string) => Promise<void>;
}

const message = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

export function ProjectList({
  api,
  onOpen,
  onSignOut,
}: {
  api: ProjectsApi;
  onOpen: (id: string) => void;
  onSignOut?: () => void;
}) {
  void onSignOut; // wired in the implementation commit
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    api.listProjects().then(setProjects, (e: unknown) => setError(message(e)));
  }, [api]);

  const run = async (f: () => Promise<void>) => {
    setError(null);
    try {
      await f();
    } catch (e) {
      setError(message(e));
    }
  };

  const create = () =>
    run(async () => {
      const name = newName.trim();
      if (!name) return;
      const p = await api.createProject(name);
      onOpen(p.id);
    });
  const rename = (p: ProjectSummary, name: string) =>
    run(async () => {
      setRenaming(null);
      if (!name.trim() || name.trim() === p.name) return;
      const updated = await api.renameProject(p, name.trim());
      setProjects((list) => list?.map((x) => (x.id === p.id ? updated : x)) ?? null);
    });
  const remove = (id: string) =>
    run(async () => {
      setDeleting(null);
      await api.deleteProject(id);
      setProjects((list) => list?.filter((x) => x.id !== id) ?? null);
    });

  return (
    <section style={{ maxWidth: 640, margin: '0 auto', padding: 24, font: '14px sans-serif' }}>
      <h1>Projects</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <label>
          New project name{' '}
          <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={200} />
        </label>{' '}
        <button type="submit">Create</button>
      </form>
      {error && (
        <p role="alert" style={{ color: '#b91c1c' }}>
          {error}
        </p>
      )}
      {projects === null ? (
        <p>Loading…</p>
      ) : projects.length === 0 ? (
        <p>No projects yet. Create one above.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {projects.map((p) => (
            <li
              key={p.id}
              style={{ display: 'flex', gap: 8, padding: '8px 0', alignItems: 'center' }}
            >
              {renaming?.id === p.id ? (
                <input
                  aria-label="Project name"
                  autoFocus
                  value={renaming.name}
                  maxLength={200}
                  onChange={(e) => setRenaming({ id: p.id, name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void rename(p, renaming.name);
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                  onBlur={() => setRenaming(null)}
                />
              ) : (
                <strong style={{ flex: 1 }}>{p.name}</strong>
              )}
              <span style={{ color: '#6b7280' }}>{new Date(p.updatedAt).toLocaleString()}</span>
              <button aria-label={`Open ${p.name}`} onClick={() => onOpen(p.id)}>
                Open
              </button>
              <button
                aria-label={`Rename ${p.name}`}
                onClick={() => setRenaming({ id: p.id, name: p.name })}
              >
                Rename
              </button>
              {deleting === p.id ? (
                <>
                  <button aria-label={`Confirm delete ${p.name}`} onClick={() => void remove(p.id)}>
                    Confirm delete
                  </button>
                  <button onClick={() => setDeleting(null)}>Cancel</button>
                </>
              ) : (
                <button aria-label={`Delete ${p.name}`} onClick={() => setDeleting(p.id)}>
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
