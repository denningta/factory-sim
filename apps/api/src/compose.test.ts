import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

interface Service {
  restart?: string;
  ports?: string[];
  healthcheck?: { test?: string[] };
  depends_on?: Record<string, { condition?: string }>;
}
const file = fileURLToPath(new URL('../../../docker-compose.yml', import.meta.url));
const compose = parse(readFileSync(file, 'utf8')) as {
  services: Record<string, Service>;
  volumes?: Record<string, unknown>;
};

describe('docker-compose.yml', () => {
  it('AC1: defines app and postgres, publishing the app on APP_PORT', () => {
    expect(Object.keys(compose.services).sort()).toEqual(['app', 'postgres']);
    expect(compose.services.app?.ports?.join()).toContain('${APP_PORT');
  });

  it('AC1: postgres data lives in a named volume', () => {
    expect(Object.keys(compose.volumes ?? {})).toHaveLength(1);
  });

  it('AC2: postgres has a healthcheck and the app waits for it to be healthy', () => {
    expect(compose.services.postgres?.healthcheck?.test?.join(' ')).toContain('pg_isready');
    expect(compose.services.app?.depends_on?.postgres?.condition).toBe('service_healthy');
  });

  it('AC3: both containers restart automatically after a host reboot', () => {
    for (const name of ['app', 'postgres']) {
      expect(['always', 'unless-stopped']).toContain(compose.services[name]?.restart);
    }
  });
});
