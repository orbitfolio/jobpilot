import { assertPublicUrl, safeFetch } from "@/server/http";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    enabled?: boolean;
    webhookUrl?: string;
    matches?: { title?: string; company?: string; url?: string; location?: string }[];
  } | null;
  if (!body?.enabled) {
    return Response.json({ ok: false, error: "The digest hook is off. Turn it on before posting." }, { status: 400 });
  }
  const webhookUrl = body.webhookUrl?.trim() ?? "";
  let target: URL;
  try {
    target = new URL(webhookUrl);
  } catch {
    return Response.json({ ok: false, error: "Enter a full webhook URL." }, { status: 400 });
  }
  if (target.protocol !== "https:") {
    return Response.json({ ok: false, error: "The digest webhook must be https." }, { status: 400 });
  }
  const payload = {
    type: "career-ops-by-vish-digest",
    note: "This is a JSON digest you asked to post. Career Ops does not send email and does not submit applications.",
    sentAt: new Date().toISOString(),
    matches: (body.matches ?? []).slice(0, 30),
  };
  await assertPublicUrl(target.toString());
  const { response } = await safeFetch(target.toString(), {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) return Response.json({ ok: false, error: `The webhook returned HTTP ${response.status}.` }, { status: 502 });
  return Response.json({ ok: true, message: "Posted a JSON digest to your webhook. No email was sent." });
}
