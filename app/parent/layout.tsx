import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { lockParentMode } from "@/app/actions/parent";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  Trophy,
  Download,
  BookOpen,
  Target,
  Award,
  Box,
  Settings,
  LogOut,
} from "lucide-react";

const NAV = [
  { href: "/parent/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/parent/competitions", label: "Competitions", icon: Trophy },
  { href: "/parent/import", label: "Import", icon: Download },
  { href: "/parent/journal", label: "Journal", icon: BookOpen },
  { href: "/parent/goals", label: "Goals", icon: Target },
  { href: "/parent/achievements", label: "Achievements", icon: Award },
  { href: "/parent/cubes", label: "Cubes", icon: Box },
  { href: "/parent/settings", label: "Settings", icon: Settings },
];

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jar = await cookies();
  if (jar.get("cubeverse_parent")?.value !== "1") redirect("/");

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">
            Cubeverse
            <span className="ml-2 text-xs font-normal text-zinc-400 uppercase tracking-widest">
              Parent
            </span>
          </span>

          <nav className="hidden md:flex items-center gap-1">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            ))}
          </nav>

          <form action={lockParentMode}>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kid mode</span>
            </button>
          </form>
        </div>

        {/* Mobile nav */}
        <div className="md:hidden overflow-x-auto border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex px-4 py-2 gap-1">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </header>

      <Separator />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        {children}
      </main>
    </div>
  );
}
