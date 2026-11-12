"use client";

import { PageHeader } from "@/components/bits";
import { useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { negotiationDraft } from "@/lib/tailor";
import { CURRENCIES, type CurrencyCode, type OfferNote } from "@/lib/types";
import { createId, formatMoney } from "@/lib/text";

export function OffersView() {
  const { data, update } = useApp();
  if (!data) return <p className="text-sm text-muted-foreground">Opening the desk…</p>;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Offers"
        title="Read the number before you answer it."
        lede="The draft will not suggest a base under the floor in your profile. These notes are a personal checklist, not legal advice. Nothing is sent to the employer."
        actions={<Button type="button" onClick={() => update((draft) => draft.offers.unshift(blankOffer(draft.profile.salary.currency, draft.profile.salary.min, draft.profile.salary.max)))}>Add an offer</Button>}
      />
      {data.offers.map((offer) => (
        <OfferCard key={offer.id} offer={offer} />
      ))}
    </div>
  );
}

function OfferCard({ offer }: { offer: OfferNote }) {
  const { update } = useApp();
  const patch = (recipe: (offer: OfferNote) => void) => update((draft) => {
    const row = draft.offers.find((item) => item.id === offer.id);
    if (!row) return;
    recipe(row);
    row.updatedAt = new Date().toISOString();
  });
  const script = negotiationDraft({
    currency: offer.currency,
    desiredMin: offer.desiredMin,
    desiredMax: offer.desiredMax,
    actualBase: offer.actualBase,
    company: offer.company,
  });
  const gap = offer.actualBase == null ? null : offer.actualBase - offer.desiredMin;
  return (
    <article className="space-y-3 rounded-xl border border-border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input value={offer.company} onChange={(event) => patch((row) => { row.company = event.target.value; })} />
        <Input value={offer.role} onChange={(event) => patch((row) => { row.role = event.target.value; })} />
        <label className="grid gap-1 text-sm">Currency
          <select className="h-9 rounded-lg border border-input bg-transparent px-2" value={offer.currency} onChange={(event) => patch((row) => { row.currency = event.target.value as CurrencyCode; })}>
            {CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
          </select>
        </label>
        <NumberField label="Floor" value={offer.desiredMin} onChange={(value) => patch((row) => { row.desiredMin = value; })} />
        <NumberField label="Target top" value={offer.desiredMax} onChange={(value) => patch((row) => { row.desiredMax = value; })} />
        <NumberField label="Advertised min" value={offer.advertisedMin ?? 0} onChange={(value) => patch((row) => { row.advertisedMin = value || null; })} />
        <NumberField label="Advertised max" value={offer.advertisedMax ?? 0} onChange={(value) => patch((row) => { row.advertisedMax = value || null; })} />
        <NumberField label="Actual base" value={offer.actualBase ?? 0} onChange={(value) => patch((row) => { row.actualBase = value || null; })} />
      </div>
      <p className="text-sm">{gap == null ? "No actual base yet." : gap >= 0 ? `The actual base is ${formatMoney(gap, offer.currency)} above your floor.` : `The actual base is ${formatMoney(Math.abs(gap), offer.currency)} under your floor.`}</p>
      <Textarea value={offer.bonus} onChange={(event) => patch((row) => { row.bonus = event.target.value; })} placeholder="Bonus" />
      <Textarea value={offer.equity} onChange={(event) => patch((row) => { row.equity = event.target.value; })} placeholder="Equity" />
      <Textarea value={offer.notes} onChange={(event) => patch((row) => { row.notes = event.target.value; })} placeholder="Your notes" />
      <div className="rounded-lg bg-muted p-3 text-sm leading-6">{script}</div>
      <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(script)}>Copy negotiation note</Button>
      <ul className="list-disc pl-5 text-sm">
        {offer.lawyerQuestions.map((question) => <li key={question}>{question}</li>)}
      </ul>
    </article>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="grid gap-1 text-sm">{label}
      <Input type="number" value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} />
    </label>
  );
}

function blankOffer(currency: CurrencyCode, min: number, max: number): OfferNote {
  return {
    id: createId("offer"),
    applicationId: null,
    company: "",
    role: "",
    currency,
    desiredMin: min,
    desiredMax: max,
    advertisedMin: null,
    advertisedMax: null,
    actualBase: null,
    bonus: "",
    equity: "",
    notes: "",
    lawyerQuestions: [
      "Which parts of pay are guaranteed?",
      "What does the termination clause do to bonus and equity?",
      "Is there a non-compete, and where does it apply?",
    ],
    updatedAt: new Date().toISOString(),
  };
}
