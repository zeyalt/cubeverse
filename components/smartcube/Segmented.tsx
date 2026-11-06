"use client";

/**
 * A row of mutually exclusive options — Timer / History / Insights, Single / Ao5, and so on.
 *
 * Built as radio-style tabs (`role="tablist"`, `aria-selected`) so a screen reader announces both
 * the choice and which one is current. Every option is at least 40 px tall: these sit at the top of
 * a phone screen, exactly where a thumb mis-taps.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  /** What the group chooses between, for assistive tech. */
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex rounded-xl bg-surface-strong p-1"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={`flex-1 cursor-pointer rounded-lg font-bold transition-colors duration-150 [touch-action:manipulation] focus-visible:outline-2 focus-visible:outline-offset-2 ${
              size === "sm" ? "min-h-9 px-2 text-xs" : "min-h-10 px-3 text-sm"
            } ${selected ? "text-black" : "text-token-muted hover:text-token"}`}
            style={selected ? { backgroundColor: "var(--kid-accent)" } : undefined}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
