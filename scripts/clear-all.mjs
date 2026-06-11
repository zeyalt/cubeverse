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

console.log("🗑️  Clearing ALL data for this owner...");

await db.from("solves").delete().eq("owner_id", ownerId);
await db.from("results").delete().eq("owner_id", ownerId);
await db.from("competitions").delete().eq("owner_id", ownerId);
await db.from("cubes").delete().eq("owner_id", ownerId);
await db.from("cubers").delete().eq("owner_id", ownerId);
await db.from("app_settings").delete().eq("owner_id", ownerId);

console.log("✅ All data cleared!");
