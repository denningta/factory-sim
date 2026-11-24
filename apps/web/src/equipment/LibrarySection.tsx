import { useEffect, useState } from 'react';
import type { EquipmentType } from '@factory-sim/schema';
import { useEditorStore } from '../layout/editorStore';
import type { DisplayUnit } from '../layout/units';
import { LibraryPanel } from './LibraryPanel';
import { TypeEditor } from './TypeEditor';

/** The calls the library needs; the real `api` client satisfies it. */
export interface LibraryApi {
  listEquipmentTypes: () => Promise<EquipmentType[]>;
  createEquipmentType: (type: EquipmentType) => Promise<EquipmentType>;
  updateEquipmentType: (type: EquipmentType) => Promise<EquipmentType>;
  deleteEquipmentType: (id: string) => Promise<void>;
}

const byName = (a: EquipmentType, b: EquipmentType) =>
  a.name.toLowerCase().localeCompare(b.name.toLowerCase());

/**
 * The library panel plus creating, editing and deleting my own types (EQ-3). Saving a type
 * never touches placed instances; when some exist the user is offered to update them.
 */
export function LibrarySection({ api, unit }: { api: LibraryApi; unit: DisplayUnit }) {
  const userTypes = useEditorStore((s) => s.userTypes);
  const setUserTypes = useEditorStore((s) => s.setUserTypes);
  const selectedId = useEditorStore((s) => s.selectedTypeId);
  const selectType = useEditorStore((s) => s.selectType);
  const instances = useEditorStore((s) => s.equipment);
  const [form, setForm] = useState<'new' | EquipmentType | null>(null);
  const [offer, setOffer] = useState<EquipmentType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offerError, setOfferError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.listEquipmentTypes().then(
      (types) => !cancelled && useEditorStore.getState().setUserTypes(types),
      (e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'Cannot load types'),
    );
    return () => {
      cancelled = true;
    };
  }, [api]);

  async function save(type: EquipmentType) {
    const editing = form !== 'new' && form !== null;
    try {
      const saved = editing
        ? await api.updateEquipmentType(type)
        : await api.createEquipmentType(type);
      const others = useEditorStore.getState().userTypes.filter((t) => t.id !== saved.id);
      setUserTypes([...others, saved].sort(byName));
      setError(null);
      setForm(null);
      const used = useEditorStore.getState().equipment.some((e) => e.typeId === saved.id);
      setOffer(editing && used ? saved : null);
      setOfferError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the type');
    }
  }

  async function remove(type: EquipmentType) {
    try {
      await api.deleteEquipmentType(type.id);
      setUserTypes(useEditorStore.getState().userTypes.filter((t) => t.id !== type.id));
      if (selectedId === type.id) selectType(null);
      if (offer?.id === type.id) setOffer(null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the type');
    }
  }

  const count = offer ? instances.filter((e) => e.typeId === offer.id).length : 0;
  return (
    <>
      <LibraryPanel
        unit={unit}
        selectedId={selectedId}
        onSelect={selectType}
        userTypes={userTypes}
        onEdit={(t) => {
          setOffer(null);
          setForm(t);
        }}
        onDelete={(t) => void remove(t)}
      />
      {form === null ? (
        <button type="button" style={{ marginTop: 8 }} onClick={() => setForm('new')}>
          New type…
        </button>
      ) : (
        <TypeEditor
          key={form === 'new' ? 'new' : form.id}
          unit={unit}
          {...(form === 'new' ? {} : { initial: form })}
          onSave={(t) => void save(t)}
          onCancel={() => setForm(null)}
        />
      )}
      {offer && count > 0 && (
        <div role="status" style={{ margin: '8px 0' }}>
          <p style={{ margin: '0 0 4px' }}>
            {count === 1
              ? '1 placed instance uses this type.'
              : `${count} placed instances use this type.`}{' '}
            Update them to the new settings? Names and positions stay.
          </p>
          <button
            type="button"
            onClick={() => {
              const r = useEditorStore.getState().syncInstancesToType(offer);
              if (r.ok) {
                setOffer(null);
                setOfferError(null);
              } else setOfferError(r.error);
            }}
          >
            Update instances
          </button>{' '}
          <button type="button" onClick={() => setOffer(null)}>
            Keep their settings
          </button>
          {offerError && (
            <p role="alert" style={{ color: '#b91c1c', margin: '4px 0 0' }}>
              {offerError}
            </p>
          )}
        </div>
      )}
      {error && (
        <p role="alert" style={{ color: '#b91c1c' }}>
          {error}
        </p>
      )}
    </>
  );
}
