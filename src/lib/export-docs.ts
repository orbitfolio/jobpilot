import type { EvaluationRecord, MasterCv, Profile, TailoredPack } from "@/lib/types";
import { formatMoney } from "@/lib/text";

export function plainTextPack(profile: Profile, cv: MasterCv, pack: TailoredPack, record: EvaluationRecord): string {
  const lines: string[] = [
    profile.fullName,
    profile.headline,
    [profile.email, profile.phone, profile.location].filter(Boolean).join(" · "),
    profile.links.map((link) => link.url).join(" · "),
    "",
    "SUMMARY",
    pack.summary.text,
    "",
  ];
  for (const role of cv.roles) {
    const tailored = pack.roles.find((item) => item.roleId === role.id);
    if (!tailored?.claims.length) continue;
    lines.push(`${role.title} — ${role.company}`);
    lines.push(`${role.location} · ${role.start} – ${role.end ?? "Present"}`);
    for (const claim of tailored.claims) lines.push(`• ${claim.text}`);
    lines.push("");
  }
  lines.push("SKILLS");
  lines.push(pack.skillOrder.join(", "));
  lines.push("");
  lines.push("EDUCATION");
  for (const school of cv.education) lines.push(`${school.credential}, ${school.school}, ${school.year}`);
  lines.push("", "COVER LETTER", "");
  for (const paragraph of pack.cover) lines.push(paragraph.text, "");
  lines.push(`Target range: ${formatMoney(profile.salary.min, profile.salary.currency)}–${formatMoney(profile.salary.max, profile.salary.currency)}`);
  lines.push(`Prepared for ${record.title} at ${record.company}. Not submitted.`);
  return lines.join("\n");
}

export async function downloadPdf(profile: Profile, cv: MasterCv, pack: TailoredPack, record: EvaluationRecord): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 54;
  const width = 540;
  let y = margin;
  const write = (text: string, size: number, style: "normal" | "bold" = "normal", gap = 14) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, width) as string[];
    for (const line of lines) {
      if (y > 740) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += gap;
    }
  };
  write(profile.fullName, 16, "bold", 18);
  write(profile.headline, 11, "normal", 14);
  write([profile.email, profile.phone, profile.location].filter(Boolean).join("  |  "), 10);
  write(profile.links.map((link) => link.url).join("  |  "), 10);
  y += 6;
  write("SUMMARY", 12, "bold");
  write(pack.summary.text, 11);
  y += 4;
  for (const role of cv.roles) {
    const tailored = pack.roles.find((item) => item.roleId === role.id);
    if (!tailored?.claims.length) continue;
    write(`${role.title}, ${role.company}`, 12, "bold", 15);
    write(`${role.location}  |  ${role.start} – ${role.end ?? "Present"}`, 10);
    for (const claim of tailored.claims) write(`• ${claim.text}`, 11);
    y += 4;
  }
  write("SKILLS", 12, "bold");
  write(pack.skillOrder.join(", "), 11);
  y += 4;
  write("EDUCATION", 12, "bold");
  for (const school of cv.education) write(`${school.credential}, ${school.school} (${school.year})`, 11);
  doc.addPage();
  y = margin;
  write("COVER LETTER", 14, "bold", 18);
  write(`${record.title} — ${record.company}`, 11);
  y += 6;
  for (const paragraph of pack.cover) {
    write(paragraph.text, 11, "normal", 14);
    y += 6;
  }
  doc.save(fileName(profile, record, "pdf"));
}

export async function downloadDocx(profile: Profile, cv: MasterCv, pack: TailoredPack, record: EvaluationRecord): Promise<void> {
  const { Document, Packer, Paragraph, TextRun } = await import("docx");
  const heading = (text: string) =>
    new Paragraph({
      spacing: { before: 280, after: 80 },
      children: [new TextRun({ text, bold: true, font: "Calibri", size: 26 })],
    });
  const body = (text: string) =>
    new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text, font: "Calibri", size: 22 })],
    });
  const children = [
    new Paragraph({ children: [new TextRun({ text: profile.fullName, bold: true, font: "Calibri", size: 36 })] }),
    body(profile.headline),
    body([profile.email, profile.phone, profile.location].filter(Boolean).join(" | ")),
    heading("Summary"),
    body(pack.summary.text),
  ];
  for (const role of cv.roles) {
    const tailored = pack.roles.find((item) => item.roleId === role.id);
    if (!tailored?.claims.length) continue;
    children.push(heading(`${role.title}, ${role.company}`));
    children.push(body(`${role.location} | ${role.start} – ${role.end ?? "Present"}`));
    for (const claim of tailored.claims) {
      children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: claim.text, font: "Calibri", size: 22 })] }));
    }
  }
  children.push(heading("Skills"), body(pack.skillOrder.join(", ")), heading("Education"));
  for (const school of cv.education) children.push(body(`${school.credential}, ${school.school} (${school.year})`));
  children.push(heading("Cover letter"), body(`${record.title} — ${record.company}`));
  for (const paragraph of pack.cover) children.push(body(paragraph.text));
  const document = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(document);
  downloadBlob(blob, fileName(profile, record, "docx"));
}

export function downloadJson(filename: string, value: unknown): void {
  downloadBlob(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }), filename);
}

function fileName(profile: Profile, record: EvaluationRecord, ext: string): string {
  const who = profile.fullName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const where = `${record.company}-${record.title}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `${who}-${where}.${ext}`.replace(/-+/g, "-");
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
