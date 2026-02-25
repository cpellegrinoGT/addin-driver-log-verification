import { SummaryTileBar, SummaryTile, SummaryTileType } from "@geotab/zenith";
import type { FleetRow } from "../types";
import { formatPct } from "../lib/formatters";

interface KpiStripProps {
  fleetRows: FleetRow[];
  visible: boolean;
}

export default function KpiStrip({ fleetRows, visible }: KpiStripProps) {
  if (!visible) return null;

  let totalLogs = 0;
  let totalVerified = 0;
  let totalUnverified = 0;
  let driversWithUnverified = 0;

  for (const r of fleetRows) {
    totalLogs += r.total;
    totalVerified += r.verified;
    totalUnverified += r.unverified;
    if (r.unverified > 0) driversWithUnverified++;
  }

  const fleetPct = totalLogs > 0 ? (totalVerified / totalLogs * 100) : 0;

  return (
    <SummaryTileBar>
      <SummaryTile
        title="Fleet Verification %"
        tileType={fleetPct >= 100 ? SummaryTileType.Success : SummaryTileType.Warning}
      >
        {formatPct(fleetPct)}
      </SummaryTile>
      <SummaryTile
        title="Total Unverified Logs"
        tileType={totalUnverified > 0 ? SummaryTileType.Error : SummaryTileType.Success}
      >
        {totalUnverified}
      </SummaryTile>
      <SummaryTile
        title="Drivers w/ Unverified Logs"
        tileType={driversWithUnverified > 0 ? SummaryTileType.Error : SummaryTileType.Success}
      >
        {driversWithUnverified}
      </SummaryTile>
    </SummaryTileBar>
  );
}
