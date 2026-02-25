import { useMemo, useState, useCallback } from "react";
import { Table, Button, ButtonType, ColumnSortDirection } from "@geotab/zenith";
import type { FleetRow } from "../types";
import { formatPct } from "../lib/formatters";
import { buildHosLogsUrl } from "../lib/hosUrl";
import { exportCsv } from "../lib/csvExport";
import { Pill } from "@geotab/zenith";

interface FleetTableEntity {
  id: string;
  driverName: string;
  total: number;
  verified: number;
  unverified: number;
  verifiedPct: number;
  driverId: string;
}

interface FleetTableProps {
  rows: FleetRow[];
  dateRange: { from: string; to: string };
}

export default function FleetTable({ rows, dateRange }: FleetTableProps) {
  const [sortValue, setSortValue] = useState({
    sortColumn: "unverified",
    sortDirection: ColumnSortDirection.Descending,
  });

  const entities: FleetTableEntity[] = useMemo(
    () => rows.map((r) => ({ ...r, id: r.driverId })),
    [rows],
  );

  const sorted = useMemo(() => {
    const copy = [...entities];
    const { sortColumn, sortDirection } = sortValue;
    const dir = sortDirection === ColumnSortDirection.Ascending ? 1 : -1;
    copy.sort((a, b) => {
      const va = (a as any)[sortColumn];
      const vb = (b as any)[sortColumn];
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va ?? "").localeCompare(String(vb ?? "")) * dir;
    });
    return copy;
  }, [entities, sortValue]);

  const columns = useMemo(
    () => [
      {
        id: "driverName",
        title: "Driver Name",
        sortable: true,
        columnComponent: {
          render: (entity: FleetTableEntity) => {
            const url = buildHosLogsUrl(entity.driverId, dateRange.from, dateRange.to);
            return <a href={url} className="dlv-driver-link">{entity.driverName}</a>;
          },
        },
      },
      {
        id: "total",
        title: "Total Logs",
        sortable: true,
        columnComponent: {
          render: (entity: FleetTableEntity) => entity.total,
        },
      },
      {
        id: "verified",
        title: "Verified",
        sortable: true,
        columnComponent: {
          render: (entity: FleetTableEntity) => entity.verified,
        },
      },
      {
        id: "unverified",
        title: "Unverified",
        sortable: true,
        columnComponent: {
          render: (entity: FleetTableEntity) => entity.unverified,
        },
      },
      {
        id: "verifiedPct",
        title: "Verification %",
        sortable: true,
        columnComponent: {
          render: (entity: FleetTableEntity) => (
            <Pill type={entity.verifiedPct >= 100 ? "success" : "error"}>
              {formatPct(entity.verifiedPct)}
            </Pill>
          ),
        },
      },
    ],
    [dateRange],
  );

  const handleExport = useCallback(() => {
    const headers = ["driverName", "total", "verified", "unverified", "verifiedPct"];
    const csvRows = rows.map((r) => ({
      driverName: r.driverName,
      total: r.total,
      verified: r.verified,
      unverified: r.unverified,
      verifiedPct: formatPct(r.verifiedPct),
    }));
    exportCsv("driver_log_verification_fleet.csv", headers, csvRows);
  }, [rows]);

  return (
    <div className="dlv-panel">
      <div className="dlv-panel-toolbar">
        <Button type={ButtonType.Secondary} onClick={handleExport}>
          Export CSV
        </Button>
      </div>
      <Table
        entities={sorted}
        columns={columns}
        sortable={{
          pageName: "dlvFleet",
          value: sortValue,
          onChange: setSortValue,
        }}
      >
        <Table.Empty description="No fleet data to display." />
      </Table>
    </div>
  );
}
