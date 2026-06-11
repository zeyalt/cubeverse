import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env.local");

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

const db = createClient(supabaseUrl, supabaseServiceKey);

console.log("🔍 Checking for cubers without avatar_color...\n");

const { data: cubers } = await db
  .from("cubers")
  .select("id, name, avatar_color")
  .eq("owner_id", ownerId);

const needsUpdate = cubers?.filter(c => !c.avatar_color) || [];

if (needsUpdate.length === 0) {
  console.log("✓ All cubers have avatar_color set!");
  process.exit(0);
}

console.log(`Found ${needsUpdate.length} cuber(s) without avatar_color:\n`);

const colors = ["gold", "blue", "green", "purple", "orange", "pink", "red", "cyan"];
let colorIdx = 0;

for (const cuber of needsUpdate) {
  const color = colors[colorIdx % colors.length];
  const { error } = await db
    .from("cubers")
    .update({ avatar_color: color })
    .eq("id", cuber.id);

  if (error) {
    console.error(`✗ Failed to update ${cuber.name}:`, error.message);
  } else {
    console.log(`✓ ${cuber.name} → ${color}`);
  }
  
  colorIdx++;
}

console.log("\n✅ Avatar colors fixed!");
