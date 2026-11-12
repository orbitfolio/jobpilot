"use client";

import { useState } from "react";
import { Field, PageHeader } from "@/components/bits";
import { useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { sendGoogle, sendMagicLink, signOutAccount, supabaseConfigured } from "@/lib/account-sync";
import { downloadJson } from "@/lib/export-docs";
import { FX_NOTE } from "@/lib/currency";
import { isAppData } from "@/lib/seed";
import { completeAi } from "@/lib/secrets";
import { WEIGHT_KEYS, WEIGHT_LABELS, type WeightKey } from "@/lib/types";

export function SettingsView() {
  const { data, update, secrets, setSecrets, replace, resetDemo, setNotice, accountEmail } = useApp();
  const [syncMessage, setSyncMessage] = useState("");
  const [email, setEmail] = useState("");
  if (!data) return <p className="text-sm text-muted-foreground">Opening the desk…</p>;
  const weightSum = WEIGHT_KEYS.reduce((sum, key) => sum + Math.max(0, data.rubric.weights[key] || 0), 0);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Settings" title="The rubric is yours." lede="Weights are normalised, so they do not have to add up to 100. A matched dealbreaker still blocks an apply recommendation when the hard gate is on, separate from its weight. The key never leaves this browser except inside the request you just made." />
      <section className="space-y-3">
        <h2 className="font-heading text-2xl">Weights</h2>
        {WEIGHT_KEYS.map((key) => (
          <label key={key} className="grid grid-cols-[1fr_5rem] items-center gap-3 text-sm">
            <span>{WEIGHT_LABELS[key]} <span className="text-muted-foreground">{weightSum ? Math.round((Math.max(0, data.rubric.weights[key]) / weightSum) * 100) : 0}%</span></span>
            <Input type="number" min={0} value={data.rubric.weights[key]} onChange={(event) => update((draft) => { draft.rubric.weights[key as WeightKey] = Number(event.target.value) || 0; })} />
          </label>
        ))}
        <p className="text-xs text-muted-foreground">Raw total {weightSum || 0}. {weightSum === 0 ? "All zeros means each dimension counts equally." : "The score divides by this total."}</p>
      </section>
      <section className="space-y-3">
        <h2 className="font-heading text-2xl">Apply line · {data.rubric.threshold.toFixed(1)}</h2>
        <Slider min={1} max={5} step={0.1} value={[data.rubric.threshold]} onValueChange={(value) => {
          const next = Array.isArray(value) ? value[0] : value;
          update((draft) => { draft.rubric.threshold = Number(next) || 4; });
        }} />
        <Field label="Consider band" hint="Roles within this many points under the line are marked consider, not skip.">
          <Input type="number" min={0} max={2} step={0.1} value={data.rubric.considerGap} onChange={(event) => update((draft) => { draft.rubric.considerGap = Number(event.target.value) || 0; })} />
        </Field>
        <label className="flex items-center justify-between gap-3 text-sm">
          Dealbreakers are a hard gate
          <Switch checked={data.rubric.dealbreakersAreHardGates} onCheckedChange={(checked) => update((draft) => { draft.rubric.dealbreakersAreHardGates = checked; })} />
        </label>
        <Field label="Hard-gate cap" hint="A blocked role cannot score above this, even if the skills match.">
          <Input type="number" min={1} max={5} step={0.1} value={data.rubric.hardGateCap} onChange={(event) => update((draft) => { draft.rubric.hardGateCap = Number(event.target.value) || 2; })} />
        </Field>
        <p className="text-xs text-muted-foreground">{FX_NOTE}</p>
      </section>
      <section className="space-y-3">
        <h2 className="font-heading text-2xl">Model</h2>
        <p className="text-sm text-muted-foreground">Leave this on “none” and the app still scores, drafts, and tracks. Ollama is called from the browser. OpenAI-compatible and Gemini requests are forwarded by this server and the key is not stored there.</p>
        <Field label="Provider">
          <select className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm" value={secrets.provider} onChange={(event) => {
            const provider = event.target.value as typeof secrets.provider;
            const defaults = provider === "gemini" ? { baseUrl: "https://generativelanguage.googleapis.com", model: "gemini-2.5-flash" } : provider === "ollama" ? { baseUrl: "http://127.0.0.1:11434", model: "llama3.2" } : { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" };
            setSecrets({ ...secrets, provider, ...defaults });
          }}>
            <option value="none">No model</option>
            <option value="openai">OpenAI-compatible</option>
            <option value="gemini">Gemini</option>
            <option value="ollama">Ollama on this computer</option>
          </select>
        </Field>
        <Field label="Base URL"><Input value={secrets.baseUrl} onChange={(event) => setSecrets({ ...secrets, baseUrl: event.target.value })} /></Field>
        <Field label="Model"><Input value={secrets.model} onChange={(event) => setSecrets({ ...secrets, model: event.target.value })} /></Field>
        <Field label="API key" hint="Stored in localStorage only. It is not included in the JSON export.">
          <Input type="password" value={secrets.apiKey} autoComplete="off" onChange={(event) => setSecrets({ ...secrets, apiKey: event.target.value })} />
        </Field>
        <Button type="button" variant="outline" onClick={async () => {
          const result = await completeAi(secrets, [{ role: "user", content: "Reply with the single word ready." }]);
          setNotice(result.error || result.text || "No reply.");
        }}>Send a one-word test</Button>
      </section>
      <section className="space-y-3">
        <h2 className="font-heading text-2xl">Scan and digest</h2>
        <label className="flex items-center justify-between gap-3 text-sm">Scan when I open the app if the last scan is over 20 hours old
          <Switch checked={data.settings.autoScanOnOpen} onCheckedChange={(checked) => update((draft) => { draft.settings.autoScanOnOpen = checked; })} />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">Browser notification after new matches
          <Switch checked={data.settings.browserNotifications} onCheckedChange={async (checked) => {
            if (checked && "Notification" in window) await Notification.requestPermission();
            update((draft) => { draft.settings.browserNotifications = checked; });
          }} />
        </label>
        <Field label="Follow-up after days"><Input type="number" min={1} value={data.settings.followUpDays} onChange={(event) => update((draft) => { draft.settings.followUpDays = Number(event.target.value) || 7; })} /></Field>
        <label className="flex items-center justify-between gap-3 text-sm">Digest webhook
          <Switch checked={data.settings.digestEnabled} onCheckedChange={(checked) => update((draft) => { draft.settings.digestEnabled = checked; })} />
        </label>
        <Field label="Webhook URL" hint="Off by default. Posting sends JSON to your https endpoint. This app has no mail transport.">
          <Input value={data.settings.digestWebhookUrl} onChange={(event) => update((draft) => { draft.settings.digestWebhookUrl = event.target.value; })} placeholder="https://" />
        </Field>
        <Button type="button" variant="outline" onClick={async () => {
          const response = await fetch("/api/digest", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              enabled: data.settings.digestEnabled,
              webhookUrl: data.settings.digestWebhookUrl,
              matches: data.matches.filter((match) => match.status === "new").slice(0, 15).map((match) => ({ title: match.title, company: match.company, url: match.url, location: match.location })),
            }),
          });
          const body = (await response.json()) as { message?: string; error?: string };
          setNotice(body.message || body.error || "Digest request finished.");
        }}>Post digest now</Button>
      </section>
      <section className="space-y-3">
        <h2 className="font-heading text-2xl">Your copy of the data</h2>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => downloadJson("career-ops-by-vish.json", data)}>Export JSON</Button>
          <Button type="button" variant="outline" onClick={() => document.getElementById("import-snapshot")?.click()}>Import JSON</Button>
          <Button type="button" variant="outline" onClick={resetDemo}>Restore demo</Button>
          <input id="import-snapshot" type="file" accept="application/json" className="hidden" onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const parsed = JSON.parse(await file.text()) as unknown;
            if (!isAppData(parsed)) setNotice("That file is not a version 1 snapshot.");
            else replace(parsed);
          }} />
        </div>
        <h2 className="font-heading text-2xl">Sign in</h2>
        {supabaseConfigured() ? (
          accountEmail ? (
            <div className="space-y-2 text-sm">
              <p>Signed in as {accountEmail}. This browser syncs your tracker, CV, profile, rubric, searches, and reports. AI keys stay in this browser.</p>
              <Button type="button" variant="outline" onClick={() => void signOutAccount()}>Sign out</Button>
            </div>
          ) : (
            <form className="grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={async (event) => { event.preventDefault(); setSyncMessage(await sendMagicLink(email.trim())); }}>
              <Input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" aria-label="Email" />
              <Button type="submit">Email me a link</Button>
              <Button type="button" variant="outline" className="sm:col-span-2" onClick={async () => setSyncMessage(await sendGoogle())}>Continue with Google</Button>
            </form>
          )
        ) : (
          <p className="text-sm text-muted-foreground">Sign-in is off until NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set. This browser keeps the only copy, and that still works offline.</p>
        )}
        {syncMessage ? <p className="text-sm">{syncMessage}</p> : null}
      </section>
    </div>
  );
}
