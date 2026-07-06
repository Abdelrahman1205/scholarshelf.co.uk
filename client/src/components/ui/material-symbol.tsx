import { cn } from "@/lib/utils";

/**
 * MaterialSymbol — Google Material Symbols Outlined icon (ScholarShelf design system).
 * Usage: <MaterialSymbol name="auto_stories" className="text-base text-primary" />
 * Size is controlled via font-size (text-* classes); default 20px.
 */
export function MaterialSymbol({
  name,
  fill = false,
  className,
}: {
  name: string;
  fill?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("material-symbols-outlined", fill && "msym-fill", className)}
    >
      {name}
    </span>
  );
}
