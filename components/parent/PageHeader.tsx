import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-8 flex flex-col gap-4 border-b-2 border-[#1A1208]/8 pb-6 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-[#1A1208] sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="max-w-xl text-sm leading-relaxed text-[#6B5E4C] text-balance">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
