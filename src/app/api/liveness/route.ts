import { checkLiveness } from "@/server/liveness";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { url?: string } | null;
  const url = body?.url?.trim() ?? "";
  if (!url) return Response.json({ error: "Paste a job URL to check." }, { status: 400 });
  const result = await checkLiveness(url);
  return Response.json(result);
}
