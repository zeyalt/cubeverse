import { SyncIndicator } from "@/components/SyncIndicator";
import { ParentBrand, ParentNav, KidModeLink } from "@/components/parent/ParentNav";

export default function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="parent-canvas min-h-screen">
      <header className="sticky top-0 z-40 border-b-2 border-[#1A1208]/10 bg-[#F4EFE6]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <ParentBrand />
          <div className="flex items-center gap-3">
            <SyncIndicator />
            <KidModeLink />
          </div>
        </div>
        <div className="mx-auto max-w-6xl border-t border-[#D9CEBD]/80 px-4 pb-0 pt-1 sm:px-6">
          <ParentNav />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
        <p className="text-center text-[11px] text-[#A89880]">
          Official times stay official · practice stays practice
        </p>
      </footer>
    </div>
  );
}
