import { describe, expect, it } from 'vitest';
import { loadEnv } from './env';

const valid = {
  PORT: '8080',
  DATABASE_URL: 'postgres://u:p@postgres:5432/db',
  SESSION_SECRET: 'a-real-random-secret-value',
};

describe('loadEnv', () => {
  it('AC1: accepts a valid environment and parses PORT as a number', () => {
    expect(loadEnv(valid)).toEqual({
      port: 8080,
      databaseUrl: valid.DATABASE_URL,
      sessionSecret: valid.SESSION_SECRET,
    });
  });

  it('AC1: PORT defaults to 8080 when unset', () => {
    const { PORT: _port, ...rest } = valid;
    expect(loadEnv(rest).port).toBe(8080);
  });

  it.each(['', 'abc', '0', '70000', '80.5'])('AC1: refuses PORT=%j', (PORT) => {
    expect(() => loadEnv({ ...valid, PORT })).toThrow(/PORT/);
  });

  it('AC1: refuses a missing or empty DATABASE_URL', () => {
    const { DATABASE_URL: _d, ...rest } = valid;
    expect(() => loadEnv(rest)).toThrow(/DATABASE_URL/);
    expect(() => loadEnv({ ...valid, DATABASE_URL: '' })).toThrow(/DATABASE_URL/);
  });

  it('AC1: refuses a missing or empty SESSION_SECRET', () => {
    const { SESSION_SECRET: _s, ...rest } = valid;
    expect(() => loadEnv(rest)).toThrow(/SESSION_SECRET/);
    expect(() => loadEnv({ ...valid, SESSION_SECRET: '' })).toThrow(/SESSION_SECRET/);
  });

  it('AC1: refuses the .env.example SESSION_SECRET placeholder', () => {
    expect(() =>
      loadEnv({ ...valid, SESSION_SECRET: 'change-me-to-a-long-random-string' }),
    ).toThrow(/SESSION_SECRET.*placeholder/);
  });
});
