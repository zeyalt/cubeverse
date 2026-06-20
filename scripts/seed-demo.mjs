import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env.local");

// Parse .env.local manually
const envContent = fs.readFileSync(envPath, "utf-8");
const env = {};
envContent.split("\n").forEach((line) => {
  if (line && !line.startsWith("#")) {
    const [key, ...valueParts] = line.split("=");
    if (key && valueParts.length > 0) {
      env[key.trim()] = valueParts.join("=").trim();
    }
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const ownerId = env.CUBEVERSE_OWNER_ID;

console.log("Environment loaded:");
console.log("  - Supabase URL:", supabaseUrl ? "✓" : "✗");
console.log("  - Service Key:", supabaseServiceKey ? "✓" : "✗");
console.log("  - Owner ID:", ownerId ? "✓" : "✗");

if (!supabaseUrl || !supabaseServiceKey || !ownerId) {
  console.error("\n✗ Missing environment variables");
  process.exit(1);
}

const db = createClient(supabaseUrl, supabaseServiceKey);

async function seed() {
  console.log("\n🌱 Seeding demo data...\n");

  // Delete existing data for this owner
  console.log("→ Clearing existing data...");
  try {
    await db.from("app_settings").delete().eq("owner_id", ownerId);
  } catch {
    console.log("  (app_settings not found yet)");
  }

  try {
    await db.from("cubers").delete().eq("owner_id", ownerId);
  } catch {
    console.log("  (cubers not found yet)");
  }

  // Create a demo cuber with minimal columns
  console.log("→ Creating demo cuber...");
  const { data: cuber, error: cuberErr } = await db
    .from("cubers")
    .insert([
      {
        owner_id: ownerId,
        name: "Demo Cuber",
        display_name: "Demo",
        wca_id: null,
      },
    ])
    .select("id")
    .single();

  if (cuberErr) {
    console.error("✗ Error creating cuber:", cuberErr.message);
    process.exit(1);
  }

  const cuberId = cuber.id;
  console.log(`✓ Created cuber: ${cuberId}`);

  // Create app settings with minimal columns
  console.log("→ Creating app settings...");
  const { error: settingsErr } = await db.from("app_settings").insert({
    owner_id: ownerId,
    default_cuber_id: cuberId,
  });

  if (settingsErr) {
    console.error("✗ Error creating settings:", settingsErr.message);
    process.exit(1);
  }

  console.log("✓ Created app settings\n");
  console.log("✅ Demo data seeded successfully!");
  console.log(`   Owner ID: ${ownerId}`);
  console.log(`   Cuber ID: ${cuberId}\n`);
  console.log("You can now visit http://localhost:3000/");
  console.log("\nNote: The migrations (0004_avatar_color.sql) have been applied");
  console.log("but Supabase's schema cache is stale. Once you restart your");
  console.log("dev server, the new columns will be available.");
}

seed().catch(console.error);
