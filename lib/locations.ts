import { normalizeSearchText } from "./search";

export const LOCATION_OTHER = "Other";

export const SOUTH_FLORIDA_LOCATIONS = [
  "Miami",
  "Miami Beach",
  "Coral Gables",
  "Aventura",
  "Hollywood",
  "Fort Lauderdale",
  "Plantation",
  "Boca Raton",
  "Delray Beach",
  "West Palm Beach",
  "Palm Beach",
  LOCATION_OTHER
] as const;

export const STANDARD_LOCATION_OPTIONS = [...SOUTH_FLORIDA_LOCATIONS];

const locationAliases: Record<string, string> = {
  aventura: "Aventura",
  boca: "Boca Raton",
  bocaraton: "Boca Raton",
  coralgables: "Coral Gables",
  delray: "Delray Beach",
  delraybeach: "Delray Beach",
  fortlauderdale: "Fort Lauderdale",
  ftlauderdale: "Fort Lauderdale",
  ftl: "Fort Lauderdale",
  hollywood: "Hollywood",
  miami: "Miami",
  miamibeach: "Miami Beach",
  palmbeach: "Palm Beach",
  plantation: "Plantation",
  westpalm: "West Palm Beach",
  westpalmbeach: "West Palm Beach",
  wpb: "West Palm Beach"
};

const titleCase = (value: string) =>
  value.trim().replace(/\s+/g, " ").split(" ").map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join(" ");

export const normalizeSouthFloridaLocation = (raw: string): { value?: string; needsReview?: boolean; warning?: string } => {
  const value = raw.trim().replace(/\s+/g, " ");
  if (!value) return {};
  if (value.toLowerCase().startsWith("other:")) return { value };
  const key = normalizeSearchText(value).replaceAll(" ", "");
  const matched = locationAliases[key] ?? SOUTH_FLORIDA_LOCATIONS.find((location) => normalizeSearchText(location).replaceAll(" ", "") === key);
  if (matched && matched !== LOCATION_OTHER) return { value: matched };
  const other = `${LOCATION_OTHER}: ${titleCase(value.replace(/^other:?/i, ""))}`;
  return { value: other, needsReview: true, warning: `Location set to ${other}` };
};

export const locationSelectValue = (value: string) =>
  value ? STANDARD_LOCATION_OPTIONS.includes(value as typeof SOUTH_FLORIDA_LOCATIONS[number]) ? value : LOCATION_OTHER : "";

export const otherLocationValue = (value: string) =>
  value.toLowerCase().startsWith("other:") ? value.slice(value.indexOf(":") + 1).trim() : "";

export const composeLocationValue = (selected: string, other: string) =>
  selected === LOCATION_OTHER ? `${LOCATION_OTHER}: ${other.trim() || "Unlisted"}` : selected;
