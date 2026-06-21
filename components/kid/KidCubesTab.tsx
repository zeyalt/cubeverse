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
    defaultEventId: string;
  };
}

export function KidCubesTab({ data: { cubes, events, defaultEventId } }: KidCubesTabProps) {
  return (
    <div className="kid-cubes-wrapper px-5 pt-3 pb-6">
      <div className="mb-5">
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-white">Cubes</h2>
        <p className="mt-0.5 text-sm text-white/50">Your collection</p>
      </div>
      <CubesView cubes={cubes} events={events} defaultEventId={defaultEventId} />
    </div>
  );
}
