"use client";

import { Field, LinesField, PageHeader } from "@/components/bits";
import { useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AUTH_LABELS, AUTH_STATUSES, CURRENCIES, SENIORITY_LEVELS, WORK_MODELS, type AuthStatus, type CurrencyCode, type MasterCv, type Profile, type Seniority } from "@/lib/types";
import { createId } from "@/lib/text";

export function ProfileView() {
  const { data, update } = useApp();
  if (!data) return <p className="text-sm text-muted-foreground">Opening the desk…</p>;
  const profile = data.profile;
  const cv = data.cv;
  const patchProfile = (recipe: (profile: Profile) => void) => update((draft) => recipe(draft.profile));
  const patchCv = (recipe: (cv: MasterCv) => void) => update((draft) => recipe(draft.cv));

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Profile" title="The record the score is allowed to use." lede="Work authorisation and the salary floor are part of the rubric, not an afterthought. Currency is yours. Avery's demo profile is a permanent resident of Canada who would need sponsorship in the United States." />
      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Name"><Input value={profile.fullName} onChange={(event) => patchProfile((row) => { row.fullName = event.target.value; })} /></Field>
        <Field label="Headline"><Input value={profile.headline} onChange={(event) => patchProfile((row) => { row.headline = event.target.value; })} /></Field>
        <Field label="Email"><Input value={profile.email} onChange={(event) => patchProfile((row) => { row.email = event.target.value; })} /></Field>
        <Field label="Phone"><Input value={profile.phone} onChange={(event) => patchProfile((row) => { row.phone = event.target.value; })} /></Field>
        <Field label="Location"><Input value={profile.location} onChange={(event) => patchProfile((row) => { row.location = event.target.value; })} /></Field>
        <Field label="City"><Input value={profile.city} onChange={(event) => patchProfile((row) => { row.city = event.target.value; })} /></Field>
        <Field label="Country"><Input value={profile.country} onChange={(event) => patchProfile((row) => { row.country = event.target.value; })} /></Field>
        <Field label="Years of experience"><Input type="number" value={profile.yearsExperience} onChange={(event) => patchProfile((row) => { row.yearsExperience = Number(event.target.value) || 0; })} /></Field>
        <Field label="Seniority">
          <select className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm" value={profile.seniority} onChange={(event) => patchProfile((row) => { row.seniority = event.target.value as Seniority; })}>
            {SENIORITY_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
          </select>
        </Field>
        <Field label="Notice period"><Input value={profile.noticePeriod} onChange={(event) => patchProfile((row) => { row.noticePeriod = event.target.value; })} /></Field>
      </section>
      <section className="space-y-3">
        <h2 className="font-heading text-2xl">Work model</h2>
        <div className="flex flex-wrap gap-3 text-sm">
          {WORK_MODELS.map((model) => (
            <label key={model} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={profile.workModel.includes(model)}
                onChange={(event) => patchProfile((row) => {
                  row.workModel = event.target.checked ? [...row.workModel, model] : row.workModel.filter((item) => item !== model);
                })}
              />
              {model}
            </label>
          ))}
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={profile.willingToRelocate} onChange={(event) => patchProfile((row) => { row.willingToRelocate = event.target.checked; })} />
            Willing to relocate
          </label>
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="font-heading text-2xl">Salary floor</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Currency">
            <select className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm" value={profile.salary.currency} onChange={(event) => patchProfile((row) => { row.salary.currency = event.target.value as CurrencyCode; })}>
              {CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
            </select>
          </Field>
          <Field label="Minimum"><Input type="number" value={profile.salary.min} onChange={(event) => patchProfile((row) => { row.salary.min = Number(event.target.value) || 0; })} /></Field>
          <Field label="Maximum"><Input type="number" value={profile.salary.max} onChange={(event) => patchProfile((row) => { row.salary.max = Number(event.target.value) || 0; })} /></Field>
        </div>
        <p className="text-xs text-muted-foreground">Ranges in other currencies are converted with static approximate rates for scoring only.</p>
      </section>
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl">Work authorisation</h2>
          <Button type="button" variant="outline" onClick={() => patchProfile((row) => row.workAuthorization.push({ id: createId("auth"), country: "", status: "needs_sponsorship", note: "" }))}>Add country</Button>
        </div>
        {profile.workAuthorization.map((entry) => (
          <div key={entry.id} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1fr_12rem_1fr_auto]">
            <Input value={entry.country} placeholder="Country" onChange={(event) => patchProfile((row) => { const item = row.workAuthorization.find((auth) => auth.id === entry.id); if (item) item.country = event.target.value; })} />
            <select className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm" value={entry.status} onChange={(event) => patchProfile((row) => { const item = row.workAuthorization.find((auth) => auth.id === entry.id); if (item) item.status = event.target.value as AuthStatus; })}>
              {AUTH_STATUSES.map((status) => <option key={status} value={status}>{AUTH_LABELS[status]}</option>)}
            </select>
            <Input value={entry.note} placeholder="Note" onChange={(event) => patchProfile((row) => { const item = row.workAuthorization.find((auth) => auth.id === entry.id); if (item) item.note = event.target.value; })} />
            <Button type="button" variant="ghost" onClick={() => patchProfile((row) => { row.workAuthorization = row.workAuthorization.filter((auth) => auth.id !== entry.id); })}>Remove</Button>
          </div>
        ))}
      </section>
      <section className="grid gap-4">
        <LinesField label="Target titles" value={profile.targetTitles} onChange={(next) => patchProfile((row) => { row.targetTitles = next; })} />
        <LinesField label="Preferred cities" value={profile.preferredCities} onChange={(next) => patchProfile((row) => { row.preferredCities = next; })} />
        <LinesField label="Preferred countries" value={profile.preferredCountries} onChange={(next) => patchProfile((row) => { row.preferredCountries = next; })} />
        <LinesField label="Preferred companies" value={profile.preferredCompanies} onChange={(next) => patchProfile((row) => { row.preferredCompanies = next; })} />
        <LinesField label="Avoided companies" value={profile.avoidedCompanies} onChange={(next) => patchProfile((row) => { row.avoidedCompanies = next; })} />
        <LinesField label="Dealbreakers" hint="One phrase per line. A match can hard-gate the recommendation." value={profile.dealbreakers} onChange={(next) => patchProfile((row) => { row.dealbreakers = next; })} />
      </section>
      <section className="space-y-3">
        <h2 className="font-heading text-2xl">Master CV</h2>
        <Field label="Summary">
          <Textarea value={cv.summary} onChange={(event) => patchCv((row) => { row.summary = event.target.value; })} />
        </Field>
        <LinesField label="Skills" value={cv.skills} onChange={(next) => patchCv((row) => { row.skills = next; })} />
        {cv.roles.map((role) => (
          <div key={role.id} className="space-y-2 rounded-xl border border-border p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Input value={role.title} onChange={(event) => patchCv((draft) => { const item = draft.roles.find((row) => row.id === role.id); if (item) item.title = event.target.value; })} />
              <Input value={role.company} onChange={(event) => patchCv((draft) => { const item = draft.roles.find((row) => row.id === role.id); if (item) item.company = event.target.value; })} />
              <Input value={role.location} onChange={(event) => patchCv((draft) => { const item = draft.roles.find((row) => row.id === role.id); if (item) item.location = event.target.value; })} />
              <Input value={`${role.start} – ${role.end ?? "present"}`} onChange={(event) => patchCv((draft) => {
                const item = draft.roles.find((row) => row.id === role.id);
                if (!item) return;
                const [start, end] = event.target.value.split("–").map((part) => part.trim());
                item.start = start || item.start;
                item.end = !end || end === "present" ? null : end;
              })} />
            </div>
            {role.bullets.map((bullet) => (
              <Textarea key={bullet.id} value={bullet.text} onChange={(event) => patchCv((draft) => {
                const item = draft.roles.find((row) => row.id === role.id)?.bullets.find((line) => line.id === bullet.id);
                if (item) item.text = event.target.value;
              })} />
            ))}
            <Button type="button" variant="outline" onClick={() => patchCv((draft) => {
              draft.roles.find((row) => row.id === role.id)?.bullets.push({ id: createId("b"), text: "" });
            })}>Add bullet</Button>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={() => patchCv((draft) => draft.roles.push({ id: createId("role"), company: "", title: "", location: "", start: "", end: null, bullets: [] }))}>Add role</Button>
        <h3 className="pt-2 font-medium">Proof points</h3>
        {cv.proofPoints.map((proof) => (
          <Textarea key={proof.id} value={proof.text} onChange={(event) => patchCv((draft) => { const item = draft.proofPoints.find((row) => row.id === proof.id); if (item) item.text = event.target.value; })} />
        ))}
        <Button type="button" variant="outline" onClick={() => patchCv((draft) => draft.proofPoints.push({ id: createId("proof"), text: "" }))}>Add proof point</Button>
      </section>
    </div>
  );
}
