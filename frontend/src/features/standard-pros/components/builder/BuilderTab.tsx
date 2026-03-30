import { useEffect, useMemo, useState } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CopyPlus,
  GripVertical,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  Wrench,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import {
  useCloneSurveyInstrument,
  useCreateSurveyInstrument,
  useCreateSurveyItem,
  useDeleteSurveyInstrument,
  useDeleteSurveyItem,
  useSurveyInstrument,
  useSurveyInstruments,
  useUpdateSurveyInstrument,
  useUpdateSurveyItem,
} from "../../hooks/useSurveyInstruments";
import type {
  SurveyInstrumentApi,
  SurveyInstrumentDetailApi,
  SurveyInstrumentPayload,
  SurveyItemApi,
  SurveyItemPayload,
} from "../../api/surveyApi";
import { ImportInstrumentModal } from "./ImportInstrumentModal";
import { parseFhirQuestionnaire } from "../../lib/fhirParser";
import { parseRedcapDictionary } from "../../lib/redcapParser";

const DOMAINS = [
  "mental_health",
  "quality_of_life",
  "pain",
  "function",
  "sleep",
  "fatigue",
  "cardiovascular",
  "other",
] as const;

const RESPONSE_TYPE_OPTIONS = [
  { value: "likert", label: "Likert" },
  { value: "yes_no", label: "Yes / No" },
  { value: "numeric", label: "Numeric" },
  { value: "free_text", label: "Free Text" },
  { value: "multi_select", label: "Multi Select" },
  { value: "date", label: "Date" },
] as const;

type InstrumentForm = {
  name: string;
  abbreviation: string;
  version: string;
  description: string;
  domain: string;
  license_type: "public" | "proprietary";
  omop_coverage: "yes" | "partial" | "no";
};

type ItemForm = {
  item_number: string;
  item_text: string;
  response_type: string;
  subscale_name: string;
  min_value: string;
  max_value: string;
  is_reverse_coded: boolean;
  loinc_code: string;
  omop_concept_id: string;
  answer_options_text: string;
};

type CloneForm = {
  sourceId: number | null;
  name: string;
  abbreviation: string;
  query: string;
};

type InstrumentModalMode = "create" | "edit";

function isCustomInstrument(instrument: SurveyInstrumentApi | SurveyInstrumentDetailApi | null): boolean {
  if (!instrument) {
    return false;
  }

  return instrument.created_by != null || instrument.creator != null;
}

function toInstrumentForm(instrument: SurveyInstrumentDetailApi): InstrumentForm {
  return {
    name: instrument.name,
    abbreviation: instrument.abbreviation,
    version: instrument.version,
    description: instrument.description ?? "",
    domain: instrument.domain,
    license_type: instrument.license_type,
    omop_coverage: instrument.omop_coverage,
  };
}

function defaultAnswerOptions(responseType: string): string {
  if (responseType === "yes_no") {
    return "Yes\nNo";
  }

  if (responseType === "likert") {
    return "Never\nSometimes\nOften\nAlways";
  }

  return "";
}

function toItemForm(item: SurveyItemApi | null, nextItemNumber: number): ItemForm {
  return {
    item_number: item ? String(item.item_number) : String(nextItemNumber),
    item_text: item?.item_text ?? "",
    response_type: item?.response_type ?? "likert",
    subscale_name: item?.subscale_name ?? "",
    min_value: item?.min_value ?? "",
    max_value: item?.max_value ?? "",
    is_reverse_coded: item?.is_reverse_coded ?? false,
    loinc_code: item?.loinc_code ?? "",
    omop_concept_id: item?.omop_concept_id != null ? String(item.omop_concept_id) : "",
    answer_options_text:
      item?.answer_options.map((option) => option.option_text).join("\n") ??
      defaultAnswerOptions(item?.response_type ?? "likert"),
  };
}

function buildInstrumentPayload(form: InstrumentForm): SurveyInstrumentPayload {
  return {
    ...form,
    description: form.description.trim() || null,
    is_public_domain: form.license_type === "public",
    is_active: true,
  };
}

function usesAnswerOptions(responseType: string): boolean {
  return responseType === "likert" || responseType === "yes_no" || responseType === "multi_select";
}

function usesRange(responseType: string): boolean {
  return responseType === "numeric";
}

function buildItemPayload(form: ItemForm, displayOrder: number): SurveyItemPayload {
  const options = usesAnswerOptions(form.response_type)
    ? form.answer_options_text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    : [];

  return {
    item_number: Number(form.item_number),
    item_text: form.item_text.trim(),
    response_type: form.response_type,
    subscale_name: form.subscale_name.trim() || null,
    min_value: usesRange(form.response_type) && form.min_value.trim() !== "" ? Number(form.min_value) : null,
    max_value: usesRange(form.response_type) && form.max_value.trim() !== "" ? Number(form.max_value) : null,
    is_reverse_coded: form.is_reverse_coded,
    loinc_code: form.loinc_code.trim() || null,
    omop_concept_id: form.omop_concept_id.trim() === "" ? null : Number(form.omop_concept_id),
    display_order: displayOrder,
    answer_options: options.map((option, index) => ({
      option_text: option,
      option_value: index,
      display_order: index + 1,
    })),
  };
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[#8A857D]">
      {children}
    </div>
  );
}

function ItemFormFields({
  form,
  editable,
  onChange,
}: {
  form: ItemForm;
  editable: boolean;
  onChange: (form: ItemForm) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block">
          <SectionTitle>Item Number</SectionTitle>
          <input
            value={form.item_number}
            disabled={!editable}
            onChange={(event) => onChange({ ...form, item_number: event.target.value })}
            className="w-full rounded-xl border border-[#2A2A2F] bg-[#0E0E11] px-3 py-2 text-sm text-[#F0EDE8] outline-none focus:border-[#2DD4BF] disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
        <label className="block">
          <SectionTitle>Response Type</SectionTitle>
          <select
            value={form.response_type}
            disabled={!editable}
            onChange={(event) => onChange({ ...form, response_type: event.target.value })}
            className="w-full rounded-xl border border-[#2A2A2F] bg-[#0E0E11] px-3 py-2 text-sm text-[#F0EDE8] outline-none focus:border-[#2DD4BF] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {RESPONSE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <SectionTitle>Question</SectionTitle>
        <textarea
          rows={5}
          value={form.item_text}
          disabled={!editable}
          onChange={(event) => onChange({ ...form, item_text: event.target.value })}
          className="w-full rounded-xl border border-[#2A2A2F] bg-[#0E0E11] px-3 py-2 text-sm text-[#F0EDE8] outline-none focus:border-[#2DD4BF] disabled:cursor-not-allowed disabled:opacity-60"
        />
      </label>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block">
          <SectionTitle>Subscale</SectionTitle>
          <input
            value={form.subscale_name}
            disabled={!editable}
            onChange={(event) => onChange({ ...form, subscale_name: event.target.value })}
            placeholder="Optional grouping"
            className="w-full rounded-xl border border-[#2A2A2F] bg-[#0E0E11] px-3 py-2 text-sm text-[#F0EDE8] outline-none focus:border-[#2DD4BF] disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
        <label className="flex items-end gap-3 rounded-xl border border-[#2A2A2F] bg-[#0E0E11] px-3 py-2">
          <input
            type="checkbox"
            checked={form.is_reverse_coded}
            disabled={!editable}
            onChange={(event) => onChange({ ...form, is_reverse_coded: event.target.checked })}
          />
          <div>
            <div className="text-sm text-[#F0EDE8]">Reverse coded</div>
            <div className="text-[11px] text-[#5A5650]">Apply inverse scoring at runtime</div>
          </div>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block">
          <SectionTitle>LOINC Code</SectionTitle>
          <input
            value={form.loinc_code}
            disabled={!editable}
            onChange={(event) => onChange({ ...form, loinc_code: event.target.value })}
            placeholder="Optional"
            className="w-full rounded-xl border border-[#2A2A2F] bg-[#0E0E11] px-3 py-2 text-sm text-[#F0EDE8] outline-none focus:border-[#2DD4BF] disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
        <label className="block">
          <SectionTitle>OMOP Concept ID</SectionTitle>
          <input
            value={form.omop_concept_id}
            disabled={!editable}
            onChange={(event) => onChange({ ...form, omop_concept_id: event.target.value })}
            inputMode="numeric"
            placeholder="Optional"
            className="w-full rounded-xl border border-[#2A2A2F] bg-[#0E0E11] px-3 py-2 text-sm text-[#F0EDE8] outline-none focus:border-[#2DD4BF] disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
      </div>

      {usesRange(form.response_type) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block">
            <SectionTitle>Min Value</SectionTitle>
            <input
              value={form.min_value}
              disabled={!editable}
              onChange={(event) => onChange({ ...form, min_value: event.target.value })}
              inputMode="numeric"
              className="w-full rounded-xl border border-[#2A2A2F] bg-[#0E0E11] px-3 py-2 text-sm text-[#F0EDE8] outline-none focus:border-[#2DD4BF] disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>
          <label className="block">
            <SectionTitle>Max Value</SectionTitle>
            <input
              value={form.max_value}
              disabled={!editable}
              onChange={(event) => onChange({ ...form, max_value: event.target.value })}
              inputMode="numeric"
              className="w-full rounded-xl border border-[#2A2A2F] bg-[#0E0E11] px-3 py-2 text-sm text-[#F0EDE8] outline-none focus:border-[#2DD4BF] disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>
        </div>
      )}

      {usesAnswerOptions(form.response_type) && (
        <label className="block">
          <SectionTitle>Answer Options</SectionTitle>
          <textarea
            rows={10}
            value={form.answer_options_text}
            disabled={!editable}
            onChange={(event) => onChange({ ...form, answer_options_text: event.target.value })}
            placeholder="One option per line"
            className="w-full rounded-xl border border-[#2A2A2F] bg-[#0E0E11] px-3 py-2 font-['IBM_Plex_Mono',monospace] text-xs text-[#F0EDE8] outline-none focus:border-[#2DD4BF] disabled:cursor-not-allowed disabled:opacity-60"
          />
          <div className="mt-2 text-[11px] text-[#5A5650]">
            Each line becomes a discrete answer option. Option values are assigned sequentially from top to bottom.
          </div>
        </label>
      )}

      {!usesAnswerOptions(form.response_type) && !usesRange(form.response_type) && (
        <div className="rounded-xl border border-dashed border-[#2A2A2F] bg-[#0E0E11] px-4 py-3 text-[11px] text-[#5A5650]">
          This response type does not require discrete answer options or numeric bounds.
        </div>
      )}
    </div>
  );
}

function WorkspacePanel({
  instrument,
  busy,
  customInstruments,
  currentCustomId,
  onChangeCurrentCustomId,
  onCreate,
  onClone,
  onEdit,
  onDelete,
}: {
  instrument: SurveyInstrumentDetailApi | null;
  busy: boolean;
  customInstruments: SurveyInstrumentApi[];
  currentCustomId: number | null;
  onChangeCurrentCustomId: (id: number | null) => void;
  onCreate: () => void;
  onClone: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[#2A2A2F] bg-[#141418]">
      <div className="border-b border-[#232328] px-5 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Wrench size={16} className="text-[#C9A227]" />
              <h2 className="text-sm font-semibold text-[#F0EDE8]">Survey Builder</h2>
              {instrument && (
                <span className="rounded-md bg-[#1B1B20] px-2 py-1 text-[10px] uppercase tracking-wider text-[#2DD4BF]">
                  {instrument.abbreviation}
                </span>
              )}
            </div>
            <p className="mt-2 max-w-3xl text-xs leading-relaxed text-[#8A857D]">
              Build and maintain one active custom instrument at a time. Standard PROs and existing custom instruments are available through the clone flow, not as an always-visible list.
            </p>
          </div>

          <div className="flex w-full max-w-[420px] flex-col items-stretch gap-3 xl:items-end">
            <select
              value={currentCustomId ?? ""}
              onChange={(event) => onChangeCurrentCustomId(event.target.value === "" ? null : Number(event.target.value))}
              className="w-full rounded-lg border border-[#2A2A2F] bg-[#0E0E11] px-3 py-2 text-sm text-[#F0EDE8] outline-none focus:border-[#2DD4BF]"
            >
              <option value="">No custom instrument selected</option>
              {customInstruments.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.abbreviation} - {entry.name}
                </option>
              ))}
            </select>

            <div className="grid w-full grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={onCreate}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2DD4BF] px-3 py-2 text-xs font-medium text-[#0E0E11] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={12} />
                New Custom Instrument
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onClone}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#2A2A2F] px-3 py-2 text-xs font-medium text-[#8A857D] hover:text-[#F0EDE8] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CopyPlus size={12} />
                Clone Instrument
              </button>
              <button
                type="button"
                disabled={busy || !instrument}
                onClick={onEdit}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#C9A227] px-3 py-2 text-xs font-medium text-[#0E0E11] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save size={12} />
                Save Instrument
              </button>
              <button
                type="button"
                disabled={busy || !instrument}
                onClick={onDelete}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#612734] px-3 py-2 text-xs font-medium text-[#E85A6B] hover:bg-[#612734]/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 size={12} />
                Delete Instrument
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-5">
        {!instrument ? (
          <div className="flex min-h-[212px] items-center justify-center rounded-xl border border-dashed border-[#2A2A2F] bg-[#0E0E11] px-6 text-center text-sm text-[#8A857D]">
            Create a new custom instrument or clone one to start authoring.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-[#2A2A2F] bg-[#0E0E11] p-4">
              <SectionTitle>Name</SectionTitle>
              <div className="text-sm font-medium text-[#F0EDE8]">{instrument.name}</div>
            </div>
            <div className="rounded-xl border border-[#2A2A2F] bg-[#0E0E11] p-4">
              <SectionTitle>Version</SectionTitle>
              <div className="text-sm font-medium text-[#F0EDE8]">{instrument.version}</div>
            </div>
            <div className="rounded-xl border border-[#2A2A2F] bg-[#0E0E11] p-4">
              <SectionTitle>Domain</SectionTitle>
              <div className="text-sm font-medium text-[#F0EDE8]">{instrument.domain}</div>
            </div>
            <div className="rounded-xl border border-[#2A2A2F] bg-[#0E0E11] p-4">
              <SectionTitle>Items</SectionTitle>
              <div className="text-sm font-medium text-[#F0EDE8]">{instrument.items.length}</div>
            </div>
            <div className="rounded-xl border border-[#2A2A2F] bg-[#0E0E11] p-4 md:col-span-4">
              <SectionTitle>Description</SectionTitle>
              <div className="text-sm leading-relaxed text-[#C5C0B8]">
                {instrument.description?.trim() || "No description entered yet."}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SortableItemRow({
  item,
  selected,
  onSelect,
}: {
  item: SurveyItemApi;
  selected: boolean;
  onSelect: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => onSelect(item.id)}
      className={cn(
        "w-full rounded-xl border px-3 py-3 text-left transition-colors",
        selected
          ? "border-[#C9A227] bg-[#C9A227]/10"
          : "border-[#2A2A2F] bg-[#0E0E11] hover:border-[#3C3C44]",
        isDragging && "opacity-70 shadow-lg",
      )}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab text-[#5A5650] active:cursor-grabbing"
          onClick={(event) => event.stopPropagation()}
        >
          <GripVertical size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-[#1B1B20] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#8A857D]">
              {item.response_type.replace("_", " ")}
            </span>
            {item.subscale_name && (
              <span className="rounded-md bg-[#2DD4BF]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#2DD4BF]">
                {item.subscale_name}
              </span>
            )}
          </div>
          <div className="mt-2 text-sm font-medium text-[#F0EDE8]">
            {item.item_number}. {item.item_text}
          </div>
          <div className="mt-1 text-[11px] text-[#5A5650]">
            {item.answer_options.length > 0
              ? `${item.answer_options.length} answer options`
              : item.min_value != null || item.max_value != null
                ? `Range ${item.min_value ?? "?"} to ${item.max_value ?? "?"}`
                : "No discrete options"}
          </div>
        </div>
      </div>
    </button>
  );
}

function ItemCanvas({
  instrument,
  selectedItemId,
  editable,
  busy,
  onSelect,
  onCreate,
  onReorder,
}: {
  instrument: SurveyInstrumentDetailApi;
  selectedItemId: number | null;
  editable: boolean;
  busy: boolean;
  onSelect: (id: number | null) => void;
  onCreate: () => void;
  onReorder: (orderedIds: number[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const itemIds = instrument.items.map((item) => item.id);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!editable || over == null || active.id === over.id) {
      return;
    }

    const oldIndex = itemIds.indexOf(Number(active.id));
    const newIndex = itemIds.indexOf(Number(over.id));

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    onReorder(arrayMove(itemIds, oldIndex, newIndex));
  };

  return (
    <div className="rounded-2xl border border-[#2A2A2F] bg-[#141418]">
      <div className="flex items-center justify-between border-b border-[#232328] px-4 py-3">
        <h3 className="text-sm font-medium text-[#F0EDE8]">Item Canvas</h3>
        <button
          type="button"
          disabled={!editable || busy}
          onClick={onCreate}
          className="inline-flex items-center gap-2 rounded-lg border border-[#2A2A2F] px-3 py-2 text-xs font-medium text-[#8A857D] hover:text-[#F0EDE8] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={12} />
          Create Item
        </button>
      </div>
      <div className="p-4">
        {instrument.items.length === 0 ? (
          <div className="flex min-h-[440px] items-center justify-center rounded-xl border border-dashed border-[#2A2A2F] bg-[#0E0E11] px-6 text-center text-sm text-[#8A857D]">
            No items yet. Use Create Item to start authoring this instrument.
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {instrument.items.map((item) => (
                  <SortableItemRow
                    key={item.id}
                    item={item}
                    selected={selectedItemId === item.id}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <div className="mt-4 rounded-xl border border-dashed border-[#2A2A2F] bg-[#0E0E11] px-4 py-3 text-[11px] leading-relaxed text-[#5A5650]">
          Drag items to reorder them. The builder persists the revised order immediately.
        </div>
      </div>
    </div>
  );
}

function EditItemModal({
  open,
  instrument,
  item,
  editable,
  busy,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  instrument: SurveyInstrumentDetailApi;
  item: SurveyItemApi | null;
  editable: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (form: ItemForm, item: SurveyItemApi | null) => void;
  onDelete: (item: SurveyItemApi) => void;
}) {
  const [form, setForm] = useState<ItemForm>(() => toItemForm(item, instrument.items.length + 1));

  useEffect(() => {
    const nextNumber = item?.item_number ?? instrument.items.length + 1;
    setForm(toItemForm(item, nextNumber));
  }, [instrument.items.length, item]);

  useEffect(() => {
    if (!usesAnswerOptions(form.response_type) && form.answer_options_text !== "") {
      setForm((current) => ({ ...current, answer_options_text: "" }));
      return;
    }

    if (usesAnswerOptions(form.response_type) && form.answer_options_text.trim() === "") {
      setForm((current) => ({
        ...current,
        answer_options_text: defaultAnswerOptions(form.response_type),
      }));
    }
  }, [form.response_type, form.answer_options_text]);

  const saveDisabled =
    busy ||
    !editable ||
    item == null ||
    form.item_text.trim() === "" ||
    form.item_number.trim() === "";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? "Edit Item" : "Item Editor"}
      size="xl"
      footer={(
        <div className="flex items-center justify-between gap-3">
          <div>
            {item && (
              <button
                type="button"
                disabled={busy || !editable}
                onClick={() => onDelete(item)}
                className="inline-flex items-center gap-2 rounded-lg border border-[#2A2A2F] px-4 py-2 text-sm text-[#E85A6B] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 size={14} />
                Delete Item
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#2A2A2F] px-4 py-2 text-sm text-[#8A857D] hover:text-[#F0EDE8]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saveDisabled}
              onClick={() => onSave(form, item)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#C9A227] px-4 py-2 text-sm font-medium text-[#0E0E11] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={14} />
              Save Item
            </button>
          </div>
        </div>
      )}
    >
      {item ? (
        <ItemFormFields form={form} editable={editable} onChange={setForm} />
      ) : (
        <div className="rounded-xl border border-dashed border-[#2A2A2F] bg-[#0E0E11] px-6 py-10 text-center text-sm text-[#8A857D]">
          Select an existing item from the canvas to edit it.
        </div>
      )}
    </Modal>
  );
}

function InstrumentMetadataModal({
  open,
  mode,
  busy,
  form,
  onChange,
  onClose,
  onSave,
}: {
  open: boolean;
  mode: InstrumentModalMode;
  busy: boolean;
  form: InstrumentForm;
  onChange: (form: InstrumentForm) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const saveDisabled =
    busy ||
    form.name.trim() === "" ||
    form.abbreviation.trim() === "" ||
    form.version.trim() === "";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? "New Custom Instrument" : "Instrument Metadata"}
      size="xl"
      footer={(
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#2A2A2F] px-4 py-2 text-sm text-[#8A857D] hover:text-[#F0EDE8]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saveDisabled}
            onClick={onSave}
            className="inline-flex items-center gap-2 rounded-lg bg-[#C9A227] px-4 py-2 text-sm font-medium text-[#0E0E11] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={14} />
            {mode === "create" ? "Create Instrument" : "Save Instrument"}
          </button>
        </div>
      )}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block">
          <SectionTitle>Name</SectionTitle>
          <input
            value={form.name}
            onChange={(event) => onChange({ ...form, name: event.target.value })}
            className="w-full rounded-xl border border-[#2A2A2F] bg-[#141418] px-3 py-2 text-sm text-[#F0EDE8] outline-none focus:border-[#2DD4BF]"
          />
        </label>
        <label className="block">
          <SectionTitle>Abbreviation</SectionTitle>
          <input
            value={form.abbreviation}
            onChange={(event) => onChange({ ...form, abbreviation: event.target.value.toUpperCase() })}
            className="w-full rounded-xl border border-[#2A2A2F] bg-[#141418] px-3 py-2 text-sm text-[#F0EDE8] outline-none focus:border-[#2DD4BF]"
          />
        </label>
        <label className="block">
          <SectionTitle>Version</SectionTitle>
          <input
            value={form.version}
            onChange={(event) => onChange({ ...form, version: event.target.value })}
            className="w-full rounded-xl border border-[#2A2A2F] bg-[#141418] px-3 py-2 text-sm text-[#F0EDE8] outline-none focus:border-[#2DD4BF]"
          />
        </label>
        <label className="block">
          <SectionTitle>Domain</SectionTitle>
          <select
            value={form.domain}
            onChange={(event) => onChange({ ...form, domain: event.target.value })}
            className="w-full rounded-xl border border-[#2A2A2F] bg-[#141418] px-3 py-2 text-sm text-[#F0EDE8] outline-none focus:border-[#2DD4BF]"
          >
            {DOMAINS.map((domain) => (
              <option key={domain} value={domain}>
                {domain}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <SectionTitle>License</SectionTitle>
          <select
            value={form.license_type}
            onChange={(event) => onChange({ ...form, license_type: event.target.value as InstrumentForm["license_type"] })}
            className="w-full rounded-xl border border-[#2A2A2F] bg-[#141418] px-3 py-2 text-sm text-[#F0EDE8] outline-none focus:border-[#2DD4BF]"
          >
            <option value="public">public</option>
            <option value="proprietary">proprietary</option>
          </select>
        </label>
        <label className="block">
          <SectionTitle>OMOP Coverage</SectionTitle>
          <select
            value={form.omop_coverage}
            onChange={(event) => onChange({ ...form, omop_coverage: event.target.value as InstrumentForm["omop_coverage"] })}
            className="w-full rounded-xl border border-[#2A2A2F] bg-[#141418] px-3 py-2 text-sm text-[#F0EDE8] outline-none focus:border-[#2DD4BF]"
          >
            <option value="yes">yes</option>
            <option value="partial">partial</option>
            <option value="no">no</option>
          </select>
        </label>
        <label className="block md:col-span-2">
          <SectionTitle>Description</SectionTitle>
          <textarea
            rows={4}
            value={form.description}
            onChange={(event) => onChange({ ...form, description: event.target.value })}
            className="w-full rounded-xl border border-[#2A2A2F] bg-[#141418] px-3 py-2 text-sm text-[#F0EDE8] outline-none focus:border-[#2DD4BF]"
          />
        </label>
      </div>
    </Modal>
  );
}

function CreateItemModal({
  open,
  instrument,
  busy,
  editable,
  onClose,
  onSave,
}: {
  open: boolean;
  instrument: SurveyInstrumentDetailApi;
  busy: boolean;
  editable: boolean;
  onClose: () => void;
  onSave: (form: ItemForm) => void;
}) {
  const [form, setForm] = useState<ItemForm>(() => toItemForm(null, instrument.items.length + 1));

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm(toItemForm(null, instrument.items.length + 1));
  }, [open, instrument.items.length]);

  useEffect(() => {
    if (!usesAnswerOptions(form.response_type) && form.answer_options_text !== "") {
      setForm((current) => ({ ...current, answer_options_text: "" }));
      return;
    }

    if (usesAnswerOptions(form.response_type) && form.answer_options_text.trim() === "") {
      setForm((current) => ({
        ...current,
        answer_options_text: defaultAnswerOptions(form.response_type),
      }));
    }
  }, [form.response_type, form.answer_options_text]);

  const saveDisabled =
    busy ||
    !editable ||
    form.item_text.trim() === "" ||
    form.item_number.trim() === "";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Item"
      size="xl"
      footer={(
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#2A2A2F] px-4 py-2 text-sm text-[#8A857D] hover:text-[#F0EDE8]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saveDisabled}
            onClick={() => onSave(form)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#C9A227] px-4 py-2 text-sm font-medium text-[#0E0E11] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={14} />
            Save Item
          </button>
        </div>
      )}
    >
      <ItemFormFields form={form} editable={editable} onChange={setForm} />
    </Modal>
  );
}

function CloneInstrumentModal({
  open,
  busy,
  instruments,
  form,
  onChange,
  onClose,
  onClone,
}: {
  open: boolean;
  busy: boolean;
  instruments: SurveyInstrumentApi[];
  form: CloneForm;
  onChange: (form: CloneForm) => void;
  onClose: () => void;
  onClone: () => void;
}) {
  const filtered = useMemo(() => {
    const query = form.query.trim().toLowerCase();

    return instruments.filter((instrument) => {
      if (query === "") {
        return true;
      }

      return (
        instrument.name.toLowerCase().includes(query) ||
        instrument.abbreviation.toLowerCase().includes(query) ||
        instrument.domain.toLowerCase().includes(query)
      );
    });
  }, [form.query, instruments]);

  const standard = filtered.filter((instrument) => !isCustomInstrument(instrument));
  const custom = filtered.filter((instrument) => isCustomInstrument(instrument));
  const selectedSource = instruments.find((entry) => entry.id === form.sourceId) ?? null;

  const chooseSource = (instrument: SurveyInstrumentApi) => {
    onChange({
      ...form,
      sourceId: instrument.id,
      name: `${instrument.name} Copy`,
      abbreviation: `${instrument.abbreviation}_COPY`,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Clone Instrument"
      size="xl"
      footer={(
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#2A2A2F] px-4 py-2 text-sm text-[#8A857D] hover:text-[#F0EDE8]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || form.sourceId == null || form.name.trim() === "" || form.abbreviation.trim() === ""}
            onClick={onClone}
            className="inline-flex items-center gap-2 rounded-lg bg-[#C9A227] px-4 py-2 text-sm font-medium text-[#0E0E11] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CopyPlus size={14} />
            Clone into Workspace
          </button>
        </div>
      )}
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-[#2A2A2F] bg-[#0E0E11] p-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5650]" />
            <input
              value={form.query}
              onChange={(event) => onChange({ ...form, query: event.target.value })}
              placeholder="Search standard or custom instruments"
              className="w-full rounded-xl border border-[#2A2A2F] bg-[#141418] py-2 pl-9 pr-3 text-sm text-[#F0EDE8] outline-none focus:border-[#2DD4BF]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <div className="rounded-xl border border-[#2A2A2F] bg-[#0E0E11] p-4">
              <div className="mb-3 text-xs font-medium uppercase tracking-wider text-[#2DD4BF]">Standard PROs</div>
              <div className="space-y-2">
                {standard.length === 0 && (
                  <div className="rounded-xl border border-dashed border-[#2A2A2F] px-4 py-3 text-sm text-[#8A857D]">
                    No standard instruments match the current search.
                  </div>
                )}
                {standard.map((instrument) => (
                  <button
                    key={instrument.id}
                    type="button"
                    onClick={() => chooseSource(instrument)}
                    className={cn(
                      "w-full rounded-xl border px-3 py-3 text-left transition-colors",
                      form.sourceId === instrument.id
                        ? "border-[#2DD4BF] bg-[#2DD4BF]/10"
                        : "border-[#2A2A2F] bg-[#141418] hover:border-[#3C3C44]",
                    )}
                  >
                    <div className="text-xs font-semibold text-[#F0EDE8]">{instrument.abbreviation}</div>
                    <div className="mt-1 text-sm text-[#C5C0B8]">{instrument.name}</div>
                    <div className="mt-1 text-[11px] text-[#5A5650]">{instrument.domain}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[#2A2A2F] bg-[#0E0E11] p-4">
              <div className="mb-3 text-xs font-medium uppercase tracking-wider text-[#C9A227]">Custom Instruments</div>
              <div className="space-y-2">
                {custom.length === 0 && (
                  <div className="rounded-xl border border-dashed border-[#2A2A2F] px-4 py-3 text-sm text-[#8A857D]">
                    No custom instruments match the current search.
                  </div>
                )}
                {custom.map((instrument) => (
                  <button
                    key={instrument.id}
                    type="button"
                    onClick={() => chooseSource(instrument)}
                    className={cn(
                      "w-full rounded-xl border px-3 py-3 text-left transition-colors",
                      form.sourceId === instrument.id
                        ? "border-[#C9A227] bg-[#C9A227]/10"
                        : "border-[#2A2A2F] bg-[#141418] hover:border-[#3C3C44]",
                    )}
                  >
                    <div className="text-xs font-semibold text-[#F0EDE8]">{instrument.abbreviation}</div>
                    <div className="mt-1 text-sm text-[#C5C0B8]">{instrument.name}</div>
                    <div className="mt-1 text-[11px] text-[#5A5650]">{instrument.domain}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#2A2A2F] bg-[#0E0E11] p-4">
            <div className="text-xs font-medium uppercase tracking-wider text-[#8A857D]">Clone Settings</div>
            {!selectedSource ? (
              <div className="mt-4 rounded-xl border border-dashed border-[#2A2A2F] px-4 py-6 text-sm text-[#8A857D]">
                Select a source instrument to configure the cloned copy.
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-[#2A2A2F] bg-[#141418] px-4 py-3">
                  <div className="text-xs font-semibold text-[#F0EDE8]">{selectedSource.abbreviation}</div>
                  <div className="mt-1 text-sm text-[#C5C0B8]">{selectedSource.name}</div>
                </div>
                <label className="block">
                  <SectionTitle>Cloned Name</SectionTitle>
                  <input
                    value={form.name}
                    onChange={(event) => onChange({ ...form, name: event.target.value })}
                    className="w-full rounded-xl border border-[#2A2A2F] bg-[#141418] px-3 py-2 text-sm text-[#F0EDE8] outline-none focus:border-[#2DD4BF]"
                  />
                </label>
                <label className="block">
                  <SectionTitle>Cloned Abbreviation</SectionTitle>
                  <input
                    value={form.abbreviation}
                    onChange={(event) => onChange({ ...form, abbreviation: event.target.value.toUpperCase() })}
                    className="w-full rounded-xl border border-[#2A2A2F] bg-[#141418] px-3 py-2 text-sm text-[#F0EDE8] outline-none focus:border-[#2DD4BF]"
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function BuilderTab() {
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<number | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCreateItemOpen, setIsCreateItemOpen] = useState(false);
  const [isEditItemOpen, setIsEditItemOpen] = useState(false);
  const [isCloneOpen, setIsCloneOpen] = useState(false);
  const [isInstrumentModalOpen, setIsInstrumentModalOpen] = useState(false);
  const [instrumentModalMode, setInstrumentModalMode] = useState<InstrumentModalMode>("create");
  const [instrumentForm, setInstrumentForm] = useState<InstrumentForm>({
    name: "",
    abbreviation: "",
    version: "1.0",
    description: "",
    domain: "other",
    license_type: "public",
    omop_coverage: "no",
  });
  const [cloneForm, setCloneForm] = useState<CloneForm>({
    sourceId: null,
    name: "",
    abbreviation: "",
    query: "",
  });

  const instrumentListQuery = useSurveyInstruments({
    per_page: 200,
    sort: "updated_at",
    dir: "desc",
  });

  const customInstruments = useMemo(
    () => (instrumentListQuery.data?.data ?? []).filter((entry) => isCustomInstrument(entry)),
    [instrumentListQuery.data?.data],
  );

  const defaultInstrumentId = customInstruments[0]?.id ?? null;
  const effectiveInstrumentId = selectedInstrumentId ?? defaultInstrumentId;
  const instrumentDetailQuery = useSurveyInstrument(effectiveInstrumentId ?? 0);

  const createInstrument = useCreateSurveyInstrument();
  const updateInstrument = useUpdateSurveyInstrument();
  const cloneInstrument = useCloneSurveyInstrument();
  const deleteInstrument = useDeleteSurveyInstrument();
  const createItem = useCreateSurveyItem();
  const updateItem = useUpdateSurveyItem();
  const deleteItem = useDeleteSurveyItem();

  const instrument = instrumentDetailQuery.data ?? null;
  const editable = isCustomInstrument(instrument);

  const selectedItem = useMemo(
    () => instrument?.items.find((entry) => entry.id === selectedItemId) ?? null,
    [instrument, selectedItemId],
  );

  useEffect(() => {
    if (!instrument) {
      return;
    }

    if (instrument.items.length === 0) {
      if (selectedItemId !== null) {
        setSelectedItemId(null);
      }
      return;
    }

    if (selectedItemId == null) {
      setSelectedItemId(instrument.items[0].id);
      return;
    }

    if (!instrument.items.some((entry) => entry.id === selectedItemId)) {
      setSelectedItemId(instrument.items[0]?.id ?? null);
    }
  }, [instrument, selectedItemId]);

  const busy =
    createInstrument.isPending ||
    updateInstrument.isPending ||
    cloneInstrument.isPending ||
    deleteInstrument.isPending ||
    createItem.isPending ||
    updateItem.isPending ||
    deleteItem.isPending;

  const openCreateInstrumentModal = () => {
    setInstrumentModalMode("create");
    setInstrumentForm({
      name: "",
      abbreviation: `NEW_${Date.now().toString().slice(-6)}`,
      version: "1.0",
      description: "",
      domain: "other",
      license_type: "public",
      omop_coverage: "no",
    });
    setIsInstrumentModalOpen(true);
  };

  const openEditInstrumentModal = () => {
    if (!instrument) {
      return;
    }

    setInstrumentModalMode("edit");
    setInstrumentForm(toInstrumentForm(instrument));
    setIsInstrumentModalOpen(true);
  };

  const saveInstrumentModal = () => {
    if (instrumentModalMode === "create") {
      createInstrument.mutate(
        buildInstrumentPayload(instrumentForm),
        {
          onSuccess: (created) => {
            setSelectedInstrumentId(created.id);
            setSelectedItemId(null);
            setIsInstrumentModalOpen(false);
            toast.success(`Created ${created.abbreviation}`);
          },
          onError: () => {
            toast.error("Failed to create instrument");
          },
        },
      );
      return;
    }

    if (!instrument || !editable) {
      toast.error("Only custom instruments can be saved from this workspace.");
      return;
    }

    updateInstrument.mutate(
      {
        id: instrument.id,
        payload: buildInstrumentPayload(instrumentForm),
      },
      {
        onSuccess: () => {
          setIsInstrumentModalOpen(false);
          toast.success("Instrument saved");
        },
        onError: () => {
          toast.error("Failed to save instrument");
        },
      },
    );
  };

  const deleteCurrentInstrument = () => {
    if (!instrument) {
      return;
    }

    if (!editable) {
      toast.error("Library instruments cannot be deleted.");
      return;
    }

    const confirmed = window.confirm(`Delete instrument "${instrument.name}"? This cannot be undone.`);

    if (!confirmed) {
      return;
    }

    deleteInstrument.mutate(instrument.id, {
      onSuccess: () => {
        setSelectedInstrumentId(null);
        setSelectedItemId(null);
        setIsCreateItemOpen(false);
        setIsEditItemOpen(false);
        toast.success("Instrument deleted");
      },
      onError: () => {
        toast.error("Failed to delete instrument");
      },
    });
  };

  const saveItem = (form: ItemForm, existingItem: SurveyItemApi | null) => {
    if (!instrument || !editable) {
      toast.error("Library instruments are read-only. Clone the instrument to edit it.");
      return;
    }

    const payload = buildItemPayload(
      form,
      existingItem ? existingItem.display_order : instrument.items.length + 1,
    );

    if (existingItem) {
      updateItem.mutate(
        { instrumentId: instrument.id, itemId: existingItem.id, payload },
        {
          onSuccess: () => {
            setIsEditItemOpen(false);
            toast.success("Item saved");
          },
          onError: () => {
            toast.error("Failed to save item");
          },
        },
      );

      return;
    }

    createItem.mutate(
      { instrumentId: instrument.id, payload },
      {
        onSuccess: (created) => {
          setSelectedItemId(created.id);
          setIsCreateItemOpen(false);
          toast.success("Item saved");
        },
        onError: () => {
          toast.error("Failed to create item");
        },
      },
    );
  };

  const deleteCurrentItem = (item: SurveyItemApi) => {
    if (!instrument || !editable) {
      toast.error("Library instruments are read-only. Clone the instrument to edit it.");
      return;
    }

    deleteItem.mutate(
      { instrumentId: instrument.id, itemId: item.id },
      {
        onSuccess: () => {
          const remainingItems = instrument.items.filter((entry) => entry.id !== item.id);
          setSelectedItemId(remainingItems[0]?.id ?? null);
          setIsEditItemOpen(false);
          toast.success("Item deleted");
        },
        onError: () => {
          toast.error("Failed to delete item");
        },
      },
    );
  };

  const openCreateItemModal = () => {
    if (!instrument || !editable) {
      toast.error("Create or clone a custom instrument before adding items.");
      return;
    }

    setIsCreateItemOpen(true);
  };

  const openCloneModal = () => {
    setCloneForm({
      sourceId: null,
      name: "",
      abbreviation: "",
      query: "",
    });
    setIsCloneOpen(true);
  };

  const executeClone = () => {
    if (cloneForm.sourceId == null) {
      return;
    }

    cloneInstrument.mutate(
      {
        id: cloneForm.sourceId,
        payload: {
          name: cloneForm.name.trim(),
          abbreviation: cloneForm.abbreviation.trim(),
        },
      },
      {
          onSuccess: (cloned) => {
          setSelectedInstrumentId(cloned.id);
          setSelectedItemId(cloned.items[0]?.id ?? null);
          setIsEditItemOpen(false);
          setIsCloneOpen(false);
          toast.success(`Cloned ${cloned.abbreviation}`);
        },
        onError: () => {
          toast.error("Failed to clone instrument");
        },
      },
    );
  };

  const reorderItems = async (orderedIds: number[]) => {
    if (!instrument || !editable) {
      toast.error("Library instruments are read-only. Clone the instrument to edit it.");
      return;
    }

    const orderedItems = orderedIds
      .map((id) => instrument.items.find((item) => item.id === id))
      .filter((item): item is SurveyItemApi => item != null);

    try {
      await Promise.all(
        orderedItems.map((item, index) =>
          updateItem.mutateAsync({
            instrumentId: instrument.id,
            itemId: item.id,
            payload: {
              item_number: index + 1,
              item_text: item.item_text,
              response_type: item.response_type,
              omop_concept_id: item.omop_concept_id,
              loinc_code: item.loinc_code,
              snomed_code: item.snomed_code,
              subscale_name: item.subscale_name,
              is_reverse_coded: item.is_reverse_coded,
              min_value: item.min_value == null ? null : Number(item.min_value),
              max_value: item.max_value == null ? null : Number(item.max_value),
              display_order: index + 1,
              answer_options: item.answer_options.map((option, optionIndex) => ({
                option_text: option.option_text,
                option_value: option.option_value == null ? null : Number(option.option_value),
                omop_concept_id: option.omop_concept_id,
                loinc_la_code: option.loinc_la_code,
                snomed_code: option.snomed_code,
                display_order: optionIndex + 1,
              })),
            },
          }),
        ),
      );

      toast.success("Item order updated");
    } catch {
      toast.error("Failed to reorder items");
    }
  };

  return (
    <div className="space-y-6">
      <WorkspacePanel
        instrument={instrument}
        busy={busy}
        customInstruments={customInstruments}
        currentCustomId={effectiveInstrumentId}
        onChangeCurrentCustomId={(id) => {
          setSelectedInstrumentId(id);
          setSelectedItemId(null);
          setIsCreateItemOpen(false);
          setIsEditItemOpen(false);
        }}
        onCreate={openCreateInstrumentModal}
        onClone={openCloneModal}
        onEdit={openEditInstrumentModal}
        onDelete={deleteCurrentInstrument}
      />

      {instrument ? (
        <>
          <ItemCanvas
            instrument={instrument}
            selectedItemId={selectedItemId}
            editable={editable}
            busy={busy}
            onSelect={(id) => {
              setSelectedItemId(id);
              setIsEditItemOpen(id != null);
            }}
            onCreate={openCreateItemModal}
            onReorder={reorderItems}
          />

          <CreateItemModal
            open={isCreateItemOpen}
            instrument={instrument}
            busy={busy}
            editable={editable}
            onClose={() => setIsCreateItemOpen(false)}
            onSave={(form) => saveItem(form, null)}
          />

          <EditItemModal
            open={isEditItemOpen}
            instrument={instrument}
            item={selectedItem}
            editable={editable}
            busy={busy}
            onClose={() => setIsEditItemOpen(false)}
            onSave={saveItem}
            onDelete={deleteCurrentItem}
          />
        </>
      ) : (
        <div className="rounded-2xl border border-[#2A2A2F] bg-[#141418] p-12 text-center text-sm text-[#8A857D]">
          {instrumentListQuery.isLoading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Loading instruments...
            </span>
          ) : (
            "No custom instrument selected. Create a new one or clone from the instrument catalogue."
          )}
        </div>
      )}

      <InstrumentMetadataModal
        open={isInstrumentModalOpen}
        mode={instrumentModalMode}
        busy={busy}
        form={instrumentForm}
        onChange={setInstrumentForm}
        onClose={() => setIsInstrumentModalOpen(false)}
        onSave={saveInstrumentModal}
      />

      <CloneInstrumentModal
        open={isCloneOpen}
        busy={busy}
        instruments={instrumentListQuery.data?.data ?? []}
        form={cloneForm}
        onChange={setCloneForm}
        onClose={() => setIsCloneOpen(false)}
        onClone={executeClone}
      />

      <ImportInstrumentModal
        open={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        isImporting={busy}
        onSubmit={async ({ sourceType, content, name, abbreviation, domain }) => {
          try {
            const parsed = sourceType === "redcap"
              ? parseRedcapDictionary(content, {
                  name: name || undefined,
                  abbreviation: abbreviation || undefined,
                  domain,
                })
              : parseFhirQuestionnaire(content, {
                  name: name || undefined,
                  abbreviation: abbreviation || undefined,
                  domain,
                });

            const created = await createInstrument.mutateAsync({
              ...parsed.instrument,
              license_type: "public",
              is_public_domain: true,
              is_active: true,
              omop_coverage: "no",
            });

            await Promise.all(
              parsed.items.map((itemPayload) =>
                createItem.mutateAsync({
                  instrumentId: created.id,
                  payload: itemPayload,
                }),
              ),
            );

            setSelectedInstrumentId(created.id);
            setSelectedItemId(null);
            setIsImportOpen(false);
            toast.success(`Imported ${parsed.items.length} items into ${created.abbreviation}`);
          } catch (error) {
            const message = error instanceof Error ? error.message : "Import failed";
            toast.error(message);
          }
        }}
      />
    </div>
  );
}
