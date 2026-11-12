import { TailorView } from "@/components/views/tailor";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TailorView id={id} />;
}
