/**
 * Discrete-event simulation engine (ADR-0007, ADR-0008).
 * The public API is `./api` plus the factories below; their signatures are fixed by the
 * lead. Builders implement them in the modules they import from.
 * No DOM, Node or rendering dependencies: runs in a Web Worker and in worker threads.
 */
export type * from './api';
export type * from './line-api';
export { createSimulation } from './simulation';
export { createRng } from './rng';
export { compileLine, createRun } from './line';
