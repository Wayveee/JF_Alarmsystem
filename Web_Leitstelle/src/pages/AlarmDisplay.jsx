import React, { useEffect, useState } from 'react';
import { useStore, formatTime } from '../store.js';

const ALARM_STATUSES = ['alarmiert', 'rückmeldung', 'an der Einsatzstelle', 'einsatzbereit'];

export default function AlarmDisplay() {
  const { vehicles, incidents } = useStore();
  const [tick, setTick] = useState(0);

  // Live clock tick every second
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const activeVehicles = vehicles.filter((v) => ALARM_STATUSES.includes(v.status));

  function getIncident(id) {
    return incidents.find((i) => i.id === id);
  }

  function elapsed(ts) {
    if (!ts) return '–';
    const ms = Date.now() - new Date(ts).getTime();
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
  }

  return (
    <div className="display-root">
      {/* Header bar */}
      <div className="display-header">
        <div className="display-logo">🚒</div>
        <div className="display-title">Alarmierungsdisplay – Jugendfeuerwehr</div>
        <div className="display-clock">{new Date().toLocaleTimeString('de-DE')}</div>
      </div>

      {/* Content */}
      <div className="display-body">
        {activeVehicles.length === 0 ? (
          <div className="display-idle">
            <div className="display-idle-icon">✅</div>
            <div className="display-idle-text">Alle Einheiten frei</div>
          </div>
        ) : (
          <div className="display-grid">
            {activeVehicles.map((v) => {
              const inc = getIncident(v.assignedIncidentId);
              return (
                <div
                  key={v.id}
                  className={`display-card ${v.status === 'alarmiert' ? 'display-card--alarm' : 'display-card--active'}`}
                >
                  <div className="display-card-status">{v.status.toUpperCase()}</div>
                  <div className="display-card-callsign">{v.callsign}</div>
                  <div className="display-card-type">{v.type}</div>

                  {inc ? (
                    <>
                      <div className="display-card-keyword">{inc.payload.was}</div>
                      <div className="display-card-location">
                        <span className="display-card-location-label">Zielort</span>
                        {inc.payload.wo || '–'}
                      </div>
                      <div className="display-card-prio">
                        Priorität:{' '}
                        <span className={`display-prio-badge prio-${inc.payload.prioritaet}`}>
                          {inc.payload.prioritaet || '–'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="display-card-keyword">Manuelle Alarmierung</div>
                  )}

                  <div className="display-card-elapsed">
                    <span className="display-card-elapsed-label">Seit</span>
                    {elapsed(v.lastChange)}
                  </div>
                  {v.msg && <div className="display-card-msg">💬 {v.msg}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="display-footer">
        <span>{activeVehicles.length} Einheit{activeVehicles.length !== 1 ? 'en' : ''} im Einsatz</span>
        <span style={{ marginLeft: 24 }}>
          {incidents.filter((i) => i.status !== 'beendet').length} aktive Einsätze
        </span>
        <a href="/" className="display-back-link">← Leitstelle</a>
      </div>
    </div>
  );
}
