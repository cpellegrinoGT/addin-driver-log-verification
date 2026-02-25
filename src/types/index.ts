/** Geotab API reference passed into add-in lifecycle hooks */
export interface GeotabApi {
  call(method: string, params: Record<string, unknown>, resolve: (result: any) => void, reject: (err: any) => void): void;
  multiCall(calls: [string, Record<string, unknown>][], resolve: (results: any[]) => void, reject: (err: any) => void): void;
}

/** Geotab add-in state object */
export interface GeotabState {
  getGroupFilter(): { id: string }[];
}

export interface Driver {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  isDriver?: boolean;
  companyGroups?: { id: string }[];
  driverGroups?: { id: string }[];
}

export interface Group {
  id: string;
  name?: string;
}

export interface Device {
  id: string;
  name?: string;
}

export interface DutyStatusLog {
  id: string;
  driver?: { id: string };
  coDriver?: { id: string };
  device?: { id: string };
  status?: string;
  dutyStatus?: string;
  dateTime?: string;
  verifyDateTime?: string | Date;
  elapsedDuration?: number;
  malfunction?: unknown;
  annotations?: { comment?: string }[];
  annotation?: string;
}

/** Aggregated per-driver fleet summary row */
export interface FleetRow {
  driverId: string;
  driverName: string;
  total: number;
  verified: number;
  unverified: number;
  verifiedPct: number;
}

/** Individual log detail row */
export interface LogRow {
  id: string;
  driverId: string;
  driverName: string;
  dateTime: string | null;
  status: string;
  isVerified: boolean;
  verifiedLabel: string;
  coDriverId: string | null;
  coDriverName: string;
  hours: string;
  deviceId: string | null;
  device: string;
  annotation: string;
}

/** Dropdown option item for Zenith FiltersBar.Dropdown */
export interface DropdownItem {
  id: string;
  name: string;
}
