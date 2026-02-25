import type { GeotabApi } from "../types";

export function apiCall(api: GeotabApi, method: string, params: Record<string, unknown>): Promise<any> {
  return new Promise((resolve, reject) => {
    api.call(method, params, resolve, reject);
  });
}

export function apiMultiCall(api: GeotabApi, calls: [string, Record<string, unknown>][]): Promise<any[]> {
  return new Promise((resolve, reject) => {
    api.multiCall(calls, resolve, reject);
  });
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
