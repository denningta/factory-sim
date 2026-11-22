import type { z } from 'zod';

export type ParseResult<T> = { ok: true; project: T } | { ok: false; error: string };

/** Converts a document of version N into version N + 1. Works on plain JSON. */
export type UpgradeStep = (doc: Record<string, unknown>) => unknown;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((acc, key) => {
    if (typeof key === 'number') return `${acc}[${key}]`;
    return acc ? `${acc}.${String(key)}` : String(key);
  }, '');
}

/** One line per problem, each prefixed with the field path, e.g. `floor.width: ...`. */
export function formatIssues(issues: readonly z.core.$ZodIssue[]): string {
  const lines = issues.map(
    (issue) => `- ${formatPath(issue.path) || '(document)'}: ${issue.message}`,
  );
  return ['Invalid project document:', ...lines].join('\n');
}

export function validate<T>(schema: z.ZodType<T>, input: unknown): ParseResult<T> {
  const result = schema.safeParse(input);
  return result.success
    ? { ok: true, project: result.data }
    : { ok: false, error: formatIssues(result.error.issues) };
}

/**
 * Builds a loader that walks a document up the version chain one step at a time,
 * then validates it against the current schema. Steps are keyed by the version they
 * upgrade *from*, so adding version N + 1 means adding `steps[N]` and nothing else.
 */
export function createUpgrader<T>(options: {
  currentVersion: number;
  schema: z.ZodType<T>;
  steps: Readonly<Record<number, UpgradeStep>>;
}): (input: unknown) => ParseResult<T> {
  const { currentVersion, schema, steps } = options;

  return (input) => {
    if (!isRecord(input)) return { ok: false, error: 'Project document must be a JSON object' };

    // Documents are JSON, so a JSON round-trip is a complete deep copy; it keeps a
    // careless step from mutating the caller's object.
    let doc: Record<string, unknown> = JSON.parse(JSON.stringify(input)) as Record<string, unknown>;
    const declared = doc.schemaVersion;
    if (typeof declared !== 'number' || !Number.isInteger(declared)) {
      return validate(schema, doc);
    }
    let version: number = declared;
    if (version > currentVersion) {
      return {
        ok: false,
        error: `This project was saved by a newer version of the app (schema version ${version}; this version supports up to ${currentVersion}). Update the app to open it.`,
      };
    }

    while (version < currentVersion) {
      const step = steps[version];
      if (!step) return { ok: false, error: `No upgrade step from schema version ${version}` };
      let next: unknown;
      try {
        next = step(doc);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        return { ok: false, error: `Upgrade from schema version ${version} failed: ${reason}` };
      }
      const nextVersion = isRecord(next) ? next.schemaVersion : undefined;
      if (!isRecord(next) || nextVersion !== version + 1) {
        return {
          ok: false,
          error: `Upgrade step from schema version ${version} produced version ${String(nextVersion)}, expected ${version + 1}`,
        };
      }
      doc = next;
      version += 1;
    }

    return validate(schema, doc);
  };
}
