/**
 * Display title for a unit: building name when set, else street address,
 * plus the apartment number — "Hudson Park Apt 604".
 */
export function unitLabel(p: {
  building_name: string | null;
  street_address: string;
  unit_number: string;
}): string {
  return `${p.building_name?.trim() || p.street_address} Apt ${p.unit_number}`;
}
