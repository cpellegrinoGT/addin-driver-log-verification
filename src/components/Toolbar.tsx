import { useMemo, useCallback, useState } from "react";
import { Button, ButtonType } from "@geotab/zenith";
import type { Driver, Group } from "../types";

interface ToolbarProps {
  drivers: Driver[];
  groups: Record<string, Group>;
  selectedPreset: string;
  onPresetChange: (preset: string) => void;
  customFrom: string;
  customTo: string;
  onCustomFromChange: (val: string) => void;
  onCustomToChange: (val: string) => void;
  selectedGroup: string;
  onGroupChange: (groupId: string) => void;
  selectedDriver: string;
  onDriverChange: (driverId: string) => void;
  onApply: () => void;
  driverCount: number;
}

const PRESETS = [
  { key: "yesterday", label: "Yesterday" },
  { key: "7days", label: "Last 7 Days" },
  { key: "30days", label: "Last 30 Days" },
  { key: "custom", label: "Custom" },
];

export default function Toolbar({
  drivers,
  groups,
  selectedPreset,
  onPresetChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  selectedGroup,
  onGroupChange,
  selectedDriver,
  onDriverChange,
  onApply,
  driverCount,
}: ToolbarProps) {
  const sortedGroups = useMemo(() => {
    const skipIds: Record<string, boolean> = { GroupCompanyId: true, GroupNothingId: true };
    const list: Group[] = [];
    for (const gid of Object.keys(groups)) {
      const g = groups[gid];
      if (skipIds[gid]) continue;
      if (!g.name || g.name === "CompanyGroup" || g.name === "**Nothing**") continue;
      list.push(g);
    }
    list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return list;
  }, [groups]);

  const sortedDrivers = useMemo(() => {
    return drivers.slice().sort((a, b) => {
      const na = ((a.firstName || "") + " " + (a.lastName || "")).trim();
      const nb = ((b.firstName || "") + " " + (b.lastName || "")).trim();
      return na.localeCompare(nb);
    });
  }, [drivers]);

  const handlePresetClick = useCallback(
    (key: string) => {
      onPresetChange(key);
      if (key === "custom" && !customFrom) {
        const now = new Date();
        const from = new Date(now);
        from.setDate(from.getDate() - 30);
        onCustomFromChange(from.toISOString().slice(0, 10));
        onCustomToChange(now.toISOString().slice(0, 10));
      }
    },
    [onPresetChange, customFrom, onCustomFromChange, onCustomToChange],
  );

  return (
    <div className="dlv-toolbar">
      <div className="dlv-control-group">
        <label>Timeframe</label>
        <div className="dlv-presets">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              className={`dlv-preset${selectedPreset === p.key ? " active" : ""}`}
              onClick={() => handlePresetClick(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {selectedPreset === "custom" && (
        <div className="dlv-control-group">
          <label htmlFor="dlv-from">From</label>
          <input
            type="date"
            id="dlv-from"
            value={customFrom}
            onChange={(e) => onCustomFromChange(e.target.value)}
          />
          <label htmlFor="dlv-to">To</label>
          <input
            type="date"
            id="dlv-to"
            value={customTo}
            onChange={(e) => onCustomToChange(e.target.value)}
          />
        </div>
      )}

      <div className="dlv-control-group">
        <label htmlFor="dlv-group">Group</label>
        <select
          id="dlv-group"
          className="dlv-select"
          value={selectedGroup}
          onChange={(e) => onGroupChange(e.target.value)}
        >
          <option value="all">All Groups</option>
          {sortedGroups.map((g) => (
            <option key={g.id} value={g.id}>{g.name || g.id}</option>
          ))}
        </select>
      </div>

      <div className="dlv-control-group">
        <label htmlFor="dlv-driver">Driver</label>
        <select
          id="dlv-driver"
          className="dlv-select"
          value={selectedDriver}
          onChange={(e) => onDriverChange(e.target.value)}
        >
          <option value="all">All Drivers</option>
          {sortedDrivers.map((d) => {
            const name = ((d.firstName || "") + " " + (d.lastName || "")).trim() || d.name || d.id;
            return <option key={d.id} value={d.id}>{name}</option>;
          })}
        </select>
      </div>

      <div className="dlv-control-group">
        <Button type={ButtonType.Primary} onClick={onApply}>
          Apply
        </Button>
      </div>

      {driverCount > 0 && (
        <div className="dlv-control-group">
          <span className="dlv-driver-count">{driverCount} drivers selected</span>
        </div>
      )}
    </div>
  );
}
