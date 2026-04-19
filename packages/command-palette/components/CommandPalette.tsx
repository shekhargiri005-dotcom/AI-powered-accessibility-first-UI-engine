import * as React from "react"
import { Search } from "lucide-react"
import { Modal, ModalContent } from "../../core/components/Modal"
import { cn } from "../../utils/cn"

// ─── Lightweight Command Palette (no cmdk dep) ───────────────────────────────
// Implements a filterable command menu with keyboard navigation.

interface CommandContextValue {
  search: string;
  setSearch: (v: string) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
}
const CommandContext = React.createContext<CommandContextValue>({
  search: "",
  setSearch: () => {},
  selectedId: null,
  setSelectedId: () => {},
});

/* ---------- CommandPalette ---------- */
interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

function CommandPalette({ children, isOpen, onClose }: CommandPaletteProps) {
  const [search, setSearch] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  // Reset search when opened/closed
  React.useEffect(() => { setSearch(""); }, [isOpen]);

  return (
    <Modal open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ModalContent className="overflow-hidden p-0 shadow-2xl">
        <CommandContext.Provider value={{ search, setSearch, selectedId, setSelectedId }}>
          <div className="flex h-full w-full flex-col overflow-hidden rounded-md bg-gray-900 text-gray-100">
            {children}
          </div>
        </CommandContext.Provider>
      </ModalContent>
    </Modal>
  );
}

/* ---------- CommandInput ---------- */
const CommandInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, value, onChange, ...props }, ref) => {
    const { setSearch } = React.useContext(CommandContext);
    return (
      <div className="flex items-center border-b border-gray-700 px-3">
        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        <input
          ref={ref}
          className={cn(
            "flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-gray-500 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          placeholder="Type a command or search..."
          onChange={(e) => { setSearch(e.target.value); onChange?.(e); }}
          {...props}
        />
      </div>
    );
  }
);
CommandInput.displayName = "CommandInput";

/* ---------- CommandList ---------- */
function CommandList({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("max-h-[300px] overflow-y-auto overflow-x-hidden", className)} {...props}>
      {children}
    </div>
  );
}

/* ---------- CommandEmpty ---------- */
function CommandEmpty({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { search } = React.useContext(CommandContext);
  // Only show empty state when there's a search query
  if (!search) return null;
  return (
    <div className={cn("py-6 text-center text-sm text-gray-500", className)} {...props}>
      {children ?? "No results found."}
    </div>
  );
}

/* ---------- CommandGroup ---------- */
function CommandGroup({ heading, className, children, ...props }: React.HTMLAttributes<HTMLDivElement> & { heading?: string }) {
  return (
    <div className={cn("overflow-hidden p-1", className)} {...props}>
      {heading && (
        <div className="px-2 py-1.5 text-xs font-medium text-gray-500">{heading}</div>
      )}
      {children}
    </div>
  );
}

/* ---------- CommandItem ---------- */
interface CommandItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value?: string;
  onSelect?: () => void;
}

const CommandItem = React.forwardRef<HTMLButtonElement, CommandItemProps>(
  ({ className, value, onSelect, children, ...props }, ref) => {
    const { search, selectedId, setSelectedId } = React.useContext(CommandContext);
    const id = value ?? String(children);
    const matchesSearch = !search || id.toLowerCase().includes(search.toLowerCase());
    const isSelected = selectedId === id;

    if (!matchesSearch) return null;

    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none w-full text-left",
          isSelected ? "bg-blue-600/20 text-blue-300" : "hover:bg-gray-800 text-gray-200",
          "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          className
        )}
        onClick={onSelect}
        onMouseEnter={() => setSelectedId(id)}
        {...props}
      >
        {children}
      </button>
    );
  }
);
CommandItem.displayName = "CommandItem";

export {
  CommandPalette,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
}
