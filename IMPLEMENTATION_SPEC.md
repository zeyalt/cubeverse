# Multi-User Selection Flow - Implementation Specification

## Overview
This spec details the implementation of the multi-user cuber selection flow for Cubeverse. The flow handles onboarding, adding multiple cubers (max 4), and navigating between them.

---

## File 1: `app/user-select/page.tsx` (NEW FILE)

**Purpose**: Display all cubers for the current user as selectable cards. This page is shown:
1. After adding a 2nd+ cuber (post-onboarding redirect)
2. When user manually navigates to `/user-select`

### Implementation Details

```tsx
"use server";

import { redirect } from "next/navigation";
import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";
import { switchCuber } from "@/app/actions/onboarding";

const AVATAR_HEX: Record<string, string> = {
  gold: "#FFD500",
  blue: "#0046AD",
  green: "#009B48",
  purple: "#B71234",
  orange: "#FF9800",
  pink: "#E91E63",
  red: "#F44336",
  cyan: "#00BCD4",
};

export default async function UserSelectPage() {
  const db = getServiceClient();
  const ownerId = getOwnerId();

  // Check if user has completed onboarding
  const { data: settings } = await db
    .from("app_settings")
    .select("default_cuber_id")
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!settings?.default_cuber_id) {
    // User hasn't completed onboarding yet
    redirect("/onboarding");
  }

  // Fetch all cubers for this owner
  const { data: cubers, error } = await db
    .from("cubers")
    .select("id, name, display_name, avatar_color")
    .eq("owner_id", ownerId)
    .order("name");

  if (error || !cubers) {
    console.error("Failed to fetch cubers:", error);
    redirect("/");
  }

  if (cubers.length === 0) {
    // No cubers found (shouldn't happen in normal flow)
    redirect("/onboarding");
  }

  // Create client component for selection UI
  return (
    <UserSelectClient cubers={cubers} />
  );
}

// Client component for interactivity
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { switchCuber } from "@/app/actions/onboarding";

interface Cuber {
  id: string;
  name: string;
  display_name: string | null;
  avatar_color: string;
}

function UserSelectClient({ cubers }: { cubers: Cuber[] }) {
  const [isPending, startTransition] = useTransition();

  function handleSelectCuber(cuberId: string) {
    startTransition(() => switchCuber(cuberId));
  }

  const AVATAR_HEX: Record<string, string> = {
    gold: "#FFD500",
    blue: "#0046AD",
    green: "#009B48",
    purple: "#B71234",
    orange: "#FF9800",
    pink: "#E91E63",
    red: "#F44336",
    cyan: "#00BCD4",
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-8">
      <div className="kid-animate-in w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="font-display text-4xl font-extrabold mb-2">
            Pick your cuber
          </h1>
          <p className="text-lg text-white/60">
            Who's cubing today?
          </p>
        </div>

        {/* Cuber selection grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {cubers.map((cuber) => {
            const color = AVATAR_HEX[cuber.avatar_color] ?? "#0046AD";
            return (
              <button
                key={cuber.id}
                onClick={() => handleSelectCuber(cuber.id)}
                disabled={isPending}
                className="sticker flex flex-col items-center gap-3 rounded-2xl border-2 border-[#0A0A0A] bg-white/10 px-4 py-6 transition-all hover:bg-white/15 active:scale-95 disabled:opacity-50"
              >
                {/* Avatar circle */}
                <div
                  className="size-16 shrink-0 rounded-full border-3"
                  style={{
                    backgroundColor: color,
                    borderColor: "#FFD500",
                  }}
                />
                {/* Name */}
                <span className="text-center font-bold text-white text-sm">
                  {cuber.display_name ?? cuber.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Back link */}
        <div className="text-center">
          <Link
            href="/"
            className="text-white/60 hover:text-white transition-colors text-sm"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
```

### Key Points
- Server component validates onboarding completion
- Client component handles interactive selection
- Uses `switchCuber()` action which handles redirect to home
- Displays avatar color circle for visual identification
- Responsive grid layout (2 cols mobile, 3 tablet, 4 desktop)

---

## File 2: `app/actions/onboarding.ts` (MODIFY)

**Changes**: Modify `completeOnboarding()` to count existing cubers and redirect appropriately.

### Current Code (lines 37-128)
Replace the `completeOnboarding` function with:

```typescript
export async function completeOnboarding({
  name,
  wcaId,
  avatarColor,
}: {
  name: string;
  wcaId: string | null;
  avatarColor: string;
}): Promise<FormState> {
  if (!name?.trim()) return { error: "Name is required." };
  if (!avatarColor) return { error: "Avatar color is required." };

  const db = getServiceClient();
  const ownerId = getOwnerId();

  // COUNT EXISTING CUBERS (new logic)
  const { data: existingCubers, error: countErr } = await db
    .from("cubers")
    .select("id", { count: "exact" })
    .eq("owner_id", ownerId);

  if (countErr) {
    return { error: "Failed to check cuber count" };
  }

  const cuberCount = existingCubers?.length ?? 0;

  // CHECK MAX 4 CUBERS LIMIT (new logic)
  if (cuberCount >= 4) {
    return { error: "Maximum 4 cubers per account. Delete one to add another." };
  }

  // Insert cuber with avatar color (try with avatar_color, fallback if schema cache is stale)
  let cuber: { id: string } | null = null;
  let cuberErr: any = null;

  const cuberInsert = {
    owner_id: ownerId,
    name: name.trim(),
    display_name: name.trim(),
    wca_id: wcaId || null,
    avatar_color: avatarColor,
  };

  const result = await db
    .from("cubers")
    .insert(cuberInsert)
    .select("id")
    .single();

  cuber = result.data;
  cuberErr = result.error;

  // If schema cache is stale, try without avatar_color
  if (cuberErr && cuberErr.message?.includes("avatar_color")) {
    const fallbackInsert = {
      owner_id: ownerId,
      name: name.trim(),
      display_name: name.trim(),
      wca_id: wcaId || null,
    };

    const fallbackResult = await db
      .from("cubers")
      .insert(fallbackInsert)
      .select("id")
      .single();

    cuber = fallbackResult.data;
    cuberErr = fallbackResult.error;

    if (!cuberErr) {
      console.warn("Avatar color not saved due to schema cache - will update after refresh");
    }
  }

  if (cuberErr || !cuber) return { error: cuberErr?.message || "Failed to create cuber" };

  console.log("[completeOnboarding] Created cuber:", cuber.id);

  // Upsert app settings (insert or update if already exists)
  // Try with current_cuber_id first, fallback if schema cache is stale
  let settingsResult = await db.from("app_settings").upsert({
    owner_id: ownerId,
    default_cuber_id: cuber.id,
    current_cuber_id: cuber.id,
  });

  let settingsErr = settingsResult.error;

  // If schema cache is stale, try without current_cuber_id
  if (settingsErr && settingsErr.message?.includes("current_cuber_id")) {
    console.warn("[completeOnboarding] current_cuber_id not available due to schema cache - will update after refresh");
    settingsResult = await db.from("app_settings").upsert({
      owner_id: ownerId,
      default_cuber_id: cuber.id,
    });
    settingsErr = settingsResult.error;
  }

  if (settingsErr) {
    console.error("[completeOnboarding] Settings upsert error:", settingsErr.message);
    return { error: settingsErr.message };
  }

  console.log("[completeOnboarding] Successfully upserted app_settings for owner:", ownerId);

  // REDIRECT LOGIC (new logic at the end)
  // If this is the first cuber (count was 0), redirect to home
  // If this is a subsequent cuber (count >= 1), redirect to user-select
  if (cuberCount === 0) {
    redirect("/");
  } else {
    redirect("/user-select");
  }
  
  // NOTE: This function doesn't return normally; the redirect throws
  return { error: null };
}
```

### Key Changes
1. **Count existing cubers** before insertion (line ~52-58)
2. **Validate max 4 limit** (line ~60-63)
3. **Conditional redirect** at end of function (line ~128-135):
   - First cuber → redirect to "/" (home)
   - 2nd+ cuber → redirect to "/user-select" (selector page)
4. Return statement at end is unreachable due to redirect but needed for type safety

### Database Query Explanation
```typescript
// Count existing cubers for this owner
const { data: existingCubers, error: countErr } = await db
  .from("cubers")
  .select("id", { count: "exact" })
  .eq("owner_id", ownerId);

const cuberCount = existingCubers?.length ?? 0;
```
- Uses `.select("id", { count: "exact" })` to count rows
- `existingCubers?.length` gives the count (or 0 if null)

---

## File 3: `app/onboarding/avatar/page.tsx` (MODIFY)

**Changes**: Remove the client-side router.push("/") since completeOnboarding now handles all redirects server-side.

### Line 56-57 (REMOVE)
```typescript
// REMOVE THESE LINES:
// Clear sessionStorage and redirect to home
sessionStorage.removeItem("onboarding_name");
sessionStorage.removeItem("onboarding_wca_id");
router.push("/");
```

### Replacement Code (lines 40-62)
Replace the submit handler with:

```typescript
function handleSubmit() {
  startTransition(async () => {
    try {
      const result = await completeOnboarding({
        name,
        wcaId: wcaId === "skip" || !wcaId ? null : wcaId,
        avatarColor: selectedColor,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      // Clear sessionStorage
      // (server action will handle redirect, no client-side router.push needed)
      sessionStorage.removeItem("onboarding_name");
      sessionStorage.removeItem("onboarding_wca_id");
      
      // completeOnboarding() calls redirect() server-side
      // which will throw NavigationError - no need to handle here
    } catch (err) {
      setError("Failed to complete onboarding");
    }
  });
}
```

### Why This Change
- `completeOnboarding()` now calls `redirect()` server-side via Next.js
- Client-side `router.push()` was causing race conditions
- Server-side redirect is guaranteed to execute first
- Removes duplicate redirect logic

---

## File 4: `components/kid/CuberSwitcherSheet.tsx` (MINOR REVIEW)

**Current State**: Already correct! No changes needed.

### Current Implementation (lines 113-119)
```typescript
{/* Add cuber button */}
<Link
  href="/onboarding/name"
  className="sticker flex items-center justify-center gap-2 rounded-xl border-2 border-white/20 bg-white/10 px-4 py-3 font-bold text-white transition-all hover:bg-white/15"
>
  <Plus className="size-5" />
  Add new cuber
</Link>
```

**Status**: ✅ Correct
- Links to `/onboarding/name` (start of new cuber onboarding)
- `completeOnboarding()` will redirect to `/user-select` automatically
- No changes needed

### Verify CuberSwitch Behavior
The `switchCuber()` call (line 44):
```typescript
startTransition(() => switchCuber(cuberId));
```

Current `switchCuber()` implementation (lines 130-138 in onboarding.ts):
```typescript
export async function switchCuber(cuberId: string): Promise<void> {
  const db = getServiceClient();
  const ownerId = getOwnerId();
  await db
    .from("app_settings")
    .update({ current_cuber_id: cuberId })
    .eq("owner_id", ownerId);
  redirect("/");
}
```

**Status**: ✅ Correct
- Updates `current_cuber_id` in database
- Redirects to "/" (home)
- No changes needed

---

## File 5: `app/onboarding/page.tsx` (REVIEW ONLY)

**Current State**: Already correct! No changes needed.

### How It Interacts With New Flow
1. **First-time user**: 
   - No app_settings → shows welcome + "Create New Cuber" button
   - Click → `/onboarding/name` → onboarding flow → redirect to "/"

2. **Already onboarded user accessing `/onboarding`**:
   - Has app_settings.default_cuber_id → redirects to "/" (line 19)
   - User never sees this page

3. **Adding 2nd cuber**:
   - Already onboarded, clicks "Add new cuber"
   - Goes to `/onboarding/name` → onboarding flow → redirect to "/user-select"
   - This page is skipped (onboarded already)

**Status**: ✅ No changes needed

---

## Edge Cases & Error Handling

### Edge Case 1: User tries to add 5th cuber
**Location**: `completeOnboarding()` at line ~60-63

**Handling**:
```typescript
if (cuberCount >= 4) {
  return { error: "Maximum 4 cubers per account. Delete one to add another." };
}
```
- Returns FormState with error message
- Client component displays error in red text
- No cuber inserted, no settings updated
- User can try again or delete a cuber first

### Edge Case 2: Race condition (two cubers added simultaneously)
**Risk Level**: Low (unlikely in kid app)
**Mitigation**: 
- Database constraint could be added: `UNIQUE constraint on (owner_id, name)` or `CHECK COUNT` via trigger
- Currently handled at app level (count check before insert)
- If race occurs: second insert would fail, return error to user

### Edge Case 3: User manually navigates to `/user-select` when no cubers exist
**Location**: `app/user-select/page.tsx` line ~35-40

**Handling**:
```typescript
if (!settings?.default_cuber_id) {
  // User hasn't completed onboarding yet
  redirect("/onboarding");
}

if (cubers.length === 0) {
  // No cubers found (shouldn't happen in normal flow)
  redirect("/onboarding");
}
```
- Validates onboarding completion
- Validates cubers exist
- Redirects to onboarding if either check fails

### Edge Case 4: User on home page, no current_cuber_id set
**Location**: `app/page.tsx` line 50

**Handling**:
```typescript
const currentCuberId = (settings.current_cuber_id ?? settings.default_cuber_id) as string;
```
- Falls back to `default_cuber_id` if `current_cuber_id` is null
- Home page always has a valid cuber to display

### Edge Case 5: User deletes all cubers (edge case, shouldn't happen in UI)
**Risk Level**: Very low (no delete UI in app)
**What happens**:
- Next home page load finds no default_cuber_id
- Redirects to `/onboarding`
- User can create new cuber

---

## Database Queries Summary

### completeOnboarding() - Count Existing Cubers
```sql
SELECT id FROM cubers WHERE owner_id = $1
```
**Cost**: O(n) where n = number of cubers (max 4, negligible)

### completeOnboarding() - Insert Cuber
```sql
INSERT INTO cubers (owner_id, name, display_name, wca_id, avatar_color)
VALUES ($1, $2, $2, $3, $4)
RETURNING id
```
**Constraints Checked**:
- `owner_id` is valid foreign key reference to auth.users
- `avatar_color` matches enum (gold|blue|green|purple|orange|pink|red|cyan)
- RLS policy: `owner_id = auth.uid()`

### completeOnboarding() - Upsert Settings
```sql
INSERT INTO app_settings (owner_id, default_cuber_id, current_cuber_id)
VALUES ($1, $2, $2)
ON CONFLICT (owner_id) DO UPDATE SET
  default_cuber_id = $2,
  current_cuber_id = $2
```
**Constraints Checked**:
- `owner_id` is primary key
- `default_cuber_id` and `current_cuber_id` are valid foreign keys to cubers

### switchCuber() - Update Current Cuber
```sql
UPDATE app_settings SET current_cuber_id = $1 WHERE owner_id = $2
```
**Constraints Checked**:
- `current_cuber_id` is valid foreign key to cubers
- RLS policy: `owner_id = auth.uid()`

---

## Data Flow Diagram

### Scenario 1: First-time launch
```
User opens app
  ↓
app/page.tsx checks app_settings
  ↓ (no settings found)
redirects to /onboarding
  ↓
/onboarding/page.tsx shows welcome
  ↓
User clicks "Create New Cuber"
  ↓
/onboarding/name → /onboarding/wca-id → /onboarding/avatar
  ↓
completeOnboarding() called
  ├─ Count: 0 cubers exist
  ├─ Insert cuber ✓
  ├─ Upsert settings ✓
  └─ redirect("/") [1st cuber]
      ↓
  app/page.tsx loads with new cuber
  ↓
User sees HOME page
```

### Scenario 2: Add 2nd cuber (while already using app)
```
User on HOME page
  ↓
Clicks CuberSwitcherSheet → "Add new cuber"
  ↓
Navigates to /onboarding/name
  ↓
/onboarding/name → /onboarding/wca-id → /onboarding/avatar
  ↓
completeOnboarding() called
  ├─ Count: 1 cuber exists
  ├─ Insert cuber ✓
  ├─ Upsert settings ✓
  └─ redirect("/user-select") [2nd+ cuber]
      ↓
  /user-select page shows all 2 cubers
  ↓
User clicks one of them
  ↓
switchCuber() called → update current_cuber_id → redirect("/")
  ↓
User sees HOME page with selected cuber
```

### Scenario 3: Switch between existing cubers
```
User on HOME page
  ↓
Opens CuberSwitcherSheet
  ↓
Clicks different cuber
  ↓
switchCuber(cuberId) called
  ├─ Update current_cuber_id in settings
  └─ redirect("/")
      ↓
  app/page.tsx reloads with new currentCuberId
  ↓
User sees HOME page with different cuber
```

---

## Testing Checklist

- [ ] **First-time onboarding**: New user → name → WCA ID → avatar → lands on HOME
- [ ] **Add 2nd cuber**: Click "Add new cuber" → complete onboarding → see /user-select → pick cuber → land on HOME
- [ ] **Add 3rd & 4th cuber**: Repeat above, verify page works with 2, 3, 4 cubers
- [ ] **Add 5th cuber attempt**: Try to add 5th → see error message → cuber NOT created
- [ ] **Switch between cubers**: Use switcher sheet → click different cuber → land on HOME with that cuber
- [ ] **Manual navigation to /user-select**: Already onboarded → navigate to /user-select → see all cubers
- [ ] **Manual navigation to /user-select (not onboarded)**: Not onboarded → navigate to /user-select → redirect to /onboarding
- [ ] **Session persistence**: Add cuber A, switch to B, close app, reopen → still on cuber B's HOME
- [ ] **Error states**: All error messages display correctly (max cubers, failed insert, etc.)

---

## Summary of Changes

| File | Type | Lines Affected | Summary |
|------|------|-----------------|---------|
| `app/user-select/page.tsx` | NEW | N/A | New selector page showing all cubers as cards |
| `app/actions/onboarding.ts` | MODIFY | 37-128 | Add cuber count logic, max 4 validation, conditional redirect |
| `app/onboarding/avatar/page.tsx` | MODIFY | 40-62 | Remove client-side router.push, rely on server redirect |
| `components/kid/CuberSwitcherSheet.tsx` | REVIEW | N/A | No changes needed ✓ |
| `app/onboarding/page.tsx` | REVIEW | N/A | No changes needed ✓ |

