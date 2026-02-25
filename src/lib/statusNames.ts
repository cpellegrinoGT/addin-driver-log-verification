import type { DutyStatusLog } from "../types";

export const STATUS_NAMES: Record<string, string> = {
  D: "Driving",
  ON: "On Duty",
  OFF: "Off Duty",
  SB: "Sleeper Berth",
  PC: "Personal Conveyance",
  YM: "Yard Move",
  WT: "Wait Time",
};

export const VERIFIABLE_STATUSES: Record<string, boolean> = {
  D: true, ON: true, OFF: true, SB: true,
  PC: true, YM: true, WT: true, Certify: true,
};

export function getStatusName(log: DutyStatusLog): string {
  const s = log.status || log.dutyStatus || "";
  const upper = String(s).toUpperCase();

  if (upper === "D" || upper === "DRIVING") return "Driving";
  if (upper === "ON" || upper === "ONDUTY" || upper === "ON DUTY") return "On Duty";
  if (upper === "OFF" || upper === "OFFDUTY" || upper === "OFF DUTY") return "Off Duty";
  if (upper === "SB" || upper === "SLEEPERBERTH" || upper === "SLEEPER BERTH") return "Sleeper Berth";
  if (upper === "PC" || upper === "PERSONALCONVEYANCE" || upper === "PERSONAL CONVEYANCE") return "Personal Conveyance";
  if (upper === "YM" || upper === "YARDMOVE" || upper === "YARD MOVE") return "Yard Move";
  if (upper === "WT" || upper === "WAITTIME" || upper === "WAIT TIME") return "Wait Time";

  if (STATUS_NAMES[upper]) return STATUS_NAMES[upper];

  return s || "--";
}
