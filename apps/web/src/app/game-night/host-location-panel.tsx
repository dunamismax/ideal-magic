"use client";

import { AlertCircle, Archive, MapPin, Save } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { fieldControlClassName, FormField } from "@/components/ui/form-field";
import type { HostLocationSummary } from "@/db/queries/event-planning";
import type { EventFormPlaygroup } from "./create-event-form";
import {
  archiveHostLocationAction,
  type ArchiveHostLocationActionState,
  createHostLocationAction,
  type HostLocationActionState,
  updateHostLocationAction,
} from "./actions";

type HostLocationPanelProps = {
  locations: HostLocationSummary[];
  playgroups: EventFormPlaygroup[];
};

function createEmptyLocationState(
  playgroups: EventFormPlaygroup[],
): HostLocationActionState {
  return {
    message: null,
    saved: false,
    fieldErrors: {},
    fields: {
      playgroupId: playgroups[0]?.id ?? "",
      name: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      stateProvince: "",
      postalCode: "",
      country: "",
      notes: "",
    },
  };
}

function createUpdateLocationState(
  location: HostLocationSummary,
): HostLocationActionState {
  return {
    message: null,
    saved: false,
    fieldErrors: {},
    fields: {
      locationId: location.id,
      playgroupId: location.playgroupId,
      name: location.name,
      addressLine1: location.addressLine1,
      addressLine2: location.addressLine2,
      city: location.city,
      stateProvince: location.stateProvince,
      postalCode: location.postalCode,
      country: location.country,
      notes: location.notes,
    },
  };
}

function createArchiveLocationState(
  location: HostLocationSummary,
): ArchiveHostLocationActionState {
  return {
    message: null,
    saved: false,
    fieldErrors: {},
    fields: {
      locationId: location.id,
    },
  };
}

export function HostLocationPanel({
  locations,
  playgroups,
}: HostLocationPanelProps) {
  const [createState, createAction] = useActionState(
    createHostLocationAction,
    createEmptyLocationState(playgroups),
  );
  const disabled = playgroups.length === 0;

  return (
    <section className="grid gap-4 rounded-panel border border-border bg-surface p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2">
        <MapPin className="size-5 text-accent" aria-hidden="true" />
        <h2 className="text-base font-bold">Host Locations</h2>
      </div>

      <form action={createAction} className="grid gap-3">
        <StatusMessage
          message={createState.message}
          saved={createState.saved}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            label="Playgroup"
            error={createState.fieldErrors.playgroupId}
          >
            <select
              className={fieldControlClassName}
              defaultValue={createState.fields.playgroupId}
              disabled={disabled}
              name="playgroupId"
              required
            >
              {playgroups.length > 0 ? (
                playgroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))
              ) : (
                <option value="">Create a group first</option>
              )}
            </select>
          </FormField>

          <FormField label="Location Name" error={createState.fieldErrors.name}>
            <input
              className={fieldControlClassName}
              defaultValue={createState.fields.name}
              disabled={disabled}
              maxLength={100}
              name="name"
              required
            />
          </FormField>
        </div>

        <LocationFields state={createState} disabled={disabled} />

        <LocationSubmitButton disabled={disabled} label="Save Location" />
      </form>

      <div className="grid gap-3">
        {locations.length > 0 ? (
          locations.map((location) => (
            <HostLocationCard key={location.id} location={location} />
          ))
        ) : (
          <div className="rounded-control bg-background p-3 text-sm font-semibold text-muted">
            No saved host locations
          </div>
        )}
      </div>
    </section>
  );
}

function HostLocationCard({ location }: { location: HostLocationSummary }) {
  const [updateState, updateAction] = useActionState(
    updateHostLocationAction,
    createUpdateLocationState(location),
  );
  const [archiveState, archiveAction] = useActionState(
    archiveHostLocationAction,
    createArchiveLocationState(location),
  );

  return (
    <div className="grid gap-3 rounded-control border border-border bg-background p-3">
      <form action={updateAction} className="grid gap-3">
        <input name="locationId" type="hidden" value={location.id} />
        <input name="playgroupId" type="hidden" value={location.playgroupId} />

        <StatusMessage
          message={updateState.message}
          saved={updateState.saved}
        />

        <FormField label="Location Name" error={updateState.fieldErrors.name}>
          <input
            className={fieldControlClassName}
            defaultValue={updateState.fields.name}
            maxLength={100}
            name="name"
            required
          />
        </FormField>

        <LocationFields state={updateState} />

        {updateState.fieldErrors.locationId ? (
          <p className="text-sm font-semibold text-danger">
            {updateState.fieldErrors.locationId}
          </p>
        ) : null}

        <LocationSubmitButton label="Update Location" />
      </form>

      <form
        action={archiveAction}
        className="flex flex-wrap items-center gap-3"
      >
        <input name="locationId" type="hidden" value={location.id} />
        <StatusMessage
          message={archiveState.message}
          saved={archiveState.saved}
        />
        {archiveState.fieldErrors.locationId ? (
          <p className="text-sm font-semibold text-danger">
            {archiveState.fieldErrors.locationId}
          </p>
        ) : null}
        <ArchiveSubmitButton />
      </form>
    </div>
  );
}

function LocationFields({
  disabled = false,
  state,
}: {
  disabled?: boolean;
  state: HostLocationActionState;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          label="Address Line 1"
          error={state.fieldErrors.addressLine1}
        >
          <input
            className={fieldControlClassName}
            defaultValue={state.fields.addressLine1}
            disabled={disabled}
            maxLength={180}
            name="addressLine1"
          />
        </FormField>

        <FormField
          label="Address Line 2"
          error={state.fieldErrors.addressLine2}
        >
          <input
            className={fieldControlClassName}
            defaultValue={state.fields.addressLine2}
            disabled={disabled}
            maxLength={180}
            name="addressLine2"
          />
        </FormField>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <FormField label="City" error={state.fieldErrors.city}>
          <input
            className={fieldControlClassName}
            defaultValue={state.fields.city}
            disabled={disabled}
            maxLength={180}
            name="city"
          />
        </FormField>

        <FormField label="State" error={state.fieldErrors.stateProvince}>
          <input
            className={fieldControlClassName}
            defaultValue={state.fields.stateProvince}
            disabled={disabled}
            maxLength={180}
            name="stateProvince"
          />
        </FormField>

        <FormField label="Postal Code" error={state.fieldErrors.postalCode}>
          <input
            className={fieldControlClassName}
            defaultValue={state.fields.postalCode}
            disabled={disabled}
            maxLength={180}
            name="postalCode"
          />
        </FormField>

        <FormField label="Country" error={state.fieldErrors.country}>
          <input
            className={fieldControlClassName}
            defaultValue={state.fields.country}
            disabled={disabled}
            maxLength={180}
            name="country"
          />
        </FormField>
      </div>

      <FormField label="Location Notes" error={state.fieldErrors.notes}>
        <textarea
          className={`${fieldControlClassName} min-h-20 resize-y py-2`}
          defaultValue={state.fields.notes}
          disabled={disabled}
          maxLength={1000}
          name="notes"
        />
      </FormField>
    </>
  );
}

function LocationSubmitButton({
  disabled = false,
  label,
}: {
  disabled?: boolean;
  label: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      className="w-full sm:w-fit"
      disabled={disabled || pending}
      type="submit"
    >
      <Save className="size-4" aria-hidden="true" />
      {pending ? "Saving" : label}
    </Button>
  );
}

function ArchiveSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} type="submit" variant="danger">
      <Archive className="size-4" aria-hidden="true" />
      {pending ? "Archiving" : "Archive Location"}
    </Button>
  );
}

function StatusMessage({
  message,
  saved,
}: {
  message: string | null;
  saved: boolean;
}) {
  if (!message) {
    return null;
  }

  return (
    <div
      className={
        saved
          ? "flex items-start gap-2 rounded-control border border-accent/40 bg-accent/10 p-3 text-sm font-semibold text-accent"
          : "flex items-start gap-2 rounded-control border border-danger/40 bg-danger/10 p-3 text-sm font-semibold text-danger"
      }
      role={saved ? "status" : "alert"}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
