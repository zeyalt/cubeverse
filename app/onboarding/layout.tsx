import { ReactNode } from "react";

interface OnboardingLayoutProps {
  children: ReactNode;
}

export default function OnboardingLayout({ children }: OnboardingLayoutProps) {
  return (
    <div className="kid-canvas min-h-screen flex flex-col text-white">
      {children}
    </div>
  );
}
