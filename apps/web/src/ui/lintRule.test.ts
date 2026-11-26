// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';

const root = new URL('../../../../', import.meta.url).pathname.replace(/\/$/, '');
const file = (dir: string, name: string) => `${root}/apps/web/src/${dir}/${name}`;
const eslint = new ESLint({ cwd: root });
const code = `export const A = () => <div style={{ color: 'red' }} />;\n`;
const lint = async (dir: string) => {
  const [r] = await eslint.lintText(code, {
    filePath: file(dir, 'X.tsx'),
  });
  return r!.messages.filter((m) => m.ruleId === 'no-restricted-syntax');
};

describe(
  'UI-1 AC4: lint forbids style= on DOM elements in migrated directories',
  { timeout: 30_000 },
  () => {
    it.each(['ui', 'auth', 'projects', 'products', 'layout', 'equipment', 'technicians'])(
      'rejects style in %s/',
      async (dir) => {
        const m = await lint(dir);
        expect(m).toHaveLength(1);
        expect(m[0]!.message).toMatch(/style/i);
      },
    );

    it('leaves directories that are not migrated yet alone', async () => {
      expect(await lint('simulation')).toEqual([]);
    });

    it('allows style on a component (only DOM elements are restricted)', async () => {
      const [r] = await eslint.lintText(`export const A = () => <Thing style={{ a: 1 }} />;\n`, {
        filePath: file('ui', 'Y.tsx'),
      });
      expect(r!.messages.filter((m) => m.ruleId === 'no-restricted-syntax')).toEqual([]);
    });
  },
);
