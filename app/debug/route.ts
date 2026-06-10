export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return Response.json(
        { error: "Missing Supabase env vars", supabaseUrl, supabaseKey: supabaseKey ? "set" : "missing" },
        { status: 500 }
      );
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        apikey: supabaseKey,
      },
    });

    return Response.json({
      status: response.status,
      message: "Supabase is reachable",
      supabaseUrl,
    });
  } catch (error) {
    return Response.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
