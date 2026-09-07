declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

const WCA_BASE = "https://www.worldcubeassociation.org/api/v0";
const ID = /^[A-Za-z0-9-]+$/;

function cors(origin: string | null): HeadersInit {
  const configured = Deno.env.get("APP_ORIGIN");
  const allowed = configured && origin === configured ? origin : configured ?? "*";
  return {
    "access-control-allow-origin": allowed,
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
    "access-control-allow-methods": "GET, OPTIONS",
    "cache-control": "public, max-age=300, stale-while-revalidate=3600",
    vary: "origin",
  };
}

Deno.serve(async (request) => {
  const headers = cors(request.headers.get("origin"));
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "GET") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers });
  }

  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return Response.json({ error: "Authentication required" }, { status: 401, headers });
  }

  const url = new URL(request.url);
  const resource = url.searchParams.get("resource");
  const id = url.searchParams.get("id")?.trim();
  if (!id || !ID.test(id) || !["person", "results", "competition"].includes(resource ?? "")) {
    return Response.json({ error: "Invalid WCA request" }, { status: 400, headers });
  }

  const path =
    resource === "competition"
      ? `/competitions/${encodeURIComponent(id)}`
      : `/persons/${encodeURIComponent(id)}${resource === "results" ? "/results" : ""}`;

  try {
    const response = await fetch(`${WCA_BASE}${path}`, {
      headers: { accept: "application/json", "user-agent": "Cubeverse/1.0" },
    });
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: { ...headers, "content-type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return Response.json({ error: "WCA service unavailable" }, { status: 502, headers });
  }
});
