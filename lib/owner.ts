/** Fixed owner UUID for all database rows (single-user, no-auth mode). */
export function getOwnerId(): string {
  const id = process.env.CUBEVERSE_OWNER_ID;
  if (!id) throw new Error("CUBEVERSE_OWNER_ID is not set in .env.local");
  return id;
}
