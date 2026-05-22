"use client";

import { LOCATION_OTHER, STANDARD_LOCATION_OPTIONS, composeLocationValue, locationSelectValue, otherLocationValue } from "@/lib/locations";

export function LocationSelect({
  label,
  value,
  onChange,
  required = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const selected = locationSelectValue(value);
  const other = otherLocationValue(value);
  return (
    <div>
      <label>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
        <select
          value={selected}
          required={required}
          onChange={(event) => onChange(composeLocationValue(event.target.value, other))}
          className="mt-2 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-eo-blue focus:ring-2 focus:ring-eo-blue/10"
        >
          <option value="">Choose location</option>
          {STANDARD_LOCATION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <p className="mt-1 text-xs text-muted">Use the closest South Florida area. Choose Other if not listed.</p>
      {selected === LOCATION_OTHER ? (
        <label className="mt-2 block">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Other location</span>
          <input
            value={other}
            onChange={(event) => onChange(composeLocationValue(LOCATION_OTHER, event.target.value))}
            className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-eo-blue focus:ring-2 focus:ring-eo-blue/10"
          />
        </label>
      ) : null}
    </div>
  );
}
