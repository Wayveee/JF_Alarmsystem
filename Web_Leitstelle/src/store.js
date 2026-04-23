import { useEffect, useState, useCallback } from 'react';
import { v4 as uuid } from 'uuid';

export const nowIso = () => new Date().toISOString();
export const formatTime = (ts) =>
  ts ? new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '–';
export const formatDateTime = (ts) =>
  ts ? new Date(ts).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '–';
export const timeAgo = (ts) => {
  if (!ts) return '–';
  const ms = Date.now() - new Date(ts).getTime();
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
};

export const VEHICLE_TYPES = ['ELW', 'LF', 'HLF', 'TLF', 'TSF-W', 'MTF', 'RW', 'GW', 'Sonstiges'];

export const INCIDENT_KEYWORDS = [
  { value: 'BMA', label: 'BMA – Brandmeldeanlage' },
  { value: 'FEU', label: 'FEU – Feuer klein' },
  { value: 'FEU-M', label: 'FEU-M – Feuer mittel' },
  { value: 'FEU-G', label: 'FEU-G – Feuer groß' },
  { value: 'THK', label: 'THK – Technische Hilfe klein' },
  { value: 'THP', label: 'THP – Techn. Hilfe, Person in Gefahr' },
  { value: 'ÖL', label: 'ÖL – Ölspur' },
  { value: 'VU', label: 'VU – Verkehrsunfall' },
  { value: 'Sonstiges', label: 'Sonstiges' },
];

export const defaultSettings = {
  soundEnabled: true,
  volume: 0.8,
  tone: 'beep',
  customTone: null,
  appInstallUrl: '',
  mapLat: 51.1657,
  mapLng: 10.4515,
  mapZoom: 13,
  mapAreaName: 'Einsatzgebiet',
};

const defaultVehiclesList = [
  { callsign: 'JF-ELW 1', type: 'ELW', notes: 'Leitung' },
  { callsign: 'JF-LF 10/6', type: 'LF', notes: 'Gruppe 1' },
  { callsign: 'JF-TSF-W', type: 'TSF-W', notes: 'Gruppe 2' },
  { callsign: 'JF-MTF', type: 'MTF', notes: 'Nachführung' },
];

export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);

  // Sync across tabs / pages
  useEffect(() => {
    function onStorage(e) {
      if (e.key === key) {
        try {
          setValue(e.newValue ? JSON.parse(e.newValue) : initialValue);
        } catch {}
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key, initialValue]);

  return [value, setValue];
}

export function useStore() {
  const [vehicles, setVehicles] = useLocalStorage(
    'jf_vehicles',
    defaultVehiclesList.map((v) => ({
      id: uuid(),
      ...v,
      status: 'frei',
      assignedIncidentId: null,
      lastChange: null,
    }))
  );
  const [incidents, setIncidents] = useLocalStorage('jf_incidents', []);
  const [settings, setSettings] = useLocalStorage('jf_settings', defaultSettings);

  const addIncident = useCallback(
    (payload) => {
      const id = uuid();
      const inc = { id, createdAt: nowIso(), status: 'offen', payload, feedbackLog: [] };
      setIncidents((prev) => [inc, ...prev]);
      return inc;
    },
    [setIncidents]
  );

  const updateIncident = useCallback(
    (id, patch) => {
      setIncidents((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    },
    [setIncidents]
  );

  const addFeedback = useCallback(
    (incidentId, entry) => {
      setIncidents((prev) =>
        prev.map((i) =>
          i.id === incidentId
            ? { ...i, feedbackLog: [...(i.feedbackLog || []), { id: uuid(), timestamp: nowIso(), ...entry }] }
            : i
        )
      );
    },
    [setIncidents]
  );

  const addVehicle = useCallback(
    (callsign, type, notes) => {
      setVehicles((prev) => [
        { id: uuid(), callsign, type, notes, status: 'frei', assignedIncidentId: null, lastChange: nowIso() },
        ...prev,
      ]);
    },
    [setVehicles]
  );

  const editVehicle = useCallback(
    (id, patch) => {
      setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
    },
    [setVehicles]
  );

  const removeVehicle = useCallback(
    (id) => setVehicles((prev) => prev.filter((v) => v.id !== id)),
    [setVehicles]
  );

  const alertVehicle = useCallback(
    async (vehicleId, incidentId, message) => {
      const vehicle = vehicles.find((v) => v.id === vehicleId);
      editVehicle(vehicleId, {
        status: 'alarmiert',
        assignedIncidentId: incidentId,
        lastChange: nowIso(),
        msg: message,
      });
      if (incidentId) {
        addFeedback(incidentId, {
          vehicleId,
          vehicleCallsign: vehicle?.callsign || 'Fahrzeug',
          action: 'alarmiert',
          message,
        });
      }
      const SERVER_URL = (import.meta.env.VITE_SERVER_URL || 'http://localhost:3000').replace(/\/$/, '');
      try {
        await fetch(`${SERVER_URL}/alarm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'JF Alarm',
            body: `${vehicle?.callsign || 'Fahrzeug'} alarmiert – ${message}`,
            data: { vehicleId, incidentId },
          }),
        });
      } catch (e) {
        console.warn('Push fehlgeschlagen', e);
      }
    },
    [vehicles, editVehicle, addFeedback]
  );

  const setVehicleStatus = useCallback(
    (vehicleId, status, incidentId) => {
      const vehicle = vehicles.find((v) => v.id === vehicleId);
      editVehicle(vehicleId, { status, lastChange: nowIso() });
      const targetIncident = incidentId || vehicle?.assignedIncidentId;
      if (targetIncident) {
        addFeedback(targetIncident, {
          vehicleId,
          vehicleCallsign: vehicle?.callsign || 'Fahrzeug',
          action: status,
        });
      }
    },
    [vehicles, editVehicle, addFeedback]
  );

  const clearVehicle = useCallback(
    (vehicleId) => {
      const vehicle = vehicles.find((v) => v.id === vehicleId);
      const targetIncident = vehicle?.assignedIncidentId;
      editVehicle(vehicleId, { status: 'frei', assignedIncidentId: null, lastChange: nowIso(), msg: null });
      if (targetIncident) {
        addFeedback(targetIncident, {
          vehicleId,
          vehicleCallsign: vehicle?.callsign || 'Fahrzeug',
          action: 'frei gemeldet',
        });
      }
    },
    [vehicles, editVehicle, addFeedback]
  );

  const resetAll = useCallback(() => {
    localStorage.clear();
    window.location.reload();
  }, []);

  const exportAll = useCallback(() => {
    const blob = new Blob([JSON.stringify({ vehicles, incidents, settings }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leitstelle_export_${new Date().toISOString().slice(0, 19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [vehicles, incidents, settings]);

  const importAll = useCallback(
    (file) => {
      const r = new FileReader();
      r.onload = () => {
        try {
          const data = JSON.parse(r.result);
          if (data.vehicles && data.incidents) {
            setVehicles(data.vehicles);
            setIncidents(data.incidents);
            if (data.settings) setSettings(data.settings);
          } else alert('Ungültige Datei');
        } catch {
          alert('Konnte Datei nicht lesen');
        }
      };
      r.readAsText(file);
    },
    [setVehicles, setIncidents, setSettings]
  );

  return {
    vehicles,
    incidents,
    settings,
    setSettings,
    addIncident,
    updateIncident,
    addFeedback,
    addVehicle,
    editVehicle,
    removeVehicle,
    alertVehicle,
    setVehicleStatus,
    clearVehicle,
    resetAll,
    exportAll,
    importAll,
  };
}
