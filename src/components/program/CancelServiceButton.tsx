import { Trash2 } from "lucide-react";
import { cancelService } from "@/app/(app)/cultes/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";

/** « Retirer ce culte », avec une confirmation (les personnes programmées sont prévenues). */
export function CancelServiceButton({ serviceId, published }: { serviceId: string; published: boolean }) {
  return (
    <details className="rounded-xl px-1">
      <summary className="flex min-h-11 cursor-pointer items-center justify-end gap-1 text-sm font-semibold text-alert-text">
        <Trash2 aria-hidden className="size-4" /> Retirer ce culte
      </summary>
      <form action={cancelService} className="flex flex-col gap-2 rounded-xl bg-alert-bg p-3">
        <input type="hidden" name="service_id" value={serviceId} />
        <p className="text-sm text-alert-text">
          Ce culte disparaîtra du programme.{published ? " Les personnes programmées seront prévenues." : ""}
        </p>
        <SubmitButton className="min-h-11 rounded-full bg-alert-ring font-semibold text-white">Oui, retirer ce culte</SubmitButton>
      </form>
    </details>
  );
}
