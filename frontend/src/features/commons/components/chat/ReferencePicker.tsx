import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Search,
  FlaskConical,
  FileText,
  BookOpen,
  Database,
  X,
} from "lucide-react";
import { useSearchObjects } from "../../api";
import type { ObjectSearchResult, ReferenceType } from "../../types";

const TYPE_ICONS: Record<
  ReferenceType,
  React.ComponentType<{ className?: string }>
> = {
  cohort_definition: FlaskConical,
  concept_set: FileText,
  study: BookOpen,
  source: Database,
};

const TYPE_LABEL_KEYS: Record<ReferenceType, string> = {
  cohort_definition: "chat.objectReference.cohortDefinition",
  concept_set: "chat.objectReference.conceptSet",
  study: "chat.objectReference.study",
  source: "chat.objectReference.source",
};

interface ReferencePickerProps {
  onSelect: (result: ObjectSearchResult) => void;
  onClose: () => void;
}

export function ReferencePicker({ onSelect, onClose }: ReferencePickerProps) {
  const { t } = useTranslation("commons");
  const [query, setQuery] = useState("");
  const { data: results = [], isLoading } = useSearchObjects(query);

  return (
    <div className="absolute bottom-full left-0 mb-1 w-80 rounded-md border border-border bg-card shadow-lg z-20">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-medium text-foreground">
          {t("chat.referencePicker.title")}
        </span>
        <button
          onClick={onClose}
          aria-label={t("ui.aria.close", { defaultValue: "Close" })}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("chat.referencePicker.placeholder")}
            autoFocus
            className="w-full rounded border border-border bg-muted pl-7 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {query.length < 2 ? (
          <p className="px-3 py-3 text-center text-[11px] text-muted-foreground">
            {t("chat.referencePicker.minChars")}
          </p>
        ) : isLoading ? (
          <p className="px-3 py-3 text-center text-[11px] text-muted-foreground">
            {t("chat.referencePicker.searching")}
          </p>
        ) : results.length === 0 ? (
          <p className="px-3 py-3 text-center text-[11px] text-muted-foreground">
            {t("chat.referencePicker.noResults")}
          </p>
        ) : (
          results.map((result) => {
            const Icon = TYPE_ICONS[result.type];
            return (
              <button
                key={`${result.type}-${result.id}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(result);
                }}
                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-muted"
              >
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground truncate">
                      {result.name}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {t(TYPE_LABEL_KEYS[result.type])}
                    </span>
                  </div>
                  {result.description && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      {result.description}
                    </p>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
