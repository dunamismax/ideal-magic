import { LifeCounter } from "@/app/life/life-counter";
import { PageFrame } from "@/components/page-frame";

export default function LifePage() {
  return (
    <PageFrame eyebrow="Standalone local session" title="Life Counter">
      <LifeCounter />
    </PageFrame>
  );
}
