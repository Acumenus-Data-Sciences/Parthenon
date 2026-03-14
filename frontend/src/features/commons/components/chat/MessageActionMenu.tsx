import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Pencil, Trash2, Reply, SmilePlus, Pin, ClipboardCheck } from "lucide-react";
import { EmojiPicker } from "./EmojiPicker";

interface MessageActionMenuProps {
  isAuthor: boolean;
  isAdmin: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReact: (emoji: string) => void;
  onPin: () => void;
  onRequestReview?: () => void;
}

export function MessageActionMenu({
  isAuthor,
  isAdmin,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onPin,
  onRequestReview,
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
        className="rounded-md p-1 text-muted-foreground/60 hover:bg-white/[0.06] hover:text-foreground transition-all"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 min-w-[160px] rounded-lg border border-white/[0.08] bg-[#1a1a24] py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <button
            onClick={() => { setShowEmojiPicker(true); setOpen(false); }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-foreground/90 hover:bg-white/[0.06] transition-colors"
          >
            <SmilePlus className="h-3.5 w-3.5" />
            React
          </button>

          <button
            onClick={() => { onReply(); setOpen(false); }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-foreground/90 hover:bg-white/[0.06] transition-colors"
          >
            <Reply className="h-3.5 w-3.5" />
            Reply
          </button>

          <button
            onClick={() => { onPin(); setOpen(false); }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-foreground/90 hover:bg-white/[0.06] transition-colors"
          >
            <Pin className="h-3.5 w-3.5" />
            Pin
          </button>

          {onRequestReview && (
            <button
              onClick={() => { onRequestReview(); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-foreground/90 hover:bg-white/[0.06] transition-colors"
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              Request Review
            </button>
          )}

          {isAuthor && (
            <button
              onClick={() => { onEdit(); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-foreground/90 hover:bg-white/[0.06] transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
          )}

          {(isAuthor || isAdmin) && (
            <button
              onClick={() => { onDelete(); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-red-400 hover:bg-white/[0.06] transition-colors"
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
