import { useEffect, useRef, useState } from "react";
import { FolderOpen, Save, X } from "lucide-react";
import { isDesktopRuntime, openRecordingsFolder, saveSettings } from "./bridge";
import { iniValue, setIniValue } from "./setupIni";
import type { AppSettings } from "./types";

export default function SetupDialog({ settings, archivePath, onSaved, onClose }: {
  settings: AppSettings | null; archivePath: string;
  onSaved: (settings: AppSettings) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [contents, setContents] = useState(settings?.iniContents ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const da = settings?.language !== "en";
  useEffect(() => { dialog.current?.showModal(); }, []);
  const field = (section: string, key: string, label: string, type = "text") => <label className="field"><span>{label}</span><input type={type} value={iniValue(contents, section, key)} onChange={(e) => setContents(setIniValue(contents, section, key, e.target.value))} disabled={busy || !settings} /></label>;
  async function save() {
    setBusy(true); setError("");
    try { onSaved(await saveSettings(contents)); onClose(); }
    catch (reason) { setError(String(reason)); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="setup-dialog" aria-labelledby="setup-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="setup-heading"><div><span className="eyebrow">Sound Monitor</span><h2 id="setup-title">Setup</h2></div><button className="icon-button" onClick={onClose} disabled={busy} aria-label={da ? "Luk" : "Close"}><X size={18} /></button></div>
    <section><h3>{da ? "Optagelser" : "Recordings"}</h3><code className="setup-path">{archivePath}</code><button className="export-button" disabled={!isDesktopRuntime()} onClick={() => void openRecordingsFolder().catch((reason) => setError(String(reason)))}><FolderOpen size={16} />{da ? "Åbn optagelsesmappe" : "Open recordings folder"}</button></section>
    <section><h3>{da ? "Indstillinger" : "Settings"}</h3><p>{da ? "Redigér sprog og klassifikationer. Indstillinger valideres og gemmes samlet." : "Edit language and classifications. Settings are validated and saved together."}</p><div className="setup-fields"><label className="field"><span>{da ? "Sprog" : "Language"}</span><select value={iniValue(contents, "general", "language")} onChange={(e) => setContents(setIniValue(contents, "general", "language", e.target.value))}><option value="da">Dansk</option><option value="en">English</option></select></label></div><details><summary>{da ? "Klassifikationer og alle indstillinger" : "Classifications and all settings"}</summary><label className="field"><span>sound-monitor.ini</span><textarea spellCheck={false} value={contents} onChange={(e) => setContents(e.target.value)} rows={12} disabled={!settings || busy} /></label></details><code className="setup-path">{settings?.filePath}</code></section>
    <section className="nextcloud-status"><h3>Nextcloud / WebDAV</h3><div className="setup-fields">{field("nextcloud", "base_url", "URL", "url")}{field("nextcloud", "remote_path", da ? "Fjernmappe" : "Remote path")}{field("nextcloud", "username", da ? "Brugernavn" : "Username")}{field("nextcloud", "credential_reference", "Credential-reference")}</div><p>{da ? "Lokal lagring er aktiv. URL, fjernmappe, brugernavn og credential-reference kan forberedes i [nextcloud]. Upload, download, synkronisering og sikker credential-lagring er endnu ikke implementeret. Gem aldrig passwords eller tokens her." : "Local storage is active. Prepare URL, remote path, username and credential reference in [nextcloud]. Upload, download, sync and secure credential storage are not implemented yet. Never enter passwords or tokens here."}</p></section>
    {error && <p role="alert" className="setup-error">{error}</p>}
    <div className="setup-actions"><button className="cancel-button" onClick={onClose} disabled={busy}>{da ? "Annullér" : "Cancel"}</button><button className="export-button" onClick={() => void save()} disabled={!settings || busy}><Save size={16} />{busy ? (da ? "Gemmer…" : "Saving…") : (da ? "Gem indstillinger" : "Save settings")}</button></div>
  </dialog>;
}
