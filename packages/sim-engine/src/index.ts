/**
 * Discrete-event simulation engine (ADR-0007, ADR-0008).
 * The lead defines the public API before SE-1; builders implement behind it.
 * No DOM, Node or rendering dependencies: runs in a Web Worker and in worker threads.
 */
export const PACKAGE_NAME = '@factory-sim/sim-engine';
