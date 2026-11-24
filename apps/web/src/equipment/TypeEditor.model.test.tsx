import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BASE_EQUIPMENT_TYPES } from '@factory-sim/schema';
import { MODELS, modelsFor, resolveModel } from './models/registry';
import { TypeEditor } from './TypeEditor';

// The real preview needs WebGL; this one shows which model it was asked to draw.
vi.mock('./EquipmentModel', () => ({
  ModelPreview: ({ type }: { type: { behavior: 'workstation'; model?: string } }) => (
    <div data-testid="model-preview" data-model={resolveModel(type).id} />
  ),
}));

afterEach(cleanup);

const picker = () => screen.getByLabelText(/3d model/i) as HTMLSelectElement;
const optionValues = () =>
  within(picker())
    .getAllByRole('option')
    .map((o) => (o as HTMLOptionElement).value);

describe('UI-7 AC6: the type editor offers a model picker', () => {
  it('lists only registry models that suit the behavior, plus the behavior default', async () => {
    render(<TypeEditor unit="m" onSave={() => {}} onCancel={() => {}} />);
    for (const b of ['workstation', 'buffer', 'conveyor'] as const) {
      await userEvent.selectOptions(screen.getByLabelText(/base behavior/i), b);
      expect(optionValues()).toEqual(['', ...modelsFor(b).map((m) => m.id)]);
      const unsuited = MODELS.filter((m) => !m.behaviors.includes(b)).map((m) => m.id);
      expect(optionValues().some((v) => unsuited.includes(v))).toBe(false);
    }
  });

  it('is a choice, not a free-text id', () => {
    render(<TypeEditor unit="m" onSave={() => {}} onCancel={() => {}} />);
    expect(picker().tagName).toBe('SELECT');
  });

  it('the preview follows the chosen model', async () => {
    render(<TypeEditor unit="m" onSave={() => {}} onCancel={() => {}} />);
    await userEvent.selectOptions(screen.getByLabelText(/base behavior/i), 'buffer');
    const preview = () => screen.getByTestId('model-preview').dataset.model;
    expect(preview()).toBe(resolveModel({ behavior: 'buffer' }).id);
    const choice = modelsFor('buffer').at(-1)!;
    await userEvent.selectOptions(picker(), choice.id);
    expect(preview()).toBe(choice.id);
  });

  it('saves the chosen model id, and none for the behavior default', async () => {
    const onSave = vi.fn();
    const ws = BASE_EQUIPMENT_TYPES.find((t) => t.behavior === 'workstation')!;
    render(
      <TypeEditor
        unit="m"
        initial={{ ...ws, id: crypto.randomUUID(), model: undefined }}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );
    expect(picker().value).toBe('');
    const choice = modelsFor('workstation')[0]!;
    await userEvent.selectOptions(picker(), choice.id);
    await userEvent.click(screen.getByRole('button', { name: /save type/i }));
    expect(onSave.mock.calls[0]![0].model).toBe(choice.id);
    await userEvent.selectOptions(picker(), '');
    await userEvent.click(screen.getByRole('button', { name: /save type/i }));
    expect(onSave.mock.calls[1]![0].model).toBeUndefined();
  });
});
