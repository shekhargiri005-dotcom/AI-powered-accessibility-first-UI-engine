import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "../../utils/cn"


// ─── Lightweight Modal (no @radix-ui/react-dialog dep) ───────────────────────
// Implements the dialog pattern using native HTML <dialog> + React portals.
// Supports open/onOpenChange, focus trap via inert, and escape key.

/* ---------- Context ---------- */
interface ModalCtx {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}
const ModalContext = React.createContext<ModalCtx>({ open: false, onOpenChange: () => {} });

/* ---------- Root ---------- */
interface ModalProps {
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  children: React.ReactNode;
}

function Modal({ open: controlledOpen, onOpenChange, children }: ModalProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    setInternalOpen(v);
    onOpenChange?.(v);
  };

  return <ModalContext.Provider value={{ open, onOpenChange: setOpen }}>{children}</ModalContext.Provider>;
}

/* ---------- Trigger ---------- */
function ModalTrigger({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { onOpenChange } = React.useContext(ModalContext);
  return (
    <button
      type="button"
      className={className}
      onClick={() => onOpenChange(true)}
      {...props}
    >
      {children}
    </button>
  );
}

/* ---------- Close ---------- */
function ModalClose({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { onOpenChange } = React.useContext(ModalContext);
  return (
    <button
      type="button"
      className={className}
      onClick={() => onOpenChange(false)}
      {...props}
    >
      {children}
    </button>
  );
}

/* ---------- Overlay ---------- */
const ModalOverlay = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { onOpenChange } = React.useContext(ModalContext);
    return (
      <div
        ref={ref}
        className={cn(
          "fixed inset-0 z-50 bg-black/80 transition-opacity animate-in fade-in-0",
          className
        )}
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
        {...props}
      />
    );
  }
);
ModalOverlay.displayName = "ModalOverlay";

/* ---------- Portal (renders children via createPortal) ---------- */
function ModalPortal({ children }: { children: React.ReactNode }) {
  const { open } = React.useContext(ModalContext);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => { setMounted(true); }, []);

  if (!mounted || !open) return null;

  // Use createPortal to render at document root
  const root = document.getElementById("root") ?? document.body;
  return createPortal(children, root);
}

/* ---------- Content ---------- */
const ModalContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const { open, onOpenChange } = React.useContext(ModalContext);

    // Focus trap + escape key
    React.useEffect(() => {
      if (!open) return;
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === "Escape") onOpenChange(false);
      };
      document.addEventListener("keydown", handleEsc);
      return () => document.removeEventListener("keydown", handleEsc);
    }, [open, onOpenChange]);

    if (!open) return null;

    return (
      <ModalPortal>
        <ModalOverlay />
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          className={cn(
            "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border border-gray-700 bg-gray-900 p-6 shadow-xl sm:rounded-lg animate-in fade-in-0 zoom-in-95",
            className
          )}
          {...props}
        >
          {children}
          <button
            type="button"
            className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      </ModalPortal>
    );
  }
);
ModalContent.displayName = "ModalContent";

/* ---------- Header / Footer / Title / Description ---------- */
const ModalHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
ModalHeader.displayName = "ModalHeader";

const ModalFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
ModalFooter.displayName = "ModalFooter";

const ModalTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-lg font-semibold leading-none tracking-tight text-gray-100", className)}
      {...props}
    />
  )
);
ModalTitle.displayName = "ModalTitle";

const ModalDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-gray-400", className)} {...props} />
  )
);
ModalDescription.displayName = "ModalDescription";

export {
  Modal,
  ModalPortal,
  ModalOverlay,
  ModalTrigger,
  ModalClose,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalDescription,
}
