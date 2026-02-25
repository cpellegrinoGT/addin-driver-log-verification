import type { DutyStatusLog, FleetRow, LogRow, Driver, Device } from "../types";
import { isVerified } from "./formatters";
import { getStatusName } from "./statusNames";

function getDriverName(drivers: Driver[], driverId: string | null): string {
  if (!driverId) return "--";
  for (let i = 0; i < drivers.length; i++) {
    if (drivers[i].id === driverId) {
      const d = drivers[i];
      const name = ((d.firstName || "") + " " + (d.lastName || "")).trim();
      return name || d.name || d.id;
    }
  }
  return driverId;
}

function getDeviceName(devices: Record<string, Device>, deviceId: string | null): string {
  if (!deviceId) return "--";
  const d = devices[deviceId];
  return d ? (d.name || d.id) : deviceId;
}

export function buildFleetSummary(logs: DutyStatusLog[], drivers: Driver[]): FleetRow[] {
  const byDriver: Record<string, FleetRow> = {};

  for (const log of logs) {
    const did = log.driver ? log.driver.id : null;
    if (!did) continue;

    if (!byDriver[did]) {
      byDriver[did] = {
        driverId: did,
        driverName: getDriverName(drivers, did),
        total: 0,
        verified: 0,
        unverified: 0,
        verifiedPct: 0,
      };
    }

    byDriver[did].total++;
    if (isVerified(log)) {
      byDriver[did].verified++;
    } else {
      byDriver[did].unverified++;
    }
  }

  const rows: FleetRow[] = [];
  for (const did of Object.keys(byDriver)) {
    const d = byDriver[did];
    d.verifiedPct = d.total > 0 ? (d.verified / d.total * 100) : 0;
    rows.push(d);
  }

  return rows;
}

export function buildLogRows(
  logs: DutyStatusLog[],
  drivers: Driver[],
  devices: Record<string, Device>,
): LogRow[] {
  return logs.map((log) => {
    const driverId = log.driver ? log.driver.id : null;
    const coDriverId = log.coDriver ? log.coDriver.id : null;
    const deviceId = log.device ? log.device.id : null;
    const verified = isVerified(log);

    let hours = "--";
    if (log.elapsedDuration != null) {
      hours = (log.elapsedDuration / 3600).toFixed(1);
    }

    return {
      id: log.id,
      driverId: driverId || "",
      driverName: getDriverName(drivers, driverId),
      dateTime: log.dateTime || null,
      status: getStatusName(log),
      isVerified: verified,
      verifiedLabel: verified ? "Verified" : "Unverified",
      coDriverId,
      coDriverName: coDriverId ? getDriverName(drivers, coDriverId) : "--",
      hours,
      deviceId,
      device: getDeviceName(devices, deviceId),
      annotation:
        log.annotations && log.annotations.length > 0
          ? log.annotations.map((a) => a.comment || "").join("; ")
          : log.annotation || "--",
    };
  });
}
