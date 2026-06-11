"use client";

import { CubesView } from "@/components/cubes/CubesView";

interface CubeRow {
  id: string;
  name: string;
  brand: string | null;
  eventId: string | null;
  eventName: string | null;
  isMain: boolean;
  photoUrl: string | null;
  acquiredOn: string | null;
  notes: string | null;
}

interface EventOption {
  id: string;
  name: string;
}

interface KidCubesTabProps {
  data: {
    cubes: CubeRow[];
    events: EventOption[];
    cuberId: string;
  };
}

export function KidCubesTab({ data: { cubes, events } }: KidCubesTabProps) {
  return (
    <div className="kid-cubes-wrapper px-5 py-6">
      <div className="space-y-2 mb-6">
        <h2 className="font-display text-2xl font-extrabold text-white">Cubes</h2>
        <p className="text-sm text-white/60">Your collection</p>
      </div>
      <CubesView cubes={cubes} events={events} />
    </div>
  );
}
