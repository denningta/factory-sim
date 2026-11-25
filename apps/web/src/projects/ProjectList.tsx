import { useEffect, useState } from 'react';
import type { ProjectDetail, ProjectSummary } from '@factory-sim/schema';
import { Button, EmptyState, Field, ThemeToggle } from '../ui';
import styles from './projects.module.css';

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
  onAccount,
}: {
  api: ProjectsApi;
  onOpen: (id: string) => void;
  onSignOut?: () => void;
  onAccount?: () => void;
}) {
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
    <section className={styles.page}>
      <header className={styles.pageHeader}>
        <h1 className={styles.title}>Projects</h1>
        <span className={styles.actions}>
          <ThemeToggle />
          {onAccount && <Button onClick={onAccount}>Account</Button>}
          {onSignOut && <Button onClick={onSignOut}>Sign out</Button>}
        </span>
      </header>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
        className={styles.create}
      >
        <Field label="New project name" value={newName} onChange={setNewName} maxLength={200} />
        <Button type="submit" variant="primary">
          Create
        </Button>
      </form>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {projects === null ? (
        <p>Loading…</p>
      ) : projects.length === 0 ? (
        <EmptyState title="No projects yet">Create one above.</EmptyState>
      ) : (
        <ul className={styles.list}>
          {projects.map((p) => (
            <li key={p.id} className={styles.row}>
              {renaming?.id === p.id ? (
                <input
                  aria-label="Project name"
                  className={styles.nameInput}
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
                <strong className={styles.name}>{p.name}</strong>
              )}
              <span className={styles.when}>{new Date(p.updatedAt).toLocaleString()}</span>
              <Button aria-label={`Open ${p.name}`} onClick={() => onOpen(p.id)}>
                Open
              </Button>
              <Button
                aria-label={`Rename ${p.name}`}
                onClick={() => setRenaming({ id: p.id, name: p.name })}
              >
                Rename
              </Button>
              {deleting === p.id ? (
                <>
                  <Button
                    variant="danger"
                    aria-label={`Confirm delete ${p.name}`}
                    onClick={() => void remove(p.id)}
                  >
                    Confirm delete
                  </Button>
                  <Button onClick={() => setDeleting(null)}>Cancel</Button>
                </>
              ) : (
                <Button
                  variant="danger"
                  aria-label={`Delete ${p.name}`}
                  onClick={() => setDeleting(p.id)}
                >
                  Delete
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
