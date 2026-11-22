import { buildServer } from './server';

const port = Number(process.env.PORT ?? 8080);
await buildServer().listen({ port, host: '0.0.0.0' });
console.log(`api listening on :${port}`);
