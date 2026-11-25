import { useCallback, useEffect, useState } from 'react';
import type { User } from '@factory-sim/schema';
import { api } from './api/client';
import { AccountPage } from './auth/AccountPage';
import { SignIn } from './auth/SignIn';
import { ProjectEditor } from './projects/ProjectEditor';
import { parseHash } from './projects/shell';
import { ProjectList, type ProjectsApi } from './projects/ProjectList';

const projectsApi: ProjectsApi = {
  listProjects: api.listProjects,
  createProject: api.createProject,
  renameProject: (p, name) => api.updateProject(p.id, { name, baseRevision: p.revision }),
  deleteProject: api.deleteProject,
};

const idFromHash = () => parseHash(location.hash)?.id ?? null;

/** Shell: sign in → project list → editor. The open project lives in the URL hash so reload keeps it. */
export function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [openId, setOpenId] = useState(idFromHash);
  const [account, setAccount] = useState(false);

  useEffect(() => {
    api.session().then(setUser, async () => {
      setNeedsSetup(await api.setupNeeded().catch(() => false));
      setUser(null);
    });
  }, []);
  useEffect(() => {
    const onHash = () => setOpenId(idFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const open = useCallback((id: string | null) => {
    location.hash = id ? `#/p/${id}` : '';
  }, []);

  if (user === undefined) return <p style={{ font: '14px sans-serif', padding: 16 }}>Loading…</p>;
  if (user === null) return <SignIn needsSetup={needsSetup} onSignedIn={setUser} />;
  if (account) return <AccountPage user={user} onBack={() => setAccount(false)} />;
  if (openId) return <ProjectEditor key={openId} id={openId} onClose={() => open(null)} />;
  return (
    <ProjectList
      api={projectsApi}
      onOpen={open}
      onAccount={() => setAccount(true)}
      onSignOut={() =>
        void api.logout().finally(() => {
          setAccount(false);
          setUser(null);
        })
      }
    />
  );
}
