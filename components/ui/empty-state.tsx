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
        "flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#D9CEBD] bg-[#FFFCF7]/60 px-6 py-14 text-center",
        className
      )}
    >
      <div className="sticker mb-4 flex size-14 items-center justify-center rounded-xl bg-[#EDE6DA] text-[#6B5E4C]">
        <Icon className="size-6" strokeWidth={1.5} />
      </div>
      <p className="font-heading text-lg font-semibold text-[#1A1208]">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-[#6B5E4C]">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
