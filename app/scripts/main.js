/**
 * Driver Log Verification — MyGeotab Add-In
 *
 * Provides driver log verification status tracking (verified vs unverified)
 * for fleet drivers using Geotab API DutyStatusLog data.
 */

geotab.addin.driverLogVerification = function () {
  "use strict";

  // ── Constants ──────────────────────────────────────────────────────────
  var MIN_DATE = "0001-01-01T00:00:00.000Z";
  var CHUNK_DAYS = 7;
  var BATCH_DELAY_MS = 300;
  var DRIVER_BATCH_SIZE = 25;

  // DutyStatusLog status type display names
  var STATUS_NAMES = {
    "D": "Driving",
    "ON": "On Duty",
    "OFF": "Off Duty",
    "SB": "Sleeper Berth",
    "PC": "Personal Conveyance",
    "YM": "Yard Move",
    "WT": "Wait Time"
  };

  // ── State ──────────────────────────────────────────────────────────────
  var api;
  var allDrivers = [];
  var allGroups = {};
  var allDevices = {};
  var abortController = null;
  var firstFocus = true;
  var activeTab = "fleet";

  // Computed data (populated on Apply)
  var dlvData = {
    logs: [],          // all DutyStatusLog entries
    fleetRows: [],     // per-driver summary rows
    logRows: []        // individual log rows
  };

  // Sort state per table
  var sortState = {
    fleet: { col: "unverified", dir: "desc" },
    logs: { col: "dateTime", dir: "desc" }
  };

  // ── DOM refs (set during initialize) ───────────────────────────────────
  var els = {};

  // ── Helpers ────────────────────────────────────────────────────────────

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  function formatDate(d) {
    if (!d) return "--";
    var dt = new Date(d);
    return (dt.getMonth() + 1) + "/" + dt.getDate() + "/" + dt.getFullYear();
  }

  function formatPct(n) {
    if (n == null || isNaN(n)) return "--";
    return n.toFixed(1) + "%";
  }

  function getDateRange() {
    var now = new Date();
    var preset = document.querySelector(".dlv-preset.active");
    var key = preset ? preset.dataset.preset : "7days";
    var from, to;

    to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    switch (key) {
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
        from = els.fromDate.value ? new Date(els.fromDate.value + "T00:00:00") : new Date(now.getTime() - 30 * 86400000);
        to = els.toDate.value ? new Date(els.toDate.value + "T23:59:59") : to;
        break;
      case "30days":
      default:
        from = new Date(now);
        from.setDate(from.getDate() - 30);
        from.setHours(0, 0, 0, 0);
        break;
    }

    return { from: from.toISOString(), to: to.toISOString() };
  }

  function isAborted() {
    return abortController && abortController.signal && abortController.signal.aborted;
  }

  function showLoading(show, text) {
    els.loading.style.display = show ? "flex" : "none";
    els.empty.style.display = "none";
    if (text) els.loadingText.textContent = text;
  }

  function showEmpty(show) {
    els.empty.style.display = show ? "flex" : "none";
  }

  function setProgress(pct) {
    els.progressBar.style.width = Math.min(100, Math.round(pct)) + "%";
  }

  function showWarning(msg) {
    els.warning.style.display = msg ? "block" : "none";
    els.warning.textContent = msg || "";
  }

  function isVerified(log) {
    if (!log.verifyDateTime) return false;
    var vdt = log.verifyDateTime;
    if (typeof vdt === "string" && vdt.indexOf("0001-01-01") === 0) return false;
    if (vdt instanceof Date && vdt.getFullYear() <= 1) return false;
    return true;
  }

  function getStatusName(log) {
    // Try the status property first, then fall back to dutyStatus
    var s = log.status || log.dutyStatus || "";
    var upper = String(s).toUpperCase();

    // Handle full enum names from the API
    if (upper === "D" || upper === "DRIVING") return "Driving";
    if (upper === "ON" || upper === "ONDUTY" || upper === "ON DUTY") return "On Duty";
    if (upper === "OFF" || upper === "OFFDUTY" || upper === "OFF DUTY") return "Off Duty";
    if (upper === "SB" || upper === "SLEEPERBERTH" || upper === "SLEEPER BERTH") return "Sleeper Berth";
    if (upper === "PC" || upper === "PERSONALCONVEYANCE" || upper === "PERSONAL CONVEYANCE") return "Personal Conveyance";
    if (upper === "YM" || upper === "YARDMOVE" || upper === "YARD MOVE") return "Yard Move";
    if (upper === "WT" || upper === "WAITTIME" || upper === "WAIT TIME") return "Wait Time";

    // Check STATUS_NAMES for short codes
    if (STATUS_NAMES[upper]) return STATUS_NAMES[upper];

    return s || "--";
  }

  // ── API Helpers ────────────────────────────────────────────────────────

  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function apiCall(method, params) {
    return new Promise(function (resolve, reject) {
      api.call(method, params, resolve, reject);
    });
  }

  function apiMultiCall(calls) {
    return new Promise(function (resolve, reject) {
      api.multiCall(calls, resolve, reject);
    });
  }

  // ── Group & Driver Helpers ─────────────────────────────────────────────

  function populateGroupDropdown() {
    var current = els.group.value;
    els.group.innerHTML = '<option value="all">All Groups</option>';

    var skipIds = { GroupCompanyId: true, GroupNothingId: true };
    var groupList = [];
    Object.keys(allGroups).forEach(function (gid) {
      var g = allGroups[gid];
      if (skipIds[gid]) return;
      if (!g.name || g.name === "CompanyGroup" || g.name === "**Nothing**") return;
      groupList.push(g);
    });
    groupList.sort(function (a, b) { return (a.name || "").localeCompare(b.name || ""); });

    groupList.forEach(function (g) {
      var opt = document.createElement("option");
      opt.value = g.id;
      opt.textContent = g.name || g.id;
      els.group.appendChild(opt);
    });
    if (current && els.group.querySelector('option[value="' + current + '"]')) {
      els.group.value = current;
    }
  }

  function populateDriverDropdown() {
    var current = els.driver.value;
    els.driver.innerHTML = '<option value="all">All Drivers</option>';
    var sorted = allDrivers.slice().sort(function (a, b) {
      var na = (a.firstName || "") + " " + (a.lastName || "");
      var nb = (b.firstName || "") + " " + (b.lastName || "");
      return na.localeCompare(nb);
    });
    sorted.forEach(function (d) {
      var opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = ((d.firstName || "") + " " + (d.lastName || "")).trim() || d.name || d.id;
      els.driver.appendChild(opt);
    });
    if (current && els.driver.querySelector('option[value="' + current + '"]')) {
      els.driver.value = current;
    }
  }

  function getDriverName(driverId) {
    for (var i = 0; i < allDrivers.length; i++) {
      if (allDrivers[i].id === driverId) {
        var d = allDrivers[i];
        var name = ((d.firstName || "") + " " + (d.lastName || "")).trim();
        return name || d.name || d.id;
      }
    }
    return driverId || "--";
  }

  function getDeviceName(deviceId) {
    if (!deviceId) return "--";
    var d = allDevices[deviceId];
    return d ? (d.name || d.id) : deviceId;
  }

  function filteredDrivers() {
    var driverId = els.driver.value;
    var groupId = els.group.value;

    if (driverId !== "all") {
      return allDrivers.filter(function (d) { return d.id === driverId; });
    }

    return allDrivers.filter(function (d) {
      if (groupId !== "all") {
        var driverGroups = d.companyGroups || d.driverGroups || [];
        var inGroup = false;
        for (var i = 0; i < driverGroups.length; i++) {
          if (driverGroups[i].id === groupId) { inGroup = true; break; }
        }
        if (!inGroup) return false;
      }
      return true;
    });
  }

  // ── Data Fetch ─────────────────────────────────────────────────────────

  function fetchDutyStatusLogs(drivers, dateRange, onProgress) {
    var fromMs = new Date(dateRange.from).getTime();
    var toMs = new Date(dateRange.to).getTime();

    // Build time chunks
    var timeChunks = [];
    var cursor = fromMs;
    while (cursor < toMs) {
      var chunkEnd = Math.min(cursor + CHUNK_DAYS * 86400000, toMs);
      timeChunks.push({
        from: new Date(cursor).toISOString(),
        to: new Date(chunkEnd).toISOString()
      });
      cursor = chunkEnd;
    }

    // Build driver batches
    var driverBatches = [];
    for (var i = 0; i < drivers.length; i += DRIVER_BATCH_SIZE) {
      driverBatches.push(drivers.slice(i, i + DRIVER_BATCH_SIZE));
    }

    var totalSteps = timeChunks.length * driverBatches.length;
    var completedSteps = 0;
    var allLogs = [];

    // Sequential: iterate time chunks, within each chunk batch drivers
    return timeChunks.reduce(function (chain, chunk, chunkIdx) {
      return chain.then(function () {
        return driverBatches.reduce(function (innerChain, batch, batchIdx) {
          return innerChain.then(function () {
            if (isAborted()) return;
            var shouldDelay = chunkIdx > 0 || batchIdx > 0;
            var pause = shouldDelay ? delay(BATCH_DELAY_MS) : Promise.resolve();
            return pause.then(function () {
              if (isAborted()) return;

              // Build multiCall for this batch of drivers in this time chunk
              var calls = batch.map(function (driver) {
                return ["Get", {
                  typeName: "DutyStatusLog",
                  search: {
                    userSearch: { id: driver.id },
                    fromDate: chunk.from,
                    toDate: chunk.to
                  }
                }];
              });

              return apiMultiCall(calls).then(function (results) {
                results.forEach(function (logs, idx) {
                  if (Array.isArray(logs)) {
                    // Tag each log with the driver id for easy lookup
                    var driverId = batch[idx].id;
                    logs.forEach(function (log) {
                      if (!log.driver) log.driver = { id: driverId };
                      allLogs.push(log);
                    });
                  }
                });
                completedSteps++;
                if (onProgress) onProgress(completedSteps / totalSteps * 100);
              });
            });
          });
        }, Promise.resolve());
      });
    }, Promise.resolve()).then(function () {
      return allLogs;
    });
  }

  // ── Build Summaries ────────────────────────────────────────────────────

  function buildFleetSummary(logs) {
    var byDriver = {};

    logs.forEach(function (log) {
      var did = log.driver ? log.driver.id : null;
      if (!did) return;

      if (!byDriver[did]) {
        byDriver[did] = { driverId: did, driverName: getDriverName(did), total: 0, verified: 0, unverified: 0 };
      }

      byDriver[did].total++;
      if (isVerified(log)) {
        byDriver[did].verified++;
      } else {
        byDriver[did].unverified++;
      }
    });

    var rows = [];
    Object.keys(byDriver).forEach(function (did) {
      var d = byDriver[did];
      d.verifiedPct = d.total > 0 ? (d.verified / d.total * 100) : 0;
      rows.push(d);
    });

    return rows;
  }

  function buildLogRows(logs) {
    return logs.map(function (log) {
      var driverId = log.driver ? log.driver.id : null;
      var coDriverId = log.coDriver ? log.coDriver.id : null;
      var deviceId = log.device ? log.device.id : null;
      var verified = isVerified(log);

      // Compute hours from elapsed duration if available
      var hours = "--";
      if (log.elapsedDuration != null) {
        hours = (log.elapsedDuration / 3600).toFixed(1);
      } else if (log.malfunction != null) {
        hours = "--";
      }

      return {
        id: log.id,
        driverId: driverId,
        driverName: getDriverName(driverId),
        dateTime: log.dateTime || null,
        status: getStatusName(log),
        isVerified: verified,
        verifiedLabel: verified ? "Verified" : "Unverified",
        coDriverId: coDriverId,
        coDriverName: coDriverId ? getDriverName(coDriverId) : "--",
        hours: hours,
        deviceId: deviceId,
        device: getDeviceName(deviceId),
        annotation: log.annotations && log.annotations.length > 0
          ? log.annotations.map(function (a) { return a.comment || ""; }).join("; ")
          : (log.annotation || "--")
      };
    });
  }

  // ── Rendering ──────────────────────────────────────────────────────────

  function renderActiveTab() {
    switch (activeTab) {
      case "fleet": renderFleet(); break;
      case "logs": renderLogsTable(); break;
    }
  }

  function renderFleet() {
    renderKpis();
    renderFleetTable();
  }

  function renderKpis() {
    var rows = dlvData.fleetRows;
    var totalLogs = 0, totalVerified = 0, totalUnverified = 0;
    var driversWithUnverified = 0;

    rows.forEach(function (r) {
      totalLogs += r.total;
      totalVerified += r.verified;
      totalUnverified += r.unverified;
      if (r.unverified > 0) driversWithUnverified++;
    });

    var fleetPct = totalLogs > 0 ? (totalVerified / totalLogs * 100) : 0;

    els.kpiVerifiedPct.textContent = formatPct(fleetPct);
    els.kpiUnverified.textContent = totalUnverified;
    els.kpiDriversUnverified.textContent = driversWithUnverified;
  }

  function renderFleetTable() {
    var rows = dlvData.fleetRows.slice();
    sortRows(rows, sortState.fleet);

    renderTableBody(els.fleetBody, rows, function (r) {
      var pctClass = r.verifiedPct >= 100 ? "dlv-pct-full" : "dlv-pct-partial";
      return '<td>' + escapeHtml(r.driverName) + '</td>' +
        '<td>' + r.total + '</td>' +
        '<td>' + r.verified + '</td>' +
        '<td>' + r.unverified + '</td>' +
        '<td><span class="' + pctClass + '">' + formatPct(r.verifiedPct) + '</span></td>';
    });
  }

  function renderLogsTable() {
    var rows = dlvData.logRows.slice();
    var statusFilter = els.logsFilter.value;
    var searchTerm = els.logsSearch.value.toLowerCase();

    if (statusFilter === "verified") {
      rows = rows.filter(function (r) { return r.isVerified; });
    } else if (statusFilter === "unverified") {
      rows = rows.filter(function (r) { return !r.isVerified; });
    }

    if (searchTerm) {
      rows = rows.filter(function (r) {
        return r.driverName.toLowerCase().indexOf(searchTerm) >= 0 ||
               r.status.toLowerCase().indexOf(searchTerm) >= 0 ||
               r.device.toLowerCase().indexOf(searchTerm) >= 0 ||
               r.annotation.toLowerCase().indexOf(searchTerm) >= 0 ||
               r.coDriverName.toLowerCase().indexOf(searchTerm) >= 0;
      });
    }

    sortRows(rows, sortState.logs);

    renderTableBody(els.logsBody, rows, function (r) {
      var badgeClass = r.isVerified ? "dlv-badge dlv-badge-verified" : "dlv-badge dlv-badge-unverified";
      return '<td>' + escapeHtml(r.driverName) + '</td>' +
        '<td>' + formatDate(r.dateTime) + '</td>' +
        '<td>' + escapeHtml(r.status) + '</td>' +
        '<td><span class="' + badgeClass + '">' + r.verifiedLabel + '</span></td>' +
        '<td>' + escapeHtml(r.coDriverName) + '</td>' +
        '<td>' + escapeHtml(String(r.hours)) + '</td>' +
        '<td>' + escapeHtml(r.device) + '</td>' +
        '<td>' + escapeHtml(r.annotation) + '</td>';
    });
  }

  // ── Table Utilities ───────────────────────────────────────────────────

  function renderTableBody(tbody, rows, cellFn) {
    var frag = document.createDocumentFragment();
    rows.forEach(function (r) {
      var tr = document.createElement("tr");
      tr.innerHTML = cellFn(r);
      frag.appendChild(tr);
    });
    tbody.innerHTML = "";
    tbody.appendChild(frag);
  }

  function sortRows(rows, state) {
    var col = state.col;
    var dir = state.dir === "asc" ? 1 : -1;

    rows.sort(function (a, b) {
      var va = a[col], vb = b[col];
      if (va == null) va = "";
      if (vb == null) vb = "";
      // Boolean sorting (isVerified)
      if (typeof va === "boolean" && typeof vb === "boolean") {
        return ((va ? 1 : 0) - (vb ? 1 : 0)) * dir;
      }
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }

  function handleSort(tableId, th) {
    var col = th.dataset.col;
    if (!col) return;
    var state = sortState[tableId];
    if (state.col === col) {
      state.dir = state.dir === "asc" ? "desc" : "asc";
    } else {
      state.col = col;
      state.dir = "asc";
    }

    // Update arrow indicators
    var table = th.closest("table");
    table.querySelectorAll(".dlv-sortable").forEach(function (h) {
      h.classList.remove("dlv-sort-asc", "dlv-sort-desc");
    });
    th.classList.add("dlv-sort-" + state.dir);

    // Re-render
    switch (tableId) {
      case "fleet": renderFleetTable(); break;
      case "logs": renderLogsTable(); break;
    }
  }

  // ── CSV Export ─────────────────────────────────────────────────────────

  function exportCsv(filename, headers, rows) {
    var lines = [headers.join(",")];
    rows.forEach(function (r) {
      var vals = headers.map(function (h) {
        var v = r[h] != null ? String(r[h]) : "";
        if (v.indexOf(",") >= 0 || v.indexOf('"') >= 0 || v.indexOf("\n") >= 0) {
          v = '"' + v.replace(/"/g, '""') + '"';
        }
        return v;
      });
      lines.push(vals.join(","));
    });

    var blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Main Load (Apply) ─────────────────────────────────────────────────

  function loadData() {
    if (abortController) abortController.abort();
    abortController = new AbortController();

    showLoading(true, "Fetching duty status logs...");
    showEmpty(false);
    showWarning(null);
    setProgress(0);

    var dateRange = getDateRange();
    var drivers = filteredDrivers();

    if (drivers.length === 0) {
      showLoading(false);
      showEmpty(true);
      return;
    }

    els.progress.textContent = drivers.length + " drivers selected";

    fetchDutyStatusLogs(drivers, dateRange, function (pct) {
      setProgress(pct);
      els.loadingText.textContent = "Fetching duty status logs... " + Math.round(pct) + "%";
    }).then(function (logs) {
      if (isAborted()) return;
      if (!logs) return;

      dlvData.logs = logs;

      // Build summaries
      showLoading(true, "Computing metrics...");
      dlvData.fleetRows = buildFleetSummary(logs);
      dlvData.logRows = buildLogRows(logs);

      // Render
      renderActiveTab();
      showLoading(false);

      if (logs.length === 0) {
        showEmpty(true);
      }
    }).catch(function (err) {
      if (!isAborted()) {
        console.error("Driver Log Verification error:", err);
        showLoading(false);
        showEmpty(true);
        els.empty.textContent = "Error loading data. Please try again.";
      }
    });
  }

  // ── UI Event Handlers ─────────────────────────────────────────────────

  function onPresetClick(e) {
    var btn = e.target.closest(".dlv-preset");
    if (!btn) return;

    document.querySelectorAll(".dlv-preset").forEach(function (b) { b.classList.remove("active"); });
    btn.classList.add("active");

    var isCustom = btn.dataset.preset === "custom";
    els.customDates.style.display = isCustom ? "" : "none";

    if (isCustom && !els.fromDate.value) {
      var now = new Date();
      var from = new Date(now);
      from.setDate(from.getDate() - 30);
      els.fromDate.value = from.toISOString().slice(0, 10);
      els.toDate.value = now.toISOString().slice(0, 10);
    }
  }

  function onTabClick(e) {
    var btn = e.target.closest(".dlv-tab");
    if (!btn) return;

    document.querySelectorAll(".dlv-tab").forEach(function (t) { t.classList.remove("active"); });
    btn.classList.add("active");

    activeTab = btn.dataset.tab;

    // Show/hide panels
    document.querySelectorAll(".dlv-panel").forEach(function (p) { p.classList.remove("active"); });
    var panel = $("dlv-panel-" + activeTab);
    if (panel) panel.classList.add("active");

    // Show/hide KPI strip (only on fleet tab)
    els.kpiStrip.style.display = activeTab === "fleet" ? "flex" : "none";

    // Re-render active tab
    if (dlvData.fleetRows.length > 0 || dlvData.logRows.length > 0) {
      renderActiveTab();
    }
  }

  // ── Add-In Lifecycle ──────────────────────────────────────────────────

  return {
    initialize: function (freshApi, state, callback) {
      api = freshApi;

      // Cache DOM refs
      els.fromDate = $("dlv-from");
      els.toDate = $("dlv-to");
      els.customDates = $("dlv-custom-dates");
      els.group = $("dlv-group");
      els.driver = $("dlv-driver");
      els.apply = $("dlv-apply");
      els.progress = $("dlv-progress");
      els.loading = $("dlv-loading");
      els.loadingText = $("dlv-loading-text");
      els.progressBar = $("dlv-progress-bar");
      els.empty = $("dlv-empty");
      els.warning = $("dlv-warning");
      els.kpiStrip = $("dlv-kpi-strip");
      els.kpiVerifiedPct = $("dlv-kpi-verified-pct");
      els.kpiUnverified = $("dlv-kpi-unverified");
      els.kpiDriversUnverified = $("dlv-kpi-drivers-unverified");
      els.fleetBody = $("dlv-fleet-body");
      els.logsFilter = $("dlv-logs-filter");
      els.logsSearch = $("dlv-logs-search");
      els.logsBody = $("dlv-logs-body");

      // Event listeners
      els.apply.addEventListener("click", loadData);
      document.querySelector(".dlv-presets").addEventListener("click", onPresetClick);
      $("dlv-tabs").addEventListener("click", onTabClick);

      // Table sort listeners
      $("dlv-fleet-table").addEventListener("click", function (e) {
        var th = e.target.closest(".dlv-sortable");
        if (th) handleSort("fleet", th);
      });
      $("dlv-logs-table").addEventListener("click", function (e) {
        var th = e.target.closest(".dlv-sortable");
        if (th) handleSort("logs", th);
      });

      // Search / filter listeners
      els.logsFilter.addEventListener("change", renderLogsTable);
      els.logsSearch.addEventListener("input", renderLogsTable);

      // CSV export listeners
      $("dlv-fleet-export").addEventListener("click", function () {
        var headers = ["driverName", "total", "verified", "unverified", "verifiedPct"];
        var rows = dlvData.fleetRows.map(function (r) {
          return {
            driverName: r.driverName,
            total: r.total,
            verified: r.verified,
            unverified: r.unverified,
            verifiedPct: formatPct(r.verifiedPct)
          };
        });
        exportCsv("driver_log_verification_fleet.csv", headers, rows);
      });
      $("dlv-logs-export").addEventListener("click", function () {
        var headers = ["driverName", "dateTime", "status", "verifiedLabel", "coDriverName", "hours", "device", "annotation"];
        var rows = dlvData.logRows.map(function (r) {
          return {
            driverName: r.driverName,
            dateTime: formatDate(r.dateTime),
            status: r.status,
            verifiedLabel: r.verifiedLabel,
            coDriverName: r.coDriverName,
            hours: r.hours,
            device: r.device,
            annotation: r.annotation
          };
        });
        exportCsv("driver_log_verification_logs.csv", headers, rows);
      });

      // Load foundation data: Users (drivers) + Groups + Devices
      var groupFilter = state.getGroupFilter();

      Promise.all([
        apiCall("Get", { typeName: "User", search: { isDriver: true }, resultsLimit: 5000 }),
        apiCall("Get", { typeName: "Group", resultsLimit: 5000 }),
        apiCall("Get", { typeName: "Device", resultsLimit: 5000 })
      ]).then(function (results) {
        allDrivers = results[0] || [];
        var groups = results[1] || [];
        var devices = results[2] || [];

        // Build group lookup
        allGroups = {};
        groups.forEach(function (g) {
          allGroups[g.id] = g;
        });

        // Build device lookup
        allDevices = {};
        devices.forEach(function (d) {
          allDevices[d.id] = d;
        });

        populateGroupDropdown();
        populateDriverDropdown();
        callback();
      }).catch(function (err) {
        console.error("Driver Log Verification init error:", err);
        callback();
      });
    },

    focus: function (freshApi, state) {
      api = freshApi;

      // Refresh driver list
      apiCall("Get", { typeName: "User", search: { isDriver: true }, resultsLimit: 5000 })
        .then(function (drivers) {
          allDrivers = drivers || [];
          populateDriverDropdown();
        }).catch(function () {});

      // Auto-load on first focus
      if (firstFocus) {
        firstFocus = false;
        loadData();
      }
    },

    blur: function () {
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
      showLoading(false);
    }
  };
};
