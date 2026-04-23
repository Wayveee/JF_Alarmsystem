import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useStore, VEHICLE_TYPES, defaultSettings, nowIso } from '../store.js';

const beepData =
  'data:audio/wav;base64,UklGRmQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQ4AAAABAQEBAP8AAP8AAP8AAP8A/wD/AAAAAP8A/wD/AAAAAP8A/wD/AAAAAP8A';
const chimeData =
  'data:audio/wav;base64,UklGRmQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQ4AAAABAQEAAP8A/wAAAP8A/wAAAP8A/wD/AAAAAP8A';

const SETUP_PAGES = ['Fahrzeuge', 'Karte', 'Sound', 'App/QR', 'Daten'];

export default function Setup() {
  const store = useStore();
  const { vehicles, incidents, settings, setSettings, addVehicle, editVehicle, removeVehicle, resetAll, exportAll, importAll } = store;
  const [page, setPage] = useState(0);

  return (
    <div className="setup-root">
      <div className="setup-header">
        <div className="row" style={{ gap: 10 }}>
          <div className="logo">⚙</div>
          <div>
            <div className="k">Setup / Admin</div>
            <div className="small">Jugendfeuerwehr Alarmsystem</div>
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <a className="btn" href="/">← Leitstelle</a>
          <a className="btn" href="/display" target="_blank" rel="noreferrer">🖥 Display</a>
        </div>
      </div>

      <div className="setup-nav">
        {SETUP_PAGES.map((p, i) => (
          <button key={p} className={`tab ${page === i ? 'active' : ''}`} onClick={() => setPage(i)}>
            {i + 1}. {p}
          </button>
        ))}
      </div>

      <div className="setup-content">
        {page === 0 && (
          <VehicleAdmin
            vehicles={vehicles}
            onAdd={addVehicle}
            onEdit={editVehicle}
            onRemove={removeVehicle}
          />
        )}
        {page === 1 && <MapConfig settings={settings} setSettings={setSettings} />}
        {page === 2 && <SoundSettings settings={settings} setSettings={setSettings} />}
        {page === 3 && <AppInstall settings={settings} setSettings={setSettings} />}
        {page === 4 && (
          <DataAdmin
            onExport={exportAll}
            onImport={importAll}
            onReset={resetAll}
            vehicles={vehicles}
            incidents={incidents}
          />
        )}
      </div>
    </div>
  );
}

// --- Vehicle Admin ---
function VehicleAdmin({ vehicles, onAdd, onEdit, onRemove }) {
  const [form, setForm] = useState({ callsign: '', type: 'LF', notes: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  function submit(e) {
    e.preventDefault();
    if (!form.callsign.trim()) return;
    onAdd(form.callsign.trim(), form.type.trim(), form.notes.trim());
    setForm({ callsign: '', type: form.type, notes: '' });
  }

  function startEdit(v) {
    setEditingId(v.id);
    setEditForm({ callsign: v.callsign, type: v.type, notes: v.notes });
  }

  function saveEdit(id) {
    onEdit(id, { callsign: editForm.callsign, type: editForm.type, notes: editForm.notes, lastChange: nowIso() });
    setEditingId(null);
  }

  return (
    <div className="grid grid-2">
      <div className="card">
        <h3>Fahrzeug hinzufügen</h3>
        <form onSubmit={submit} className="grid" style={{ gap: 8 }}>
          <label>
            Rufname
            <input
              className="input"
              value={form.callsign}
              onChange={(e) => setForm({ ...form, callsign: e.target.value })}
              placeholder="z. B. JF-LF 10/6"
            />
          </label>
          <label>
            Typ
            <select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {VEHICLE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Notizen
            <input
              className="input"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Gruppe / Aufgabe"
            />
          </label>
          <button className="btn primary" type="submit">Hinzufügen</button>
        </form>
      </div>

      <div className="card">
        <h3>Fahrzeugliste ({vehicles.length})</h3>
        {vehicles.length === 0 && <div className="small">Noch keine Fahrzeuge angelegt.</div>}
        <div className="grid" style={{ gap: 8, marginTop: 8 }}>
          {vehicles.map((v) =>
            editingId === v.id ? (
              <div key={v.id} className="card" style={{ borderColor: 'var(--blue)' }}>
                <input
                  className="input"
                  value={editForm.callsign}
                  onChange={(e) => setEditForm({ ...editForm, callsign: e.target.value })}
                />
                <select
                  className="select"
                  style={{ marginTop: 6 }}
                  value={editForm.type}
                  onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                >
                  {VEHICLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input
                  className="input"
                  style={{ marginTop: 6 }}
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder="Notizen"
                />
                <div className="row" style={{ gap: 8, marginTop: 8 }}>
                  <button className="btn ok" onClick={() => saveEdit(v.id)}>Speichern</button>
                  <button className="btn" onClick={() => setEditingId(null)}>Abbrechen</button>
                </div>
              </div>
            ) : (
              <div key={v.id} className="card">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <span className="k">{v.callsign}</span>
                    <span className="small" style={{ marginLeft: 8 }}>{v.type} · {v.notes}</span>
                  </div>
                  <span className={`badge ${v.status !== 'frei' ? 'red' : 'gray'}`}>{v.status}</span>
                </div>
                <div className="row" style={{ gap: 6, marginTop: 8 }}>
                  <button className="btn" onClick={() => startEdit(v)}>Bearbeiten</button>
                  <button className="btn ghost" style={{ color: 'var(--red)' }} onClick={() => onRemove(v.id)}>
                    Löschen
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// --- Map Config ---
function MapConfig({ settings, setSettings }) {
  const [lat, setLat] = useState(String(settings.mapLat ?? 51.1657));
  const [lng, setLng] = useState(String(settings.mapLng ?? 10.4515));
  const [zoom, setZoom] = useState(String(settings.mapZoom ?? 13));
  const [areaName, setAreaName] = useState(settings.mapAreaName ?? '');

  function save() {
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    const parsedZoom = parseInt(zoom, 10);
    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      alert('Bitte gültige Koordinaten eingeben (z. B. 48.1374).');
      return;
    }
    setSettings({
      ...settings,
      mapLat: parsedLat,
      mapLng: parsedLng,
      mapZoom: isNaN(parsedZoom) ? 13 : parsedZoom,
      mapAreaName: areaName.trim(),
    });
    alert('Kartenkonfiguration gespeichert!');
  }

  return (
    <div className="grid grid-2">
      <div className="card">
        <h3>Einsatzgebiet konfigurieren</h3>
        <div className="small">
          Diese Koordinaten bestimmen den Mittelpunkt der Karte auf der Leitstellenseite.
        </div>
        <div className="hr" />
        <div className="grid" style={{ gap: 8 }}>
          <label>
            Gebietsname
            <input
              className="input"
              value={areaName}
              onChange={(e) => setAreaName(e.target.value)}
              placeholder="z. B. Stadtgebiet Musterstadt"
            />
          </label>
          <label>
            Breitengrad (Latitude)
            <input
              className="input"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="z. B. 48.1374"
            />
          </label>
          <label>
            Längengrad (Longitude)
            <input
              className="input"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="z. B. 11.5755"
            />
          </label>
          <label>
            Zoom-Stufe (1–18)
            <input
              className="input"
              type="number"
              min="1"
              max="18"
              value={zoom}
              onChange={(e) => setZoom(e.target.value)}
              placeholder="13"
            />
          </label>
          <button className="btn primary" onClick={save}>Speichern</button>
        </div>
        <div className="small" style={{ marginTop: 12 }}>
          💡 Tipp: Öffne{' '}
          <a href="https://www.openstreetmap.org" target="_blank" rel="noreferrer">
            openstreetmap.org
          </a>
          , navigiere zu deinem Einsatzgebiet und entnimm die Koordinaten aus der URL
          (z. B. #map=13/48.1374/11.5755).
        </div>
      </div>
      <div className="card">
        <h3>Aktuelle Einstellungen</h3>
        <table className="small" style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            {[
              ['Gebietsname', settings.mapAreaName || '–'],
              ['Breitengrad', settings.mapLat ?? '–'],
              ['Längengrad', settings.mapLng ?? '–'],
              ['Zoom', settings.mapZoom ?? '–'],
            ].map(([k, v]) => (
              <tr key={k}>
                <td style={{ padding: '4px 8px 4px 0', color: 'var(--muted)' }}>{k}</td>
                <td style={{ padding: '4px 0', fontWeight: 600 }}>{String(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Sound Settings ---
function SoundSettings({ settings, setSettings }) {
  function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setSettings({ ...settings, tone: 'custom', customTone: r.result });
    r.readAsDataURL(f);
  }

  function getToneSrc() {
    if (settings.tone === 'custom' && settings.customTone) return settings.customTone;
    if (settings.tone === 'chime') return chimeData;
    return beepData;
  }

  return (
    <div className="grid grid-2">
      <div className="card">
        <h3>Alarm-Sound</h3>
        <div className="hr" />
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="small k">Sound aktiv</div>
          <input
            type="checkbox"
            checked={settings.soundEnabled}
            onChange={(e) => setSettings({ ...settings, soundEnabled: e.target.checked })}
          />
        </div>
        <div style={{ marginTop: 8 }}>
          <div className="small k">Lautstärke: {Math.round(settings.volume * 100)}%</div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={settings.volume}
            onChange={(e) => setSettings({ ...settings, volume: parseFloat(e.target.value) })}
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ marginTop: 8 }}>
          <div className="small k">Tonart</div>
          <div className="row" style={{ gap: 6, marginTop: 6 }}>
            {['beep', 'chime', 'custom'].map((t) => (
              <button
                key={t}
                className={`btn ${settings.tone === t ? 'primary' : ''}`}
                onClick={() => setSettings({ ...settings, tone: t })}
              >
                {t}
              </button>
            ))}
          </div>
          {settings.tone === 'custom' && (
            <div style={{ marginTop: 8 }}>
              <div className="small k">Eigenen Ton hochladen (WAV/MP3)</div>
              <input type="file" accept="audio/*" onChange={onFile} />
            </div>
          )}
        </div>
        <div className="row" style={{ gap: 8, marginTop: 12 }}>
          <button
            className="btn"
            onClick={() => {
              const a = new Audio(getToneSrc());
              a.volume = settings.volume;
              a.play();
            }}
          >
            Test abspielen
          </button>
          <button className="btn" onClick={() => setSettings(defaultSettings)}>Standard wiederherstellen</button>
        </div>
      </div>
      <div className="card">
        <h3>Sound-Hinweis</h3>
        <div className="small">
          Der Alarm-Sound wird auf der Leitstellenseite beim Alarmieren eines Fahrzeugs abgespielt.
          Das Alarmierungsdisplay (/display) spielt keinen Sound ab.
        </div>
      </div>
    </div>
  );
}

// --- App Install ---
function AppInstall({ settings, setSettings }) {
  const [url, setUrl] = useState(settings.appInstallUrl || '');

  async function copy() {
    try {
      await navigator.clipboard.writeText(url.trim());
    } catch {
      alert('Kopieren fehlgeschlagen');
    }
  }

  function save() {
    setSettings({ ...settings, appInstallUrl: url.trim() });
  }

  return (
    <div className="grid grid-2">
      <div className="card">
        <h3>App-Installation (Link)</h3>
        <div className="small">Hinterlege hier den Installations-/Store-Link oder eure Landing-Page.</div>
        <div className="hr" />
        <input
          className="input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
        />
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button className="btn primary" onClick={save}>Speichern</button>
          <button className="btn" onClick={copy}>Link kopieren</button>
        </div>
        {settings.appInstallUrl && settings.appInstallUrl !== url && (
          <div className="small" style={{ marginTop: 8 }}>Gespeichert: {settings.appInstallUrl}</div>
        )}
      </div>
      <div className="card center" style={{ flexDirection: 'column', gap: 12 }}>
        <div className="k">QR-Code</div>
        {url?.trim() ? (
          <div style={{ padding: 16, background: '#fff', border: '1px solid var(--border)', borderRadius: 12 }}>
            <QRCodeSVG value={url.trim()} size={220} includeMargin />
          </div>
        ) : (
          <div className="small">Bitte oben eine gültige URL eintragen und speichern.</div>
        )}
      </div>
    </div>
  );
}

// --- Data Admin ---
function DataAdmin({ onExport, onImport, onReset, vehicles, incidents }) {
  return (
    <div className="grid grid-2">
      <div className="card">
        <h3>Daten exportieren / importieren</h3>
        <div className="small">Sichere die Konfiguration als JSON-Datei oder stelle sie wieder her.</div>
        <div className="hr" />
        <div className="row" style={{ gap: 8 }}>
          <button className="btn primary" onClick={onExport}>Export JSON</button>
          <label className="btn" style={{ cursor: 'pointer' }}>
            Import JSON
            <input
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
            />
          </label>
        </div>
      </div>
      <div className="card">
        <h3>Statistik</h3>
        <table className="small" style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            {[
              ['Fahrzeuge gesamt', vehicles.length],
              ['Davon alarmiert', vehicles.filter((v) => v.status !== 'frei').length],
              ['Einsätze gesamt', incidents.length],
              ['Einsätze aktiv', incidents.filter((i) => i.status !== 'beendet').length],
            ].map(([k, v]) => (
              <tr key={k}>
                <td style={{ padding: '4px 8px 4px 0', color: 'var(--muted)' }}>{k}</td>
                <td style={{ fontWeight: 600 }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="hr" />
        <button
          className="btn"
          style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
          onClick={() => {
            if (confirm('Alle Daten wirklich löschen? Dies kann nicht rückgängig gemacht werden.')) {
              onReset();
            }
          }}
        >
          ⚠ Alles zurücksetzen (LocalStorage leeren)
        </button>
      </div>
    </div>
  );
}
