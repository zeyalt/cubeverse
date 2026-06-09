"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Trophy,
  Download,
  BookOpen,
  Target,
  Award,
  Box,
  Settings,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/parent/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/parent/competitions", label: "Comps", icon: Trophy },
  { href: "/parent/import", label: "Import", icon: Download },
  { href: "/parent/journal", label: "Journal", icon: BookOpen },
  { href: "/parent/goals", label: "Goals", icon: Target },
  { href: "/parent/achievements", label: "Badges", icon: Award },
  { href: "/parent/cubes", label: "Cubes", icon: Box },
  { href: "/parent/settings", label: "Settings", icon: Settings },
] as const;

function NavLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const pathname = usePathname();
  const active =
    pathname === href ||
    (href !== "/parent/overview" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={cn(
        "group relative flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-[#1A1208] text-[#F4EFE6]"
          : "text-[#6B5E4C] hover:bg-[#EDE6DA] hover:text-[#1A1208]"
      )}
    >
      <Icon className={cn("size-4", active ? "text-[#FFD500]" : "opacity-60")} />
      <span className="whitespace-nowrap">{label}</span>
      {active && (
        <span className="absolute -bottom-[9px] left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-[#0046AD]" />
      )}
    </Link>
  );
}

export function ParentNav() {
  return (
    <nav className="flex gap-0.5 overflow-x-auto scrollbar-none">
      {NAV.map((item) => (
        <NavLink key={item.href} {...item} />
      ))}
    </nav>
  );
}

export function ParentBrand() {
  return (
    <Link href="/parent/overview" className="group flex items-baseline gap-2">
      <span className="font-heading text-2xl font-semibold tracking-tight text-[#1A1208] group-hover:text-[#0046AD] transition-colors">
        Cubeverse
      </span>
      <span className="hidden text-[10px] font-semibold uppercase tracking-[0.2em] text-[#B8860B] sm:inline">
        Parent log
      </span>
    </Link>
  );
}

export function KidModeLink() {
  return (
    <Link
      href="/"
      className="sticker flex items-center gap-2 rounded-lg bg-[#FFD500] px-3.5 py-2 text-sm font-bold text-[#1A1208] transition-transform hover:-translate-y-px active:translate-y-px"
    >
      <Home className="size-4" />
      <span className="hidden sm:inline">Kid mode</span>
    </Link>
  );
}
