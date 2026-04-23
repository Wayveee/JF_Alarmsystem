import React, { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { v4 as uuid } from 'uuid';

// --- helpers ---
const nowIso = () => new Date().toISOString();
const formatTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const timeAgo = (ts) => {
  if (!ts) return '–';
  const ms = Date.now() - new Date(ts).getTime();
  const m = Math.floor(ms/60000), s = Math.floor((ms%60000)/1000);
  return `${m}m ${s}s`;
};
const useTick = () => { const [, set] = useState(0); useEffect(()=>{ const t = setInterval(()=>set(v=>v+1),1000); return ()=>clearInterval(t); },[]); };

// Base64 sounds
const beepData = "data:audio/wav;base64,UklGRmQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQ4AAAABAQEBAP8AAP8AAP8AAP8A/wD/AAAAAP8A/wD/AAAAAP8A/wD/AAAAAP8A";
const chimeData = "data:audio/wav;base64,UklGRmQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQ4AAAABAQEAAP8A/wAAAP8A/wAAAP8A/wD/AAAAAP8A";

const defaultVehicles = [
  { id: uuid(), callsign: "JF-ELW 1", type: "ELW", notes: "Leitung", status: "frei", assignedIncidentId: null, lastChange: null },
  { id: uuid(), callsign: "JF-LF 10/6", type: "LF", notes: "Gruppe 1", status: "frei", assignedIncidentId: null, lastChange: null },
  { id: uuid(), callsign: "JF-TSF-W", type: "TSF-W", notes: "Gruppe 2", status: "frei", assignedIncidentId: null, lastChange: null },
  { id: uuid(), callsign: "JF-MTF", type: "MTF", notes: "Nachführung", status: "frei", assignedIncidentId: null, lastChange: null },
];

const defaultQuestions = [
  { key: "wo", label: "Wo ist es? (Ort/Adresse/Objekt)", type: "text", required: true },
  { key: "was", label: "Was ist passiert?", type: "select", required: true, options: [
    { value: "BMA", label: "Brandmeldeanlage" },
    { value: "FEU", label: "Feuer klein" },
    { value: "FEU-Mittel", label: "Feuer mittel" },
    { value: "THK", label: "Technische Hilfe klein" },
    { value: "THY", label: "Technische Hilfe – Person in Gefahr" },
    { value: "Öl", label: "Ölspur" },
    { value: "Sonstiges", label: "Sonstiges" },
  ]},
  { key: "wer", label: "Wer meldet? (Name/Telefon)", type: "text", required: false },
  { key: "wie", label: "Wie viele Betroffene?", type: "number", required: false },
  { key: "rueckfragen", label: "Rückfragen möglich?", type: "switch", required: false },
  { key: "prioritaet", label: "Priorität", type: "select", required: true, options: [
    { value: "niedrig", label: "Niedrig" },
    { value: "normal", label: "Normal" },
    { value: "hoch", label: "Hoch" },
  ]},
  { key: "hinweise", label: "Hinweise (Zufahrt, Besonderheiten)", type: "textarea", required: false },
];

const SERVER_URL = (import.meta.env.VITE_SERVER_URL || 'http://localhost:3000').replace(/\/$/, '');

const defaultSettings = {
  soundEnabled: true,
  volume: 0.8,
  tone: 'beep',    // 'beep' | 'chime' | 'custom'
  customTone: null,
  appInstallUrl: '' // Landing-Page oder Store-Link für den App-QR-Code
};

function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initialValue;
    } catch { return initialValue; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value]);
  return [value, setValue];
}

export default function App() {
  useTick();
  const [tab, setTab] = useLocalStorage("jf_tab", "einsatz");
  const [vehicles, setVehicles] = useLocalStorage("jf_vehicles", defaultVehicles);
  const [incidents, setIncidents] = useLocalStorage("jf_incidents", []);
  const [settings, setSettings] = useLocalStorage("jf_settings", defaultSettings);
  const [filter, setFilter] = useState("");
  const alarmAudioRef = useRef(null);

  const alertedVehicles = useMemo(() => vehicles.filter(v => v.status !== "frei"), [vehicles]);

  function addIncident(payload) {
    const id = uuid();
    const i = { id, createdAt: nowIso(), status: "offen", payload };
    setIncidents(prev => [i, ...prev]);
    return i;
  }
  function updateIncident(id, patch) {
    setIncidents(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
  }
  function addVehicle(callsign, type, notes) {
    setVehicles(prev => [{ id: uuid(), callsign, type, notes, status: "frei", assignedIncidentId: null, lastChange: nowIso() }, ...prev]);
  }
  function editVehicle(id, patch) {
    setVehicles(prev => prev.map(v => v.id === id ? { ...v, ...patch } : v));
  }
  function removeVehicle(id) { setVehicles(prev => prev.filter(v => v.id !== id)); }

  function getToneSrc() {
    if (settings.tone === 'custom' && settings.customTone) return settings.customTone;
    if (settings.tone === 'chime') return chimeData;
    return beepData;
  }

  async function alertVehicle(id, incidentId, message = "Alarm Jugendfeuerwehr!") {
    editVehicle(id, { status: "alarmiert", assignedIncidentId: incidentId, lastChange: nowIso(), msg: message });
    // Sound
    try {
      if (settings.soundEnabled && alarmAudioRef.current) {
        alarmAudioRef.current.pause();
        alarmAudioRef.current.currentTime = 0;
        alarmAudioRef.current.volume = Math.min(Math.max(settings.volume, 0), 1);
        alarmAudioRef.current.play();
      }
    } catch {}
    // Push an Alarm-Server (lokal)
    try {
      await fetch(`${SERVER_URL}/alarm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'JF Alarm',
          body: `${vehicles.find(v=>v.id===id)?.callsign || 'Fahrzeug'} alarmiert – ${message}`,
          data: { vehicleId: id, incidentId }
        })
      });
    } catch (e) { console.warn('Push fehlgeschlagen', e); }
  }

  function clearVehicle(id) { editVehicle(id, { status: "frei", assignedIncidentId: null, lastChange: nowIso(), msg: null }); }
  function setVehicleStatus(id, status) { editVehicle(id, { status, lastChange: nowIso() }); }

  function exportAll() {
    const blob = new Blob([JSON.stringify({ vehicles, incidents, settings }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `leitstelle_export_${new Date().toISOString().slice(0,19)}.json`;
    a.click(); URL.revokeObjectURL(url);
  }
  function importAll(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (data.vehicles && data.incidents) {
          setVehicles(data.vehicles); setIncidents(data.incidents);
          if (data.settings) setSettings(data.settings);
        } else alert("Ungültige Datei");
      } catch { alert("Konnte Datei nicht lesen"); }
    };
    r.readAsText(file);
  }

  return (
    <>
      <audio ref={alarmAudioRef} src={getToneSrc()} preload="auto" />
      <div className="header">
        <div className="header-inner container">
          <div className="brand">
            <div className="logo">🚒</div>
            <div>
              <div className="k">Leitstelle – Jugendfeuerwehr</div>
              <div className="small">Einsätze · Fahrzeuge · Alarmiert · Setup</div>
            </div>
          </div>
          <div className="row">
            <button className="btn" onClick={exportAll}>Export</button>
            <label className="btn">
              Import
              <input type="file" accept="application/json" style={{ display:'none' }} onChange={e=> e.target.files?.[0] && importAll(e.target.files[0])} />
            </label>
          </div>
        </div>
        <div className="container">
          <div className="tabs">
            {['einsatz','fahrzeuge','alarmiert','setup'].map(t => (
              <div key={t} className={`tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>{t[0].toUpperCase()+t.slice(1)}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="container" style={{ marginTop: 16 }}>
        {tab==='einsatz' && (
          <div className="grid grid-2">
            <div className="card">
              <h3>Neuen Einsatz anlegen</h3>
              <div className="small">Kurzer Fragenkatalog – wie in der Leitstelle.</div>
              <div className="hr"></div>
              <IncidentWizard onCreate={addIncident} />
            </div>
            <div className="card">
              <h3>Offene Einsätze</h3>
              <div className="small">Wähle einen Einsatz, um Fahrzeuge zu alarmieren.</div>
              <div className="hr"></div>
              <IncidentList incidents={incidents} onUpdate={updateIncident} />
            </div>
          </div>
        )}

        {tab==='fahrzeuge' && (
          <VehicleManager
            vehicles={vehicles}
            incidents={incidents}
            onAdd={addVehicle}
            onRemove={removeVehicle}
            onEdit={editVehicle}
            onAlert={alertVehicle}
            filter={filter}
            setFilter={setFilter}
          />
        )}

        {tab==='alarmiert' && (
          <AlertedBoard
            vehicles={alertedVehicles}
            incidents={incidents}
            onClear={clearVehicle}
            onStatus={setVehicleStatus}
          />
        )}

        {tab==='setup' && (
          <SetupWizard
            vehicles={vehicles}
            incidents={incidents}
            onAddVehicle={addVehicle}
            onRemoveVehicle={removeVehicle}
            onEditVehicle={editVehicle}
            settings={settings}
            setSettings={setSettings}
          />
        )}
      </div>

      <div className="footer">Made for Jugendfeuerwehr – speichert lokal (LocalStorage)</div>
    </>
  );
}

// --- Incident Wizard ---
function IncidentWizard({ onCreate }) {
  const [answers, setAnswers] = useState(() => Object.fromEntries(defaultQuestions.map(q => [q.key, q.type==='switch'? false : '' ])));
  const [step, setStep] = useState(0);
  const [created, setCreated] = useState(null);
  const q = defaultQuestions[step];

  const canContinue = () => {
    if (!q.required) return true;
    const v = answers[q.key];
    return q.type === 'switch' ? true : String(v).trim().length > 0;
  };

  function createIncident(){ const i = onCreate({ ...answers }); setCreated(i); }

  return (
    <div>
      <div className="row" style={{ justifyContent:'space-between', marginBottom:8 }}>
        <div className="small">Frage {step+1} / {defaultQuestions.length}</div>
        <div className="small k">{Math.round(((step+1)/defaultQuestions.length)*100)}%</div>
      </div>
      <div style={{ width:'100%', height:8, background:'#eee', borderRadius:999, overflow:'hidden', marginBottom:12 }}>
        <div style={{ width:`${(step+1)/defaultQuestions.length*100}%`, height:'100%', background:'var(--red)' }} />
      </div>

      <div style={{ display:'grid', gap:8 }}>
        <label className="k">{q.label} {q.required && <span style={{ color:'var(--red)'}}>*</span>}</label>
        <Field question={q} value={answers[q.key]} onChange={v => setAnswers(a => ({ ...a, [q.key]: v }))} />
      </div>

      <div className="row" style={{ justifyContent:'space-between', marginTop:12 }}>
        <button className="btn" onClick={()=> setStep(s => Math.max(0, s-1))} disabled={step===0}>Zurück</button>
        {step < defaultQuestions.length - 1 ? (
          <button className="btn primary" onClick={()=> setStep(s => s+1)} disabled={!canContinue()}>Weiter</button>
        ) : (
          <button className="btn primary" onClick={createIncident} disabled={!canContinue()}>Einsatz anlegen</button>
        )}
      </div>

      {created && (
        <div className="card" style={{ marginTop:12, borderColor:'#bbf7d0', background:'#f0fdf4' }}>
          <div className="k">Einsatz angelegt!</div>
          <div className="small">{created.id.slice(0,8)} · {formatTime(created.createdAt)} · {created.payload.was || "–"} in {created.payload.wo || "–"}</div>
        </div>
      )}
    </div>
  );
}

function Field({ question, value, onChange }) {
  if (question.type === 'text') return <input className="input" value={value} onChange={e=>onChange(e.target.value)} placeholder="Hier tippen…" />;
  if (question.type === 'textarea') return <textarea className="textarea" value={value} onChange={e=>onChange(e.target.value)} placeholder="Zusatzinfos…" />;
  if (question.type === 'number') return <input className="input" type="number" value={value} onChange={e=>onChange(e.target.value)} placeholder="0" />;
  if (question.type === 'switch') return (
    <label className="row small">
      <input type="checkbox" checked={!!value} onChange={e=>onChange(e.target.checked)} /> <span>Ja/Nein</span>
    </label>
  );
  if (question.type === 'select') return (
    <select className="select" value={value} onChange={e=>onChange(e.target.value)}>
      <option value="">Bitte wählen</option>
      {question.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
  return null;
}

// --- Incident List ---
function IncidentList({ incidents, onUpdate }){
  if (!incidents.length) return <div className="small">Keine Einsätze angelegt – leg links einen an.</div>;
  return (
    <div className="grid">
      {incidents.map(inc => (
        <div key={inc.id} className="card">
          <div className="row" style={{ justifyContent:'space-between' }}>
            <div className="row" style={{ gap:8 }}>
              <span className={`badge ${inc.payload.prioritaet==='hoch'?'red':inc.payload.prioritaet==='normal'?'blue':'gray'}`}>
                {inc.payload.prioritaet || '–'}
              </span>
              <div className="k">{inc.payload.was || "Unbekannt"} <span className="small">· {inc.payload.wo || "–"}</span></div>
            </div>
            <div className="small">{formatTime(inc.createdAt)}</div>
          </div>
          <div className="small" style={{ marginTop:6 }}>{inc.payload.hinweise}</div>
          <div className="row" style={{ justifyContent:'flex-end', gap:8, marginTop:8 }}>
            <span className="badge gray">{inc.status}</span>
            <button className="btn" onClick={()=>onUpdate(inc.id, { status: inc.status==='offen' ? 'übernommen' : 'offen' })}>
              {inc.status==='offen' ? 'Übernehmen' : 'Zurück auf offen'}
            </button>
            <button className="btn ok" onClick={()=>onUpdate(inc.id, { status:'beendet' })}>Beenden</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Vehicle Manager ---
function VehicleManager({ vehicles, incidents, onAdd, onRemove, onEdit, onAlert, filter, setFilter }) {
  const [form, setForm] = useState({ callsign: "", type: "LF", notes: "" });
  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return vehicles;
    return vehicles.filter(v =>
      v.callsign.toLowerCase().includes(f) ||
      v.type.toLowerCase().includes(f) ||
      (v.notes||"").toLowerCase().includes(f)
    );
  }, [vehicles, filter]);

  function submitAdd(e) {
    e.preventDefault();
    if (!form.callsign.trim()) return;
    onAdd(form.callsign.trim(), form.type.trim(), form.notes.trim());
    setForm({ callsign:"", type: form.type, notes:"" });
  }

  const [alertVehicleId, setAlertVehicleId] = useState(null);
  const [alertIncident, setAlertIncident] = useState('');
  const [alertMsg, setAlertMsg] = useState('Alarm Jugendfeuerwehr! Sammelpunkt Gerätehaus.');

  return (
    <div className="grid grid-2">
      <div className="card">
        <h3>Fahrzeug hinzufügen</h3>
        <div className="small">ELW, LF, TSF-W, MTF, …</div>
        <div className="hr"></div>
        <form onSubmit={submitAdd} className="grid">
          <label>Rufname<input className="input" value={form.callsign} onChange={e=>setForm({ ...form, callsign:e.target.value })} placeholder="z. B. JF-LF 10/6" /></label>
          <label>Typ<input className="input" value={form.type} onChange={e=>setForm({ ...form, type:e.target.value })} placeholder="LF / ELW / MTF …" /></label>
          <label>Notizen<input className="input" value={form.notes} onChange={e=>setForm({ ...form, notes:e.target.value })} placeholder="Gruppe / Aufgabe" /></label>
          <button className="btn primary" type="submit">Hinzufügen</button>
        </form>
      </div>
      <div className="card">
        <div className="row" style={{ justifyContent:'space-between' }}>
          <div>
            <h3>Fahrzeugliste</h3>
            <div className="small">Einzeln alarmieren und Status pflegen.</div>
          </div>
          <input className="input" style={{ maxWidth:280 }} placeholder="Suchen…" value={filter} onChange={e=>setFilter(e.target.value)} />
        </div>
        <div className="grid grid-2" style={{ marginTop:12 }}>
          {filtered.map(v => (
            <div key={v.id} className="card">
              <div className="row" style={{ justifyContent:'space-between' }}>
                <div className="k">{v.callsign}</div>
                <span className={`badge ${v.status!=='frei'?'red':'gray'}`}>{v.status}</span>
              </div>
              <div className="small">{v.type} · {v.notes}</div>
              <div className="row" style={{ gap:8, marginTop:8 }}>
                <button className="btn primary" onClick={()=> setAlertVehicleId(v.id)}>Alarmieren</button>
                <button className="btn" onClick={()=> onEdit(v.id, { status: v.status==='frei' ? 'einsatzbereit' : 'frei', lastChange: nowIso() })}>
                  {v.status==='frei' ? 'als einsatzbereit' : 'auf frei'}
                </button>
                <button className="btn ghost" onClick={()=> onRemove(v.id)}>Löschen</button>
              </div>

              {alertVehicleId===v.id && (
                <div className="card" style={{ marginTop:8, borderColor:'#fde68a', background:'#fffbeb' }}>
                  <div className="k">Alarm für {v.callsign}</div>
                  <label className="small">Einsatz
                    <select className="select" value={alertIncident} onChange={e=>setAlertIncident(e.target.value)}>
                      <option value="">Einsatz wählen</option>
                      {incidents.map(i => (
                        <option key={i.id} value={i.id}>
                          {(i.payload.was||'–')} · {(i.payload.wo||'–')} ({i.payload.prioritaet||'–'})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="small">Nachricht
                    <textarea className="textarea" value={alertMsg} onChange={e=>setAlertMsg(e.target.value)} />
                  </label>
                  <div className="row" style={{ gap:8 }}>
                    <button className="btn" onClick={()=> setAlertVehicleId(null)}>Abbrechen</button>
                    <button className="btn primary" onClick={()=> { if(alertIncident){ onAlert(v.id, alertIncident, alertMsg); setAlertVehicleId(null); }}}>Alarm auslösen</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Alerted Board ---
function AlertedBoard({ vehicles, incidents, onClear, onStatus }) {
  const byIncident = useMemo(() => {
    const map = new Map();
    vehicles.forEach(v => {
      const id = v.assignedIncidentId || 'ohne';
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(v);
    });
    return map;
  }, [vehicles]);

  function findIncident(id){ return incidents.find(i => i.id === id); }
  if (!vehicles.length) return <div className="small">Aktuell ist kein Fahrzeug alarmiert.</div>;

  return (
    <div className="grid">
      {[...byIncident.entries()].map(([incidentId, list]) => {
        const inc = findIncident(incidentId);
        return (
          <div key={incidentId} className="card" style={{ borderColor:'#fde68a' }}>
            <div className="row" style={{ gap:8 }}>
              {inc ? (
                <>
                  <span className={`badge ${inc.payload.prioritaet==='hoch'?'red':inc.payload.prioritaet==='normal'?'blue':'gray'}`}>{inc.payload.prioritaet}</span>
                  <div className="k">{inc.payload.was}</div>
                  <div className="small">· {inc.payload.wo}</div>
                </>
              ) : (
                <>
                  <span className="badge gray">ohne Einsatz</span><div className="k">Manuelle Alarmierung</div>
                </>
              )}
            </div>
            <div className="small" style={{ marginTop:6 }}>{inc ? inc.payload.hinweise : '—'}</div>

            <div className="grid grid-3" style={{ marginTop:12 }}>
              {list.map(v => (
                <div key={v.id} className="card">
                  <div className="row" style={{ justifyContent:'space-between' }}>
                    <div className="k">{v.callsign}</div>
                    <span className="badge red">{v.status}</span>
                  </div>
                  <div className="small">seit {timeAgo(v.lastChange)}</div>
                  <div className="row" style={{ gap:8, marginTop:8 }}>
                    <button className="btn" onClick={()=> onStatus(v.id, 'rückmeldung')}>Rückmeldung</button>
                    <button className="btn warn" onClick={()=> onStatus(v.id, 'an der Einsatzstelle')}>an der E-Stelle</button>
                    <button className="btn ok" onClick={()=> onClear(v.id)}>frei</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Setup Wizard (Fahrzeuge, Fragen, Sound, App/QR) ---
function SetupWizard({ vehicles, incidents, onAddVehicle, onRemoveVehicle, onEditVehicle, settings, setSettings }) {
  const [page, setPage] = useLocalStorage('jf_setup_page', 0);

  return (
    <div className="card">
      <h3>Setup</h3>
      <div className="small">Richte Fahrzeuge, Fragen, Sounds und die App-Installation ein.</div>
      <div className="hr"></div>

      <div className="row" style={{ gap:6, marginBottom:8 }}>
        {['Fahrzeuge','Fragen','Sound','App'].map((p, i) => (
          <button key={p} className={`btn ${page===i?'primary':''}`} onClick={()=>setPage(i)}>{i+1}. {p}</button>
        ))}
        <div className="small" style={{ marginLeft:'auto' }}>Seite {page+1} von 4</div>
      </div>

      {page===0 && (
        <VehicleManager
          vehicles={vehicles}
          incidents={incidents}
          onAdd={onAddVehicle}
          onRemove={onRemoveVehicle}
          onEdit={onEditVehicle}
          onAlert={()=>{}}
          filter={''}
          setFilter={()=>{}}
        />
      )}
      {page===1 && <QuestionEditor />}
      {page===2 && <SoundSettings settings={settings} setSettings={setSettings} />}
      {page===3 && <AppInstall settings={settings} setSettings={setSettings} />}

      <div className="row" style={{ justifyContent:'space-between', marginTop:12 }}>
        <button className="btn" onClick={()=> setPage(Math.max(0, page-1))} disabled={page===0}>Zurück</button>
        <button className="btn primary" onClick={()=> setPage(Math.min(3, page+1))} disabled={page===3}>Weiter</button>
      </div>
    </div>
  );
}

function QuestionEditor(){
  return (
    <div className="card">
      <div className="k">Fragenkatalog (derzeit fest im Code)</div>
      <ul className="small">
        {defaultQuestions.map(q => (
          <li key={q.key} style={{ marginTop:4 }}>{q.label} <span style={{ color:'#6b7280' }}>({q.type}{q.required? ', *':''})</span></li>
        ))}
      </ul>
      <div className="small" style={{ marginTop:8 }}>Sag Bescheid, wenn du das live editierbar willst (Labels/Typen/Optionen).</div>
    </div>
  );
}

function SoundSettings({ settings, setSettings }) {
  function onFile(e){
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => setSettings({ ...settings, tone: 'custom', customTone: r.result });
    r.readAsDataURL(f);
  }
  return (
    <div className="grid grid-2">
      <div className="card">
        <div className="k">Alarm-Sound</div>
        <div className="small">Ton, Lautstärke und Test.</div>
        <div className="hr"></div>
        <div className="row" style={{ justifyContent:'space-between' }}>
          <div className="small k">Sound aktiv</div>
          <input type="checkbox" checked={settings.soundEnabled} onChange={e=> setSettings({ ...settings, soundEnabled: e.target.checked })} />
        </div>
        <div style={{ marginTop:8 }}>
          <div className="small k">Lautstärke: {Math.round(settings.volume*100)}%</div>
          <input type="range" min={0} max={1} step={0.01} value={settings.volume} onChange={e=> setSettings({ ...settings, volume: parseFloat(e.target.value) })} style={{ width:'100%' }} />
        </div>
        <div style={{ marginTop:8 }}>
          <div className="small k">Tonart</div>
          <div className="row" style={{ gap:6, marginTop:6 }}>
            {['beep','chime','custom'].map(t => (
              <button key={t} className={`btn ${settings.tone===t?'primary':''}`} onClick={()=> setSettings({ ...settings, tone: t })}>
                {t}
              </button>
            ))}
          </div>
          {settings.tone==='custom' && (
            <div style={{ marginTop:8 }}>
              <div className="small k">Eigenen Ton hochladen (WAV/MP3)</div>
              <input type="file" accept="audio/*" onChange={onFile} />
            </div>
          )}
        </div>
        <div className="row" style={{ gap:8, marginTop:8 }}>
          <button className="btn" onClick={()=>{ const a = new Audio(settings.tone==='custom' && settings.customTone ? settings.customTone : (settings.tone==='chime'? chimeData : beepData)); a.volume = settings.volume; a.play(); }}>Test abspielen</button>
          <button className="btn" onClick={()=> setSettings(defaultSettings)}>Standard</button>
        </div>
      </div>

      <div className="card">
        <div className="k">Daten & Zurücksetzen</div>
        <div className="hr"></div>
        <button className="btn" onClick={()=>{ localStorage.clear(); location.reload(); }} style={{ borderColor:'var(--red)', color:'var(--red)' }}>
          Alles zurücksetzen (LocalStorage leeren)
        </button>
        <div className="small" style={{ marginTop:8 }}>Hinweis: Export/Import im Header kann deine Konfiguration sichern.</div>
      </div>
    </div>
  );
}

function AppInstall({ settings, setSettings }) {
  const [url, setUrl] = useState(settings.appInstallUrl || '');
  async function copy(){ try{ await navigator.clipboard.writeText(url.trim()); } catch { alert('Kopieren fehlgeschlagen'); } }
  function save(){ setSettings({ ...settings, appInstallUrl: url.trim() }); }
  return (
    <div className="grid grid-2">
      <div className="card">
        <div className="k">App-Installation (Link)</div>
        <div className="small">Hinterlege hier den Installations-/Store-Link oder eure Landing-Page.</div>
        <div className="hr"></div>
        <input className="input" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://…" />
        <div className="row" style={{ gap:8, marginTop:8 }}>
          <button className="btn primary" onClick={save}>Speichern</button>
          <button className="btn" onClick={copy}>Link kopieren</button>
        </div>
        {settings.appInstallUrl && settings.appInstallUrl!==url && (
          <div className="small" style={{ marginTop:8 }}>Gespeicherter Link: {settings.appInstallUrl}</div>
        )}
      </div>
      <div className="card center" style={{ flexDirection:'column', gap:12 }}>
        <div className="k">QR-Code</div>
        {url?.trim()
          ? <div style={{ padding:16, background:'#fff', border:'1px solid var(--border)', borderRadius:12 }}>
              <QRCodeSVG value={url.trim()} size={220} includeMargin />
            </div>
          : <div className="small">Bitte oben eine gültige URL eintragen und speichern.</div>
        }
      </div>
    </div>
  );
}
