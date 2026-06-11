import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ownerId = process.env.CUBEVERSE_OWNER_ID;

if (!supabaseUrl || !supabaseServiceKey || !ownerId) {
  console.error("Missing environment variables");
  process.exit(1);
}

const db = createClient(supabaseUrl, supabaseServiceKey);

async function seed() {
  console.log("🌱 Seeding demo data...");

  // Delete existing data for this owner
  console.log("Clearing existing data...");
  await db.from("app_settings").delete().eq("owner_id", ownerId);
  await db.from("cubers").delete().eq("owner_id", ownerId);

  // Create a demo cuber
  console.log("Creating demo cuber...");
  const { data: cuber, error: cuberErr } = await db
    .from("cubers")
    .insert({
      owner_id: ownerId,
      name: "Demo Cuber",
      display_name: "Demo",
      wca_id: null,
      avatar_color: "blue",
    })
    .select("id")
    .single();

  if (cuberErr) {
    console.error("Error creating cuber:", cuberErr);
    process.exit(1);
  }

  console.log(`✓ Created cuber: ${cuber.id}`);

  // Create app settings
  console.log("Creating app settings...");
  const { error: settingsErr } = await db.from("app_settings").insert({
    owner_id: ownerId,
    default_cuber_id: cuber.id,
    current_cuber_id: cuber.id,
  });

  if (settingsErr) {
    console.error("Error creating settings:", settingsErr);
    process.exit(1);
  }

  console.log("✓ Created app settings");
  console.log("\n✅ Demo data seeded successfully!");
  console.log(`   Owner ID: ${ownerId}`);
  console.log(`   Cuber ID: ${cuber.id}`);
  console.log("\n   You can now visit http://localhost:3000/");
}

seed().catch(console.error);
