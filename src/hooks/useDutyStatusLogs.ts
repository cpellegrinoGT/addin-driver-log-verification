import { useState, useCallback, useRef } from "react";
import type { GeotabApi, Driver, DutyStatusLog } from "../types";
import { apiMultiCall, delay } from "../lib/geotabApi";
import { VERIFIABLE_STATUSES } from "../lib/statusNames";

const CHUNK_DAYS = 14;
const BATCH_DELAY_MS = 100;
const DRIVER_BATCH_SIZE = 50;

interface FetchState {
  loading: boolean;
  progress: number;
  progressText: string;
}

interface UseDutyStatusLogsResult extends FetchState {
  fetchLogs: (
    api: GeotabApi,
    drivers: Driver[],
    dateRange: { from: string; to: string },
  ) => Promise<DutyStatusLog[]>;
  abort: () => void;
}

export function useDutyStatusLogs(): UseDutyStatusLogsResult {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const fetchLogs = useCallback(
    async (api: GeotabApi, drivers: Driver[], dateRange: { from: string; to: string }) => {
      abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setProgress(0);
      setProgressText("Fetching duty status logs...");

      const fromMs = new Date(dateRange.from).getTime();
      const toMs = new Date(dateRange.to).getTime();

      // Build time chunks
      const timeChunks: { from: string; to: string }[] = [];
      let cursor = fromMs;
      while (cursor < toMs) {
        const chunkEnd = Math.min(cursor + CHUNK_DAYS * 86400000, toMs);
        timeChunks.push({
          from: new Date(cursor).toISOString(),
          to: new Date(chunkEnd).toISOString(),
        });
        cursor = chunkEnd;
      }

      // Build driver batches
      const driverBatches: Driver[][] = [];
      for (let i = 0; i < drivers.length; i += DRIVER_BATCH_SIZE) {
        driverBatches.push(drivers.slice(i, i + DRIVER_BATCH_SIZE));
      }

      const totalSteps = timeChunks.length * driverBatches.length;
      let completedSteps = 0;
      const allLogs: DutyStatusLog[] = [];

      for (let ci = 0; ci < timeChunks.length; ci++) {
        const chunk = timeChunks[ci];
        for (let bi = 0; bi < driverBatches.length; bi++) {
          if (controller.signal.aborted) {
            setLoading(false);
            return [];
          }

          if (ci > 0 || bi > 0) {
            await delay(BATCH_DELAY_MS);
          }

          if (controller.signal.aborted) {
            setLoading(false);
            return [];
          }

          const batch = driverBatches[bi];
          const calls: [string, Record<string, unknown>][] = batch.map((driver) => [
            "Get",
            {
              typeName: "DutyStatusLog",
              search: {
                userSearch: { id: driver.id },
                fromDate: chunk.from,
                toDate: chunk.to,
              },
              resultsLimit: 50000,
              propertySelector: {
                fields: [
                  "id", "driver", "coDriver", "device",
                  "status", "dutyStatus", "dateTime",
                  "verifyDateTime", "elapsedDuration",
                  "annotations", "annotation",
                ],
              },
            },
          ]);

          const results = await apiMultiCall(api, calls);

          results.forEach((logs: DutyStatusLog[], idx: number) => {
            if (Array.isArray(logs)) {
              const driverId = batch[idx].id;
              for (const log of logs) {
                const logStatus = log.status || log.dutyStatus || "";
                if (!VERIFIABLE_STATUSES[logStatus]) continue;
                if (!log.driver) log.driver = { id: driverId };
                allLogs.push(log);
              }
            }
          });

          completedSteps++;
          const pct = (completedSteps / totalSteps) * 100;
          setProgress(pct);
          setProgressText("Fetching duty status logs... " + Math.round(pct) + "%");
        }
      }

      setLoading(false);
      return allLogs;
    },
    [abort],
  );

  return { loading, progress, progressText, fetchLogs, abort };
}
