import { describe, expect, it } from 'vitest';
import { testApp } from './test-app';

describe('OpenAPI', () => {
  it('AC4: the generated document describes the auth and user routes from the shared schemas', async () => {
    const t = await testApp();
    const doc = (await t.call('GET', '/api/openapi.json')).json();
    expect(doc.openapi).toMatch(/^3\./);
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining([
        '/api/auth/setup',
        '/api/auth/login',
        '/api/auth/logout',
        '/api/auth/session',
        '/api/users',
        '/api/users/{id}',
      ]),
    );
    const login = doc.paths['/api/auth/login'].post;
    expect(login.requestBody.content['application/json'].schema.properties).toHaveProperty('email');
  });

  it('SC-1: the generated document describes the project routes', async () => {
    const t = await testApp();
    const doc = (await t.call('GET', '/api/openapi.json')).json();
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining(['/api/projects', '/api/projects/{id}']),
    );
    expect(Object.keys(doc.paths['/api/projects/{id}'])).toEqual(
      expect.arrayContaining(['get', 'patch', 'delete']),
    );
  });

  it('EQ-3: the generated document describes the equipment library routes', async () => {
    const t = await testApp();
    const doc = (await t.call('GET', '/api/openapi.json')).json();
    expect(Object.keys(doc.paths['/api/equipment-types'])).toEqual(
      expect.arrayContaining(['get', 'post']),
    );
    expect(Object.keys(doc.paths['/api/equipment-types/{id}'])).toEqual(
      expect.arrayContaining(['put', 'delete']),
    );
  });
});
