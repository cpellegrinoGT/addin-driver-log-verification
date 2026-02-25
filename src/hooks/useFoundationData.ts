import { useState, useEffect, useCallback, useRef } from "react";
import type { GeotabApi, Driver, Group, Device } from "../types";
import { apiCall } from "../lib/geotabApi";

interface FoundationData {
  drivers: Driver[];
  groups: Record<string, Group>;
  devices: Record<string, Device>;
  loading: boolean;
  error: string | null;
  refreshDrivers: (api: GeotabApi) => void;
}

export function useFoundationData(api: GeotabApi | null): FoundationData {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [groups, setGroups] = useState<Record<string, Group>>({});
  const [devices, setDevices] = useState<Record<string, Device>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!api || initialized.current) return;
    initialized.current = true;

    Promise.all([
      apiCall(api, "Get", { typeName: "User", search: { isDriver: true }, resultsLimit: 5000 }),
      apiCall(api, "Get", { typeName: "Group", resultsLimit: 5000 }),
      apiCall(api, "Get", { typeName: "Device", resultsLimit: 5000 }),
    ])
      .then(([driverResult, groupResult, deviceResult]) => {
        setDrivers(driverResult || []);

        const gMap: Record<string, Group> = {};
        for (const g of (groupResult || [])) gMap[g.id] = g;
        setGroups(gMap);

        const dMap: Record<string, Device> = {};
        for (const d of (deviceResult || [])) dMap[d.id] = d;
        setDevices(dMap);

        setLoading(false);
      })
      .catch((err) => {
        console.error("Driver Log Verification init error:", err);
        setError("Failed to load foundation data.");
        setLoading(false);
      });
  }, [api]);

  const refreshDrivers = useCallback((freshApi: GeotabApi) => {
    apiCall(freshApi, "Get", { typeName: "User", search: { isDriver: true }, resultsLimit: 5000 })
      .then((result) => setDrivers(result || []))
      .catch(() => {});
  }, []);

  return { drivers, groups, devices, loading, error, refreshDrivers };
}
