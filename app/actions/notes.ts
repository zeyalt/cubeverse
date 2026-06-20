"use server";

import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";

export interface CompetitionNote {
  id: string;
  competitionId: string;
  eventId: string | null;
  roundType: string | null;
  content: string;
  updatedAt: string;
}

export async function saveCompetitionNote(
  cuberId: string,
  competitionId: string,
  eventId: string | null,
  roundType: string | null,
  content: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getServiceClient();
    const ownerId = getOwnerId();

    const { error } = await db.from("competition_notes").upsert(
      {
        owner_id: ownerId,
        cuber_id: cuberId,
        competition_id: competitionId,
        event_id: eventId,
        round_type: roundType,
        content: content || null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "cuber_id,competition_id,event_id,round_type",
      }
    );

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function getCompetitionNotes(
  cuberId: string,
  competitionId: string
): Promise<CompetitionNote[]> {
  try {
    const db = getServiceClient();

    const { data, error } = await db
      .from("competition_notes")
      .select("id, competition_id, event_id, round_type, content, updated_at")
      .eq("cuber_id", cuberId)
      .eq("competition_id", competitionId)
      .order("event_id, round_type");

    if (error) {
      console.error("Error fetching competition notes:", error.message);
      return [];
    }

    return (data ?? []).map((row: {
      id: string;
      competition_id: string;
      event_id: string | null;
      round_type: string | null;
      content: string;
      updated_at: string;
    }) => ({
      id: row.id,
      competitionId: row.competition_id,
      eventId: row.event_id,
      roundType: row.round_type,
      content: row.content,
      updatedAt: row.updated_at,
    }));
  } catch (err) {
    console.error("Error in getCompetitionNotes:", err);
    return [];
  }
}
