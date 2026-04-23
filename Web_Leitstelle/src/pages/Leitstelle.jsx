import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useStore, formatTime, formatDateTime, nowIso, INCIDENT_KEYWORDS } from '../store.js';

// Fix leaflet default icon URLs when bundled with Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Sound data
const beepData =
  'data:audio/wav;base64,UklGRmQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQ4AAAABAQEBAP8AAP8AAP8AAP8A/wD/AAAAAP8A/wD/AAAAAP8A/wD/AAAAAP8A';
const chimeData =
  'data:audio/wav;base64,UklGRmQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQ4AAAABAQEAAP8A/wAAAP8A/wAAAP8A/wD/AAAAAP8A';

const defaultQuestions = [
  { key: 'wo', label: 'Wo ist es? (Ort/Adresse/Objekt)', type: 'text', required: true },
  {
    key: 'was',
    label: 'Stichwort / Was ist passiert?',
    type: 'select',
    required: true,
    options: INCIDENT_KEYWORDS,
  },
  { key: 'wer', label: 'Wer meldet? (Name/Telefon)', type: 'text', required: false },
  { key: 'wie', label: 'Wie viele Betroffene?', type: 'number', required: false },
  { key: 'rueckfragen', label: 'Rückfragen möglich?', type: 'switch', required: false },
  {
    key: 'prioritaet',
    label: 'Priorität',
    type: 'select',
    required: true,
    options: [
      { value: 'niedrig', label: 'Niedrig' },
      { value: 'normal', label: 'Normal' },
      { value: 'hoch', label: 'Hoch' },
    ],
  },
  { key: 'hinweise', label: 'Hinweise (Zufahrt, Besonderheiten)', type: 'textarea', required: false },
  { key: 'lat', label: 'Breitengrad (optional, für Kartenmarker)', type: 'text', required: false },
  { key: 'lng', label: 'Längengrad (optional, für Kartenmarker)', type: 'text', required: false },
];

// Recenter map helper
function MapController({ lat, lng, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom);
  }, [map, lat, lng, zoom]);
  return null;
}

export default function Leitstelle() {
  const store = useStore();
  const { vehicles, incidents, settings, alertVehicle, setVehicleStatus, clearVehicle, updateIncident, exportAll, importAll } = store;
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('aktiv'); // aktiv | alle
  const alarmAudioRef = useRef(null);

  const getToneSrc = () => {
    if (settings.tone === 'custom' && settings.customTone) return settings.customTone;
    if (settings.tone === 'chime') return chimeData;
    return beepData;
  };

  async function handleAlertVehicle(vehicleId, incidentId, message) {
    try {
      if (settings.soundEnabled && alarmAudioRef.current) {
        alarmAudioRef.current.pause();
        alarmAudioRef.current.currentTime = 0;
        alarmAudioRef.current.volume = Math.min(Math.max(settings.volume, 0), 1);
        alarmAudioRef.current.play();
      }
    } catch {}
    await alertVehicle(vehicleId, incidentId, message);
  }

  const displayedIncidents = useMemo(() => {
    if (filterStatus === 'aktiv') return incidents.filter((i) => i.status !== 'beendet');
    return incidents;
  }, [incidents, filterStatus]);

  const selectedIncident = useMemo(
    () => incidents.find((i) => i.id === selectedIncidentId),
    [incidents, selectedIncidentId]
  );

  // Map center: use selected incident coords if available, else settings area
  const mapCenter = useMemo(() => {
    if (selectedIncident?.payload?.lat && selectedIncident?.payload?.lng) {
      const lat = parseFloat(selectedIncident.payload.lat);
      const lng = parseFloat(selectedIncident.payload.lng);
      if (!isNaN(lat) && !isNaN(lng)) return [lat, lng];
    }
    return [settings.mapLat ?? 51.1657, settings.mapLng ?? 10.4515];
  }, [selectedIncident, settings]);

  const mapZoom = settings.mapZoom ?? 13;

  return (
    <>
      <audio ref={alarmAudioRef} src={getToneSrc()} preload="auto" />
      <div className="leitstelle-layout">
        {/* Left column: Incident intake */}
        <div className="ls-col ls-col-left">
          <div className="card">
            <h3>🚨 Neuen Einsatz aufnehmen</h3>
            <div className="small">Notruf-Fragenkatalog</div>
            <div className="hr" />
            <IncidentWizard
              onCreate={store.addIncident}
              onAlarm={(inc) => {
                setSelectedIncidentId(inc.id);
              }}
            />
          </div>
        </div>

        {/* Center column: Map + active incidents */}
        <div className="ls-col ls-col-center">
          {/* Map */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 12 }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
              <span className="k">🗺 Einsatzkarte</span>
              {settings.mapAreaName && (
                <span className="small" style={{ marginLeft: 8 }}>
                  {settings.mapAreaName}
                </span>
              )}
              {selectedIncident && (
                <span className="badge blue" style={{ marginLeft: 8 }}>
                  {selectedIncident.payload.wo || 'Kein Ort'}
                </span>
              )}
            </div>
            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              style={{ height: 300, width: '100%' }}
              key={`${mapCenter[0]}-${mapCenter[1]}`}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapController lat={mapCenter[0]} lng={mapCenter[1]} zoom={mapZoom} />
              {selectedIncident?.payload?.lat && selectedIncident?.payload?.lng &&
                !isNaN(parseFloat(selectedIncident.payload.lat)) &&
                !isNaN(parseFloat(selectedIncident.payload.lng)) && (
                  <Marker
                    position={[
                      parseFloat(selectedIncident.payload.lat),
                      parseFloat(selectedIncident.payload.lng),
                    ]}
                  >
                    <Popup>
                      <strong>{selectedIncident.payload.was}</strong>
                      <br />
                      {selectedIncident.payload.wo}
                    </Popup>
                  </Marker>
                )}
            </MapContainer>
          </div>

          {/* Incidents list */}
          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Einsätze</h3>
              <div className="row" style={{ gap: 6 }}>
                {['aktiv', 'alle'].map((s) => (
                  <button
                    key={s}
                    className={`btn ${filterStatus === s ? 'primary' : ''}`}
                    onClick={() => setFilterStatus(s)}
                  >
                    {s === 'aktiv' ? 'Aktiv' : 'Alle'}
                  </button>
                ))}
              </div>
            </div>
            {displayedIncidents.length === 0 ? (
              <div className="small">Keine Einsätze vorhanden.</div>
            ) : (
              <div className="grid" style={{ gap: 8 }}>
                {displayedIncidents.map((inc) => (
                  <IncidentCard
                    key={inc.id}
                    incident={inc}
                    selected={selectedIncidentId === inc.id}
                    vehicles={vehicles}
                    onSelect={() => setSelectedIncidentId(inc.id === selectedIncidentId ? null : inc.id)}
                    onUpdate={updateIncident}
                    onAlertVehicle={handleAlertVehicle}
                    onVehicleStatus={setVehicleStatus}
                    onClearVehicle={clearVehicle}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Feedback log */}
        <div className="ls-col ls-col-right">
          <div className="card" style={{ height: '100%', minHeight: 300 }}>
            <h3>📋 Rückmeldungsprotokoll</h3>
            {selectedIncident ? (
              <>
                <div className="small" style={{ marginBottom: 8 }}>
                  <span className="k">{selectedIncident.payload.was}</span> · {selectedIncident.payload.wo}
                </div>
                <div className="hr" />
                <FeedbackLog feedbackLog={selectedIncident.feedbackLog || []} />
                <div className="hr" />
                <ManualFeedbackEntry
                  incident={selectedIncident}
                  vehicles={vehicles}
                  onAddFeedback={store.addFeedback}
                />
              </>
            ) : (
              <div className="small" style={{ marginTop: 12 }}>
                Wähle einen Einsatz aus der Liste, um das Protokoll zu sehen.
              </div>
            )}
          </div>

          {/* Header actions */}
          <div className="card" style={{ marginTop: 12 }}>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={exportAll}>
                Export JSON
              </button>
              <label className="btn" style={{ cursor: 'pointer' }}>
                Import JSON
                <input
                  type="file"
                  accept="application/json"
                  style={{ display: 'none' }}
                  onChange={(e) => e.target.files?.[0] && importAll(e.target.files[0])}
                />
              </label>
              <a className="btn" href="/display" target="_blank" rel="noreferrer">
                🖥 Alarmierungs&shy;display
              </a>
              <a className="btn" href="/setup">
                ⚙ Setup/Admin
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// --- Incident Card ---
function IncidentCard({ incident, selected, vehicles, onSelect, onUpdate, onAlertVehicle, onVehicleStatus, onClearVehicle }) {
  const [showAlert, setShowAlert] = useState(false);
  const [alertVehicleId, setAlertVehicleId] = useState('');
  const [alertMsg, setAlertMsg] = useState('Alarm Jugendfeuerwehr! Sammelpunkt Gerätehaus.');

  const assignedVehicles = vehicles.filter((v) => v.assignedIncidentId === incident.id);
  const prio = incident.payload.prioritaet;

  return (
    <div
      className="card"
      style={{
        borderColor: selected ? 'var(--blue)' : prio === 'hoch' ? '#fca5a5' : 'var(--border)',
        cursor: 'pointer',
      }}
      onClick={onSelect}
    >
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 6 }}>
          <span className={`badge ${prio === 'hoch' ? 'red' : prio === 'normal' ? 'blue' : 'gray'}`}>{prio}</span>
          <span className="k">{incident.payload.was}</span>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <span className="badge gray">{incident.status}</span>
          <span className="small">{formatTime(incident.createdAt)}</span>
        </div>
      </div>
      <div className="small" style={{ marginTop: 4 }}>
        📍 {incident.payload.wo || '–'}{incident.payload.hinweise ? ` · ${incident.payload.hinweise}` : ''}
      </div>
      {assignedVehicles.length > 0 && (
        <div className="row" style={{ gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
          {assignedVehicles.map((v) => (
            <span key={v.id} className="badge red">
              {v.callsign}
            </span>
          ))}
        </div>
      )}

      {/* Actions – stop click propagation */}
      <div
        className="row"
        style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="btn"
          onClick={() =>
            onUpdate(incident.id, { status: incident.status === 'offen' ? 'übernommen' : 'offen' })
          }
        >
          {incident.status === 'offen' ? 'Übernehmen' : 'Zurück: offen'}
        </button>
        <button className="btn ok" onClick={() => onUpdate(incident.id, { status: 'beendet' })}>
          Beenden
        </button>
        <button className="btn primary" onClick={() => setShowAlert((v) => !v)}>
          + Fahrzeug alarmieren
        </button>
      </div>

      {showAlert && (
        <div
          className="card"
          style={{ marginTop: 8, borderColor: '#fde68a', background: '#fffbeb' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="k">Fahrzeug alarmieren</div>
          <label className="small">
            Fahrzeug
            <select
              className="select"
              value={alertVehicleId}
              onChange={(e) => setAlertVehicleId(e.target.value)}
            >
              <option value="">Fahrzeug wählen…</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.callsign} ({v.status})
                </option>
              ))}
            </select>
          </label>
          <label className="small" style={{ marginTop: 6 }}>
            Alarm-Nachricht
            <textarea
              className="textarea"
              value={alertMsg}
              onChange={(e) => setAlertMsg(e.target.value)}
            />
          </label>
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <button className="btn" onClick={() => setShowAlert(false)}>
              Abbrechen
            </button>
            <button
              className="btn primary"
              disabled={!alertVehicleId}
              onClick={() => {
                onAlertVehicle(alertVehicleId, incident.id, alertMsg);
                setShowAlert(false);
                setAlertVehicleId('');
              }}
            >
              Alarm auslösen
            </button>
          </div>

          {assignedVehicles.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div className="small k">Zugeteilte Fahrzeuge</div>
              {assignedVehicles.map((v) => (
                <div key={v.id} className="row" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <span className="badge red">{v.callsign}</span>
                  <span className="small">{v.status}</span>
                  <button className="btn" onClick={() => onVehicleStatus(v.id, 'rückmeldung', incident.id)}>
                    Rückmeldung
                  </button>
                  <button className="btn warn" onClick={() => onVehicleStatus(v.id, 'an der Einsatzstelle', incident.id)}>
                    E-Stelle
                  </button>
                  <button className="btn ok" onClick={() => onClearVehicle(v.id)}>
                    Frei
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Feedback Log ---
function FeedbackLog({ feedbackLog }) {
  if (!feedbackLog || feedbackLog.length === 0) {
    return <div className="small">Noch keine Rückmeldungen für diesen Einsatz.</div>;
  }
  return (
    <div className="grid" style={{ gap: 6, maxHeight: 280, overflowY: 'auto' }}>
      {[...feedbackLog].reverse().map((entry) => (
        <div key={entry.id} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
          <span className="small" style={{ minWidth: 50, color: 'var(--muted)' }}>
            {formatDateTime(entry.timestamp)}
          </span>
          <span className="badge gray">{entry.vehicleCallsign}</span>
          <span
            className={`badge ${
              entry.action === 'alarmiert'
                ? 'red'
                : entry.action === 'an der Einsatzstelle'
                ? 'blue'
                : entry.action === 'frei gemeldet'
                ? 'green'
                : 'gray'
            }`}
          >
            {entry.action}
          </span>
          {entry.message && <span className="small">{entry.message}</span>}
        </div>
      ))}
    </div>
  );
}

// --- Manual Feedback Entry ---
function ManualFeedbackEntry({ incident, vehicles, onAddFeedback }) {
  const [vehicleId, setVehicleId] = useState('');
  const [action, setAction] = useState('rückmeldung');
  const [message, setMessage] = useState('');

  function submit() {
    const v = vehicles.find((v) => v.id === vehicleId);
    onAddFeedback(incident.id, {
      vehicleId,
      vehicleCallsign: v?.callsign || vehicleId || 'Unbekannt',
      action,
      message,
    });
    setMessage('');
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div className="small k">Rückmeldung manuell eintragen</div>
      <div className="grid" style={{ gap: 6, marginTop: 6 }}>
        <select className="select" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
          <option value="">Fahrzeug wählen…</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.callsign}
            </option>
          ))}
        </select>
        <select className="select" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="rückmeldung">Rückmeldung</option>
          <option value="an der Einsatzstelle">An der Einsatzstelle</option>
          <option value="frei gemeldet">Frei gemeldet</option>
          <option value="sonstiges">Sonstiges</option>
        </select>
        <input
          className="input"
          placeholder="Nachricht (optional)…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button className="btn primary" onClick={submit} disabled={!vehicleId}>
          Eintragen
        </button>
      </div>
    </div>
  );
}

// --- Incident Wizard ---
function IncidentWizard({ onCreate, onAlarm }) {
  const [answers, setAnswers] = useState(() =>
    Object.fromEntries(defaultQuestions.map((q) => [q.key, q.type === 'switch' ? false : '']))
  );
  const [step, setStep] = useState(0);
  const [created, setCreated] = useState(null);
  const q = defaultQuestions[step];

  const canContinue = () => {
    if (!q.required) return true;
    const v = answers[q.key];
    return q.type === 'switch' ? true : String(v).trim().length > 0;
  };

  function createIncident() {
    const i = onCreate({ ...answers });
    setCreated(i);
    setStep(0);
    setAnswers(Object.fromEntries(defaultQuestions.map((q) => [q.key, q.type === 'switch' ? false : ''])));
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="small">
          Frage {step + 1} / {defaultQuestions.length}
        </div>
        <div className="small k">{Math.round(((step + 1) / defaultQuestions.length) * 100)}%</div>
      </div>
      <div
        style={{
          width: '100%',
          height: 8,
          background: '#eee',
          borderRadius: 999,
          overflow: 'hidden',
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: `${((step + 1) / defaultQuestions.length) * 100}%`,
            height: '100%',
            background: 'var(--red)',
          }}
        />
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <label className="k">
          {q.label} {q.required && <span style={{ color: 'var(--red)' }}>*</span>}
        </label>
        <Field question={q} value={answers[q.key]} onChange={(v) => setAnswers((a) => ({ ...a, [q.key]: v }))} />
      </div>

      <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
        <button className="btn" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          Zurück
        </button>
        {step < defaultQuestions.length - 1 ? (
          <button
            className="btn primary"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canContinue()}
          >
            Weiter
          </button>
        ) : (
          <button className="btn primary" onClick={createIncident} disabled={!canContinue()}>
            Einsatz anlegen
          </button>
        )}
      </div>

      {created && (
        <div className="card" style={{ marginTop: 12, borderColor: '#bbf7d0', background: '#f0fdf4' }}>
          <div className="k">✅ Einsatz angelegt!</div>
          <div className="small">
            {created.payload.was} · {created.payload.wo}
          </div>
          <button className="btn" style={{ marginTop: 8 }} onClick={() => { onAlarm(created); setCreated(null); }}>
            Zum Einsatz springen
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ question, value, onChange }) {
  if (question.type === 'text')
    return (
      <input
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Hier tippen…"
      />
    );
  if (question.type === 'textarea')
    return (
      <textarea
        className="textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Zusatzinfos…"
      />
    );
  if (question.type === 'number')
    return (
      <input
        className="input"
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
      />
    );
  if (question.type === 'switch')
    return (
      <label className="row small">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
        <span>Ja/Nein</span>
      </label>
    );
  if (question.type === 'select')
    return (
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Bitte wählen</option>
        {question.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  return null;
}
