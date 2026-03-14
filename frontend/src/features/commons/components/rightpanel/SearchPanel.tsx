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
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search messages..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-md border border-border bg-muted pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {query.length < 2 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 pt-12 text-center">
            <Search className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-[13px] font-medium text-muted-foreground">Search Messages</p>
            <p className="text-xs text-muted-foreground/60">
              Type at least 2 characters to search
            </p>
          </div>
        ) : isLoading ? (
          <p className="px-4 py-3 text-xs text-muted-foreground">Searching...</p>
        ) : results.length === 0 ? (
          <p className="px-4 py-3 text-xs text-muted-foreground">
            No messages found for &ldquo;{query}&rdquo;
          </p>
        ) : (
          results.map((msg) => (
            <div
              key={msg.id}
              className="border-b border-border px-4 py-3 hover:bg-muted/30"
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
                    <span className="text-[10px] text-muted-foreground">
                      in #{msg.channel.slug}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-3">
                    {msg.body}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
