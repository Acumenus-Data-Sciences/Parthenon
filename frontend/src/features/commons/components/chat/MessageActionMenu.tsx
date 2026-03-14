import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Pencil, Trash2, Reply, SmilePlus, Pin } from "lucide-react";
import { EmojiPicker } from "./EmojiPicker";

interface MessageActionMenuProps {
  isAuthor: boolean;
  isAdmin: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReact: (emoji: string) => void;
  onPin: () => void;
}

export function MessageActionMenu({
  isAuthor,
  isAdmin,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onPin,
}: MessageActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-md border border-border bg-card py-1 shadow-lg">
          <button
            onClick={() => { setShowEmojiPicker(true); setOpen(false); }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-muted"
          >
            <SmilePlus className="h-3.5 w-3.5" />
            React
          </button>

          <button
            onClick={() => { onReply(); setOpen(false); }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-muted"
          >
            <Reply className="h-3.5 w-3.5" />
            Reply
          </button>

          <button
            onClick={() => { onPin(); setOpen(false); }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-muted"
          >
            <Pin className="h-3.5 w-3.5" />
            Pin
          </button>

          {isAuthor && (
            <button
              onClick={() => { onEdit(); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-muted"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
          )}

          {(isAuthor || isAdmin) && (
            <button
              onClick={() => { onDelete(); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:bg-muted"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          )}
        </div>
      )}

      {showEmojiPicker && (
        <div className="absolute right-0 top-full z-20 mt-1">
          <EmojiPicker
            onSelect={(emoji) => {
              onReact(emoji);
              setShowEmojiPicker(false);
            }}
            onClose={() => setShowEmojiPicker(false)}
          />
        </div>
      )}
    </div>
  );
}
