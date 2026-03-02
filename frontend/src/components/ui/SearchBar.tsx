import { forwardRef, type InputHTMLAttributes } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchBarProps extends InputHTMLAttributes<HTMLInputElement> {
  shortcut?: string;
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  ({ className, shortcut, ...props }, ref) => {
    return (
      <div className={cn("search-bar", className)}>
        <Search size={16} className="search-icon" />
        <input ref={ref} type="search" {...props} />
        {shortcut && <span className="search-shortcut">{shortcut}</span>}
      </div>
    );
  },
);

SearchBar.displayName = "SearchBar";
