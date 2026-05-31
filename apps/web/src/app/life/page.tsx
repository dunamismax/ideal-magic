import { Minus, Plus, RotateCcw } from "lucide-react";

import { PageFrame } from "@/components/page-frame";
import { Button } from "@/components/ui/button";

const seats = ["North", "East", "South", "West"];

export default function LifePage() {
  return (
    <PageFrame title="Life Counter">
      <div className="grid gap-3 md:grid-cols-2">
        {seats.map((seat, index) => (
          <article
            className="rounded-control border border-border bg-background p-4"
            key={seat}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Player {index + 1}</h2>
                <p className="text-sm font-medium text-muted">{seat}</p>
              </div>
              <span className="text-5xl font-black tabular-nums">40</span>
            </div>
            <div className="mt-4 grid grid-cols-5 gap-2">
              <Button variant="secondary" size="icon" aria-label="Subtract 1">
                <Minus className="size-4" aria-hidden="true" />
              </Button>
              <Button variant="secondary" size="icon" aria-label="Add 1">
                <Plus className="size-4" aria-hidden="true" />
              </Button>
              <Button variant="secondary" size="icon" aria-label="Reset">
                <RotateCcw className="size-4" aria-hidden="true" />
              </Button>
              <Button className="col-span-2" variant="primary">
                Damage
              </Button>
            </div>
          </article>
        ))}
      </div>
    </PageFrame>
  );
}
