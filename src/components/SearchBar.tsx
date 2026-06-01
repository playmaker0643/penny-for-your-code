import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Generic search bar — controlled. Use with `filterByQuery` from `@/lib/search`
 * to get name-first then description-match ordering.
 */
export default function SearchBar({ value, onChange, placeholder = "Search...", className = "" }: Props) {
  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 bg-muted text-sm"
      />
    </div>
  );
}
