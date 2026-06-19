import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] px-6 py-16 text-center",
        className
      )}
    >
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-white/5 text-white/40 ring-1 ring-white/10">
        <Icon className="size-7" strokeWidth={1.5} />
      </div>
      <p className="font-display text-lg font-bold text-white">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-sm text-white/50">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
