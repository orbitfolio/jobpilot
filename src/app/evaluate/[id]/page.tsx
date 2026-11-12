import { ReportView } from "@/components/views/report";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReportView id={id} />;
}
