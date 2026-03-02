import { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { useUiStore } from "@/stores/uiStore";
import {
  LayoutDashboard,
  Database,
  Upload,
  BarChart3,
  BookOpen,
  Users,
  FlaskConical,
  Workflow,
  Briefcase,
  UserCircle,
  Settings,
  Sparkles,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  label: string;
  group: string;
  icon: React.ElementType;
  action: () => void;
  shortcut?: string;
  keywords?: string;
}

export function CommandPalette() {
  const navigate = useNavigate();
  const { commandPaletteOpen, setCommandPaletteOpen, toggleAiDrawer } = useUiStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands = useMemo<CommandItem[]>(
    () => [
      { id: "dashboard", label: "Dashboard", group: "Navigation", icon: LayoutDashboard, action: () => navigate("/"), shortcut: "g d", keywords: "home overview" },
      { id: "sources", label: "Data Sources", group: "Navigation", icon: Database, action: () => navigate("/data-sources"), shortcut: "g s", keywords: "cdm connection" },
      { id: "ingestion", label: "Data Ingestion", group: "Navigation", icon: Upload, action: () => navigate("/ingestion"), keywords: "etl upload csv" },
      { id: "explorer", label: "Data Explorer", group: "Navigation", icon: BarChart3, action: () => navigate("/data-explorer"), shortcut: "g e", keywords: "achilles dqd quality" },
      { id: "vocabulary", label: "Vocabulary", group: "Navigation", icon: BookOpen, action: () => navigate("/vocabulary"), shortcut: "g v", keywords: "concepts athena search omop" },
      { id: "cohorts", label: "Cohort Definitions", group: "Navigation", icon: Users, action: () => navigate("/cohort-definitions"), shortcut: "g c", keywords: "cohort build define" },
      { id: "concept-sets", label: "Concept Sets", group: "Navigation", icon: FlaskConical, action: () => navigate("/concept-sets"), keywords: "concepts group" },
      { id: "analyses", label: "Analyses", group: "Navigation", icon: Workflow, action: () => navigate("/analyses"), shortcut: "g a", keywords: "characterization incidence ple plp" },
      { id: "studies", label: "Studies", group: "Navigation", icon: Briefcase, action: () => navigate("/studies"), keywords: "research strategus" },
      { id: "profiles", label: "Patient Profiles", group: "Navigation", icon: UserCircle, action: () => navigate("/profiles"), keywords: "person timeline" },
      { id: "jobs", label: "Jobs", group: "Navigation", icon: Briefcase, action: () => navigate("/jobs"), shortcut: "g j", keywords: "queue horizon status" },
      { id: "admin", label: "Administration", group: "Navigation", icon: Settings, action: () => navigate("/admin"), keywords: "users roles settings" },
      { id: "ai", label: "Open AI Assistant", group: "Actions", icon: Sparkles, action: () => toggleAiDrawer(), shortcut: "Ctrl Shift A", keywords: "abby chat medgemma" },
    ],
    [navigate, toggleAiDrawer],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.keywords?.toLowerCase().includes(q) ||
        c.group.toLowerCase().includes(q),
    );
  }, [commands, query]);

  // Group filtered results
  const groups = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of filtered) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return map;
  }, [filtered]);

  // Reset on open
  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [commandPaletteOpen]);

  // Clamp selected index
  useEffect(() => {
    if (selectedIndex >= filtered.length) setSelectedIndex(Math.max(0, filtered.length - 1));
  }, [filtered.length, selectedIndex]);

  const runSelected = () => {
    const item = filtered[selectedIndex];
    if (item) {
      item.action();
      setCommandPaletteOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runSelected();
    } else if (e.key === "Escape") {
      setCommandPaletteOpen(false);
    }
  };

  if (!commandPaletteOpen) return null;

  let flatIndex = 0;

  return createPortal(
    <>
      <div
        className="command-palette-backdrop"
        onClick={() => setCommandPaletteOpen(false)}
      />
      <div className="command-palette" role="dialog" aria-label="Command palette">
        <div className="flex items-center" style={{ padding: "0 var(--space-4)" }}>
          <Search size={18} style={{ color: "var(--text-ghost)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            className="command-palette-input"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ borderBottom: "none", paddingLeft: "var(--space-3)" }}
          />
        </div>
        <div style={{ borderTop: "1px solid var(--border-default)" }} />
        <div className="command-palette-list">
          {filtered.length === 0 && (
            <div style={{ padding: "var(--space-6)", textAlign: "center", color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
              No results found
            </div>
          )}
          {Array.from(groups.entries()).map(([group, items]) => (
            <div key={group}>
              <div className="command-palette-group">{group}</div>
              {items.map((item) => {
                const idx = flatIndex++;
                return (
                  <div
                    key={item.id}
                    className={cn("command-palette-item")}
                    data-selected={selectedIndex === idx ? "true" : undefined}
                    onClick={() => {
                      item.action();
                      setCommandPaletteOpen(false);
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <item.icon size={16} />
                    <span>{item.label}</span>
                    {item.shortcut && (
                      <span className="command-shortcut">{item.shortcut}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </>,
    document.body,
  );
}
