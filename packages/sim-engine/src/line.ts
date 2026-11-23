import type { CompileLine, CreateRun, LineModel } from './line-api';
import { compile, type CompiledLine } from './line-compile';
import { startRun } from './line-run';

/** Only real `compileLine` results map to a compiled line, so a forged model is rejected. */
const compiled = new WeakMap<LineModel, CompiledLine>();

export const compileLine: CompileLine = (project) => {
  const { line, issues } = compile(project);
  if (!line) return { ok: false, issues };
  const model = Object.freeze({}) as LineModel;
  compiled.set(model, line);
  return { ok: true, model, warnings: [] };
};

export const createRun: CreateRun = (model, options) => {
  const line = compiled.get(model);
  if (!line) throw new Error('createRun: the model must come from compileLine');
  return startRun(line, options);
};
