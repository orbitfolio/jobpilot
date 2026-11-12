import { Suspense } from "react";
import { EvaluateView } from "@/components/views/evaluate";

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Opening the form…</p>}>
      <EvaluateView />
    </Suspense>
  );
}
