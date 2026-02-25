import {
  forwardRef,
  useImperativeHandle,
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
} from "react";
import { UserFormatProvider } from "@geotab/zenith";
import type { GeotabApi, GeotabState, FleetRow, LogRow, DutyStatusLog, Device } from "../types";
import { useFoundationData } from "../hooks/useFoundationData";
import { useDutyStatusLogs } from "../hooks/useDutyStatusLogs";
import { buildFleetSummary, buildLogRows } from "../lib/buildSummaries";
import Toolbar from "./Toolbar";
import TabBar from "./TabBar";
import KpiStrip from "./KpiStrip";
import FleetTable from "./FleetTable";
import LogsTable from "./LogsTable";
import LoadingOverlay from "./LoadingOverlay";
import EmptyState from "./EmptyState";
import WarningBanner from "./WarningBanner";

interface AppProps {
  api: GeotabApi;
  state: GeotabState;
}

export interface AppHandle {
  onFocus: (api: GeotabApi) => void;
  onBlur: () => void;
}

const App = forwardRef<AppHandle, AppProps>(function App({ api: initialApi, state }, ref) {
  const [api, setApi] = useState<GeotabApi>(initialApi);
  const { drivers, groups, devices, loading: foundationLoading, refreshDrivers } = useFoundationData(api);
  const { loading: fetchLoading, progress, progressText, fetchLogs, abort } = useDutyStatusLogs();

  const [activeTab, setActiveTab] = useState("fleet");
  const [fleetRows, setFleetRows] = useState<FleetRow[]>([]);
  const [logRows, setLogRows] = useState<LogRow[]>([]);
  const [showEmpty, setShowEmpty] = useState(false);
  const [emptyMessage, setEmptyMessage] = useState<string | undefined>(undefined);
  const [warning, setWarning] = useState<string | null>(null);

  // Toolbar state
  const [selectedPreset, setSelectedPreset] = useState("7days");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [selectedDriver, setSelectedDriver] = useState("all");

  const firstFocus = useRef(true);
  const focusReceived = useRef(false);
  const autoLoadDone = useRef(false);

  const getDateRange = useCallback((): { from: string; to: string } => {
    const now = new Date();
    let from: Date;
    let to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    switch (selectedPreset) {
      case "yesterday":
        from = new Date(now);
        from.setDate(from.getDate() - 1);
        from.setHours(0, 0, 0, 0);
        to = new Date(from);
        to.setHours(23, 59, 59);
        break;
      case "7days":
        from = new Date(now);
        from.setDate(from.getDate() - 7);
        from.setHours(0, 0, 0, 0);
        break;
      case "custom":
        from = customFrom
          ? new Date(customFrom + "T00:00:00")
          : new Date(now.getTime() - 30 * 86400000);
        to = customTo ? new Date(customTo + "T23:59:59") : to;
        break;
      case "30days":
      default:
        from = new Date(now);
        from.setDate(from.getDate() - 30);
        from.setHours(0, 0, 0, 0);
        break;
    }

    return { from: from.toISOString(), to: to.toISOString() };
  }, [selectedPreset, customFrom, customTo]);

  const getFilteredDrivers = useCallback(() => {
    if (selectedDriver !== "all") {
      return drivers.filter((d) => d.id === selectedDriver);
    }
    return drivers.filter((d) => {
      if (selectedGroup !== "all") {
        const driverGroups = d.companyGroups || d.driverGroups || [];
        return driverGroups.some((g) => g.id === selectedGroup);
      }
      return true;
    });
  }, [drivers, selectedDriver, selectedGroup]);

  const driverCount = useMemo(() => getFilteredDrivers().length, [getFilteredDrivers]);

  const dateRange = useMemo(() => getDateRange(), [getDateRange]);

  const loadData = useCallback(async () => {
    setShowEmpty(false);
    setEmptyMessage(undefined);
    setWarning(null);

    const dr = getDateRange();
    const filteredDrivers = getFilteredDrivers();

    if (filteredDrivers.length === 0) {
      setShowEmpty(true);
      return;
    }

    try {
      const logs = await fetchLogs(api, filteredDrivers, dr);
      if (!logs) return;

      const fleet = buildFleetSummary(logs, drivers);
      const logDetail = buildLogRows(logs, drivers, devices);

      setFleetRows(fleet);
      setLogRows(logDetail);

      if (logs.length === 0) {
        setShowEmpty(true);
      }
    } catch (err: any) {
      console.error("Driver Log Verification error:", err);
      setShowEmpty(true);
      setEmptyMessage("Error loading data. Please try again.");
    }
  }, [api, getDateRange, getFilteredDrivers, fetchLogs, drivers, devices]);

  // Auto-load on first focus once foundation data is ready.
  // This mirrors the old vanilla flow where initialize waited for
  // foundation data before calling callback(), so focus always had drivers.
  useEffect(() => {
    if (!foundationLoading && focusReceived.current && !autoLoadDone.current && drivers.length > 0) {
      autoLoadDone.current = true;
      loadData();
    }
  }, [foundationLoading, drivers, loadData]);

  useImperativeHandle(ref, () => ({
    onFocus(freshApi: GeotabApi) {
      setApi(freshApi);
      refreshDrivers(freshApi);
      focusReceived.current = true;

      // If foundation data already loaded, trigger auto-load now
      if (firstFocus.current && !foundationLoading && drivers.length > 0) {
        firstFocus.current = false;
        autoLoadDone.current = true;
        loadData();
      }
    },
    onBlur() {
      abort();
    },
  }), [refreshDrivers, loadData, abort, foundationLoading, drivers]);

  if (foundationLoading) {
    return (
      <div id="dlv-root">
        <LoadingOverlay visible text="Loading foundation data..." progress={0} />
      </div>
    );
  }

  return (
    <UserFormatProvider dateFormat="MM/dd/yyyy" timeFormat="HH:mm">
      <div id="dlv-root">
        <Toolbar
          drivers={drivers}
          groups={groups}
          selectedPreset={selectedPreset}
          onPresetChange={setSelectedPreset}
          customFrom={customFrom}
          customTo={customTo}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
          selectedGroup={selectedGroup}
          onGroupChange={setSelectedGroup}
          selectedDriver={selectedDriver}
          onDriverChange={setSelectedDriver}
          onApply={loadData}
          driverCount={driverCount}
        />

        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

        <KpiStrip fleetRows={fleetRows} visible={activeTab === "fleet"} />

        <WarningBanner message={warning} />

        <div className="dlv-content">
          {fetchLoading && (
            <LoadingOverlay visible text={progressText} progress={progress} />
          )}

          {showEmpty && !fetchLoading && (
            <EmptyState visible message={emptyMessage} />
          )}

          {!fetchLoading && !showEmpty && activeTab === "fleet" && (
            <FleetTable rows={fleetRows} dateRange={dateRange} />
          )}

          {!fetchLoading && !showEmpty && activeTab === "logs" && (
            <LogsTable rows={logRows} />
          )}
        </div>
      </div>
    </UserFormatProvider>
  );
});

export default App;
