import { useMemo, useState, useCallback } from "react";
import { Table, Button, ButtonType, ColumnSortDirection, Pill, SearchInput } from "@geotab/zenith";
import type { LogRow } from "../types";
import { formatDate } from "../lib/formatters";
import { buildHosLogsUrl } from "../lib/hosUrl";
import { exportCsv } from "../lib/csvExport";

interface LogsTableEntity extends LogRow {
  id: string;
}

interface LogsTableProps {
  rows: LogRow[];
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Logs" },
  { value: "verified", label: "Verified Only" },
  { value: "unverified", label: "Unverified Only" },
];

export default function LogsTable({ rows }: LogsTableProps) {
  const [sortValue, setSortValue] = useState({
    sortColumn: "dateTime",
    sortDirection: ColumnSortDirection.Descending,
  });
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = useMemo(() => {
    let result = rows;

    if (statusFilter === "verified") {
      result = result.filter((r) => r.isVerified);
    } else if (statusFilter === "unverified") {
      result = result.filter((r) => !r.isVerified);
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(
        (r) =>
          r.driverName.toLowerCase().includes(lower) ||
          r.status.toLowerCase().includes(lower) ||
          r.device.toLowerCase().includes(lower) ||
          r.annotation.toLowerCase().includes(lower) ||
          r.coDriverName.toLowerCase().includes(lower),
      );
    }

    return result;
  }, [rows, statusFilter, searchTerm]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    const { sortColumn, sortDirection } = sortValue;
    const dir = sortDirection === ColumnSortDirection.Ascending ? 1 : -1;
    copy.sort((a, b) => {
      const va = (a as any)[sortColumn];
      const vb = (b as any)[sortColumn];
      if (typeof va === "boolean" && typeof vb === "boolean") return ((va ? 1 : 0) - (vb ? 1 : 0)) * dir;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va ?? "").localeCompare(String(vb ?? "")) * dir;
    });
    return copy;
  }, [filtered, sortValue]);

  const columns = useMemo(
    () => [
      {
        id: "driverName",
        title: "Driver",
        sortable: true,
        columnComponent: {
          render: (entity: LogsTableEntity) => {
            const logDate = entity.dateTime ? new Date(entity.dateTime) : new Date();
            const dayStart = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate(), 0, 0, 0);
            const dayEnd = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate(), 23, 59, 59);
            const url = buildHosLogsUrl(entity.driverId, dayStart.toISOString(), dayEnd.toISOString());
            return <a href={url} className="dlv-driver-link">{entity.driverName}</a>;
          },
        },
      },
      {
        id: "dateTime",
        title: "Date",
        sortable: true,
        columnComponent: {
          render: (entity: LogsTableEntity) => formatDate(entity.dateTime),
        },
      },
      {
        id: "status",
        title: "Status",
        sortable: true,
        columnComponent: {
          render: (entity: LogsTableEntity) => entity.status,
        },
      },
      {
        id: "isVerified",
        title: "Verified",
        sortable: true,
        columnComponent: {
          render: (entity: LogsTableEntity) => (
            <Pill type={entity.isVerified ? "success" : "error"}>
              {entity.verifiedLabel}
            </Pill>
          ),
        },
      },
      {
        id: "coDriverName",
        title: "Co-Driver",
        sortable: true,
        columnComponent: {
          render: (entity: LogsTableEntity) => entity.coDriverName,
        },
      },
      {
        id: "hours",
        title: "Hours",
        sortable: true,
        columnComponent: {
          render: (entity: LogsTableEntity) => entity.hours,
        },
      },
      {
        id: "device",
        title: "Device",
        sortable: true,
        columnComponent: {
          render: (entity: LogsTableEntity) => entity.device,
        },
      },
      {
        id: "annotation",
        title: "Annotation",
        sortable: false,
        columnComponent: {
          render: (entity: LogsTableEntity) => entity.annotation,
        },
      },
    ],
    [],
  );

  const handleExport = useCallback(() => {
    const headers = ["driverName", "dateTime", "status", "verifiedLabel", "coDriverName", "hours", "device", "annotation"];
    const csvRows = rows.map((r) => ({
      driverName: r.driverName,
      dateTime: formatDate(r.dateTime),
      status: r.status,
      verifiedLabel: r.verifiedLabel,
      coDriverName: r.coDriverName,
      hours: r.hours,
      device: r.device,
      annotation: r.annotation,
    }));
    exportCsv("driver_log_verification_logs.csv", headers, csvRows);
  }, [rows]);

  return (
    <div className="dlv-panel">
      <div className="dlv-panel-toolbar">
        <div className="dlv-filter-group">
          <label htmlFor="dlv-logs-status-filter">Status</label>
          <select
            id="dlv-logs-status-filter"
            className="dlv-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="dlv-filter-group">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search drivers, annotations..."
            ariaLabel="Search logs"
          />
        </div>
        <Button type={ButtonType.Secondary} onClick={handleExport}>
          Export CSV
        </Button>
      </div>
      <Table
        entities={sorted}
        columns={columns}
        sortable={{
          pageName: "dlvLogs",
          value: sortValue,
          onChange: setSortValue,
        }}
      >
        <Table.Empty description="No log data to display." />
      </Table>
    </div>
  );
}
