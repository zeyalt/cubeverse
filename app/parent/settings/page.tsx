import { PageHeader } from "@/components/parent/PageHeader";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Cubers, theme, and app preferences."
      />
      <div className="parent-surface flex flex-col items-center justify-center px-6 py-14 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Settings className="size-6" strokeWidth={1.5} />
        </div>
        <p className="font-semibold text-foreground">Coming soon</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Multi-cuber support, theme toggle, and default event picker will land
          in a future update.
        </p>
      </div>
    </div>
  );
}
