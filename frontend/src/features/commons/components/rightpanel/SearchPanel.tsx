import { useState } from "react";
import { Search } from "lucide-react";
import { useSearchMessages } from "../../api";
import { avatarColor } from "../../utils/avatarColor";

interface SearchPanelProps {
  slug: string;
  onNavigate?: (channelSlug: string) => void;
}

export function SearchPanel({ slug }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const { data: results = [], isLoading } = useSearchMessages(query, slug);

  return (
    <div className="flex flex-1 flex-col">
      <div className="px-3 py-3">
        <div className="relative rounded-xl border border-[#26262c] bg-[#111115] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search messages..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border-0 bg-transparent py-2 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {query.length < 2 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#2b2b32] bg-[#111115] px-5 py-10 text-center">
            <Search className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-[13px] font-medium text-muted-foreground">Search Messages</p>
            <p className="text-xs leading-5 text-muted-foreground/60">
              Type at least 2 characters to search
            </p>
          </div>
        ) : isLoading ? (
          <div className="rounded-2xl border border-[#25252b] bg-[#111115] px-4 py-3 text-xs text-muted-foreground">
            Searching...
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-2xl border border-[#25252b] bg-[#111115] px-4 py-3 text-xs text-muted-foreground">
            No messages found for &ldquo;{query}&rdquo;
          </div>
        ) : (
          <div className="space-y-2">
            {results.map((msg) => (
              <div
                key={msg.id}
                className="rounded-xl border border-[#25252b] bg-[#111115] px-3 py-3 transition-colors hover:border-[#31313a] hover:bg-[#15151a]"
              >
              <div className="flex items-start gap-2">
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                  style={{ backgroundColor: avatarColor(msg.user.id) }}
                >
                  {msg.user.name
                    .split(" ")
                    .map((p) => p[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs font-semibold text-foreground">
                      {msg.user.name}
                    </span>
                    <span className="rounded-full bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      in #{msg.channel.slug}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground line-clamp-3">
                    {msg.body}
                  </p>
                </div>
              </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
