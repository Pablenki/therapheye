import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, KeyRound, Trash2, Eye, EyeOff, Loader2, CheckCircle, AlertTriangle, UserCircle2, Camera, Bell, BellOff, BellRing, Download } from 'lucide-react';
import { hashPassword } from '../utils/authHash';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../i18n';
import { sql } from '../neonCliente';
import { generarCodigo, enviarCorreoEliminacion } from '../utils/emailService';
import { usePushNotifications } from '../hooks/usePushNotifications';

type Tab = 'perfil' | 'password' | 'account' | 'notificaciones' | 'exportar';

interface Props {
  onBack: () => void;
  onLogout: () => void;
}

// ─── Redimensionar imagen a max 256x256 → base64 ─────────────────────────────
const resizeImage = (file: File, maxPx = 256): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width  * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// ─── Requisitos de contraseña ─────────────────────────────────────────────────
const pwdReqs = (pwd: string) => [
  { label: 'Mínimo 8 caracteres', valid: pwd.length >= 8 },
  { label: 'Una mayúscula',        valid: /[A-Z]/.test(pwd) },
  { label: 'Una minúscula',        valid: /[a-z]/.test(pwd) },
  { label: 'Un número',           valid: /[0-9]/.test(pwd) },
];

// ─── Calcular edad ────────────────────────────────────────────────────────────
const calcAge = (dob: string): number => {
  const b = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - b.getFullYear();
  if (today.getMonth() < b.getMonth() || (today.getMonth() === b.getMonth() && today.getDate() < b.getDate())) age--;
  return age;
};

export default function Profile({ onBack, onLogout }: Props) {
  const { user, logout, updateUser } = useUser();
  const { lang } = useLanguage();

  const [tab, setTab] = useState<Tab>('perfil');
  const push = usePushNotifications(user?.id);

  // ── Estado tab Perfil ──────────────────────────────────────────────────────
  const [nombre,          setNombre]        = useState(user?.nombre ?? '');
  const [dob,             setDob]           = useState(user?.fecha_nacimiento ?? '');
  const [photoPreview,    setPhotoPreview]  = useState<string | null>(user?.foto_perfil ?? null);
  const [photoFile,       setPhotoFile]     = useState<string | null>(null); // base64 nuevo
  const [perfilLoading,   setPerfilLoading] = useState(false);
  const [perfilMsg,       setPerfilMsg]     = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  // ── Estado tab Contraseña ─────────────────────────────────────────────────
  const [newPwd,     setNewPwd]     = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showNew,    setShowNew]    = useState(false);
  const [showConf,   setShowConf]   = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg,     setPwdMsg]     = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // ── Estado tab Cuenta ─────────────────────────────────────────────────────
  const [deleteStep,    setDeleteStep]    = useState<'confirm' | 'code'>('confirm');
  const [deleteCode,    setDeleteCode]    = useState('');
  const [inputCode,     setInputCode]     = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteMsg,     setDeleteMsg]     = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const es = lang === 'es';

  // ── Seleccionar foto ───────────────────────────────────────────────────────
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const b64 = await resizeImage(file);
      setPhotoPreview(b64);
      setPhotoFile(b64);
    } catch { /* noop */ }
  };

  // ── Guardar perfil ────────────────────────────────────────────────────────
  const handleSavePerfil = async () => {
    setPerfilMsg(null);
    if (!nombre.trim()) { setPerfilMsg({ type: 'err', text: es ? 'El nombre no puede estar vacío' : 'Name cannot be empty' }); return; }
    setPerfilLoading(true);
    try {
      const foto = photoFile ?? user?.foto_perfil ?? null;
      const dobVal = dob || null;
      await sql`
        UPDATE users
        SET nombre = ${nombre.trim()}, foto_perfil = ${foto}, fecha_nacimiento = ${dobVal}
        WHERE id = ${user!.id}
      `;
      updateUser({ nombre: nombre.trim(), foto_perfil: foto, fecha_nacimiento: dobVal });
      setPerfilMsg({ type: 'ok', text: es ? 'Perfil actualizado' : 'Profile updated' });
    } catch {
      setPerfilMsg({ type: 'err', text: es ? 'Error al guardar' : 'Error saving' });
    } finally {
      setPerfilLoading(false);
    }
  };

  // ── Cambiar contraseña ────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    setPwdMsg(null);
    if (!pwdReqs(newPwd).every(r => r.valid)) { setPwdMsg({ type: 'err', text: es ? 'La contraseña no cumple los requisitos' : 'Password does not meet requirements' }); return; }
    if (newPwd !== confirmPwd) { setPwdMsg({ type: 'err', text: es ? 'Las contraseñas no coinciden' : 'Passwords do not match' }); return; }
    setPwdLoading(true);
    try {
      const hash = await hashPassword(newPwd);
      await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${user!.id}`;
      setPwdMsg({ type: 'ok', text: es ? 'Contraseña actualizada' : 'Password updated' });
      setNewPwd(''); setConfirmPwd('');
    } catch {
      setPwdMsg({ type: 'err', text: es ? 'Error al actualizar' : 'Error updating' });
    } finally {
      setPwdLoading(false);
    }
  };

  // ── Solicitar eliminación ─────────────────────────────────────────────────
  const handleRequestDelete = async () => {
    setDeleteMsg(null);
    setDeleteLoading(true);
    try {
      const code = generarCodigo();
      setDeleteCode(code);
      await enviarCorreoEliminacion(user!.email, user!.nombre, code);
      setDeleteStep('code');
    } catch {
      setDeleteMsg({ type: 'err', text: es ? 'Error enviando código' : 'Error sending code' });
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Confirmar eliminación ─────────────────────────────────────────────────
  const handleConfirmDelete = async () => {
    setDeleteMsg(null);
    if (inputCode.trim() !== deleteCode) { setDeleteMsg({ type: 'err', text: es ? 'Código incorrecto' : 'Wrong code' }); return; }
    setDeleteLoading(true);
    try {
      const uid = user!.id;
      await sql`DELETE FROM historial_ejercicios    WHERE user_id = ${uid}`;
      await sql`DELETE FROM respuestas_cuestionario WHERE user_id = ${uid}`;
      await sql`DELETE FROM sesiones_salud_visual   WHERE user_id = ${uid}`;
      await sql`DELETE FROM historial_vision_test   WHERE user_id = ${uid}`;
      await sql`DELETE FROM timer_state             WHERE user_id = ${uid}`;
      await sql`DELETE FROM user_preferences        WHERE user_id = ${uid}`;
      await sql`DELETE FROM user_sessions           WHERE user_id = ${uid}`;
      await sql`DELETE FROM image_capture_history   WHERE user_id = ${uid}`.catch(() => {});
      await sql`DELETE FROM diagnostico_completo    WHERE user_id = ${uid}`.catch(() => {});
      await sql`DELETE FROM users                   WHERE id      = ${uid}`;
      logout();
      onLogout();
    } catch {
      setDeleteMsg({ type: 'err', text: es ? 'Error al eliminar la cuenta' : 'Error deleting account' });
      setDeleteLoading(false);
    }
  };

  const pwdValid = pwdReqs(newPwd).every(r => r.valid) && newPwd === confirmPwd;
  const age = dob ? calcAge(dob) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 transition text-sm font-medium">
            <ArrowLeft className="w-4 h-4" />
            {es ? 'Volver' : 'Back'}
          </button>
          <h1 className="text-lg font-bold text-gray-800">{es ? 'Mi cuenta' : 'My account'}</h1>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 pt-8 pb-24">
        <p className="text-center text-sm text-gray-500 mb-6">{user?.email}</p>

        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="w-44 flex-shrink-0 flex flex-col gap-1">
            <SideTab active={tab === 'perfil'}   icon={<UserCircle2 className="w-4 h-4" />} label={es ? 'Perfil'      : 'Profile'}  onClick={() => { setTab('perfil');    setPerfilMsg(null); }} />
            <SideTab active={tab === 'password'} icon={<KeyRound    className="w-4 h-4" />} label={es ? 'Contraseña' : 'Password'} onClick={() => { setTab('password');  setPwdMsg(null); }} />
            <SideTab active={tab === 'notificaciones'} icon={<Bell className="w-4 h-4" />} label={es ? 'Notificaciones' : 'Notifications'} onClick={() => setTab('notificaciones')} />
            <SideTab active={tab === 'exportar'} icon={<Download    className="w-4 h-4" />} label={es ? 'Exportar datos' : 'Export data'} onClick={() => setTab('exportar')} />
            <SideTab active={tab === 'account'}  icon={<Trash2      className="w-4 h-4" />} label={es ? 'Cuenta'     : 'Account'}  danger onClick={() => { setTab('account'); setDeleteStep('confirm'); setDeleteMsg(null); setInputCode(''); }} />
          </aside>

          {/* Panel */}
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">

            {/* ── Tab: Perfil ── */}
            {tab === 'perfil' && (
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-2 mb-1">
                  <UserCircle2 className="w-5 h-5 text-indigo-500" />
                  <h2 className="text-base font-bold text-gray-800">{es ? 'Perfil' : 'Profile'}</h2>
                </div>

                {/* Foto de perfil */}
                <div className="flex flex-col items-center gap-3">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-indigo-100 flex items-center justify-center border-4 border-white shadow-md">
                      {photoPreview
                        ? <img src={photoPreview} alt="avatar" className="w-full h-full object-cover" />
                        : <span className="text-3xl font-bold text-indigo-600">{user?.nombre?.charAt(0).toUpperCase()}</span>
                      }
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-0 right-0 w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center shadow-md hover:bg-indigo-700 transition"
                      title={es ? 'Cambiar foto' : 'Change photo'}
                    >
                      <Camera className="w-4 h-4 text-white" />
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                  </div>
                  <p className="text-xs text-gray-400">{es ? 'JPG, PNG o WebP · máx. 5 MB' : 'JPG, PNG or WebP · max 5 MB'}</p>
                </div>

                {/* Nombre */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">{es ? 'Nombre completo' : 'Full name'}</label>
                  <input
                    type="text"
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
                  />
                </div>

                {/* Fecha de nacimiento */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    {es ? 'Fecha de nacimiento' : 'Date of birth'}
                    {age !== null && (
                      <span className="ml-2 font-normal text-indigo-500">{age} {es ? 'años' : 'years old'}</span>
                    )}
                  </label>
                  <input
                    type="date"
                    value={dob}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={e => setDob(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm text-gray-700"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {es ? 'Se usa para personalizar recomendaciones de salud visual según tu edad.' : 'Used to personalize visual health recommendations based on your age.'}
                  </p>
                </div>

                {/* Mensaje */}
                {perfilMsg && (
                  <div className={`flex items-center gap-2 text-sm rounded-xl px-3 py-2 ${perfilMsg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {perfilMsg.type === 'ok' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
                    {perfilMsg.text}
                  </div>
                )}

                <button
                  onClick={handleSavePerfil}
                  disabled={perfilLoading}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {perfilLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {perfilLoading ? (es ? 'Guardando…' : 'Saving…') : (es ? 'Guardar cambios' : 'Save changes')}
                </button>
              </div>
            )}

            {/* ── Tab: Contraseña ── */}
            {tab === 'password' && (
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-2 mb-1">
                  <KeyRound className="w-5 h-5 text-indigo-500" />
                  <h2 className="text-base font-bold text-gray-800">{es ? 'Contraseña' : 'Password'}</h2>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">{es ? 'Nueva contraseña' : 'New password'}</label>
                  <div className="relative">
                    <input
                      type={showNew ? 'text' : 'password'}
                      value={newPwd}
                      onChange={e => setNewPwd(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      className="w-full px-4 py-2.5 pr-10 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
                    />
                    <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {newPwd.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1">
                      {pwdReqs(newPwd).map(r => (
                        <span key={r.label} className={`text-xs flex items-center gap-1.5 ${r.valid ? 'text-green-600' : 'text-gray-400'}`}>
                          <span>{r.valid ? '✓' : '·'}</span> {r.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">{es ? 'Confirmar contraseña' : 'Confirm password'}</label>
                  <div className="relative">
                    <input
                      type={showConf ? 'text' : 'password'}
                      value={confirmPwd}
                      onChange={e => setConfirmPwd(e.target.value)}
                      placeholder={es ? 'Repite la contraseña' : 'Repeat password'}
                      className="w-full px-4 py-2.5 pr-10 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
                    />
                    <button type="button" onClick={() => setShowConf(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showConf ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {pwdMsg && (
                  <div className={`flex items-center gap-2 text-sm rounded-xl px-3 py-2 ${pwdMsg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {pwdMsg.type === 'ok' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
                    {pwdMsg.text}
                  </div>
                )}

                <button
                  onClick={handleChangePassword}
                  disabled={pwdLoading || !pwdValid}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {pwdLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {pwdLoading ? (es ? 'Actualizando…' : 'Updating…') : (es ? 'Actualizar contraseña' : 'Update password')}
                </button>
              </div>
            )}

            {/* ── Tab: Cuenta (eliminar) ── */}
            {tab === 'account' && (
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-2 mb-1">
                  <Trash2 className="w-5 h-5 text-red-500" />
                  <h2 className="text-base font-bold text-gray-800">{es ? 'Cuenta' : 'Account'}</h2>
                </div>

                {deleteStep === 'confirm' && (
                  <>
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                      <p className="text-sm font-semibold text-red-700 mb-0.5">{es ? 'Zona de peligro' : 'Danger zone'}</p>
                      <p className="text-xs text-red-600 leading-relaxed">
                        {es ? 'Esta acción es permanente e irreversible. Se eliminarán tu cuenta y todos tus datos.' : 'This action is permanent and irreversible. Your account and all data will be deleted.'}
                      </p>
                    </div>
                    {deleteMsg && (
                      <div className="flex items-center gap-2 text-sm rounded-xl px-3 py-2 bg-red-50 text-red-700">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {deleteMsg.text}
                      </div>
                    )}
                    <button
                      onClick={handleRequestDelete}
                      disabled={deleteLoading}
                      className="w-full py-2.5 rounded-xl border-2 border-red-500 text-red-600 font-semibold text-sm hover:bg-red-50 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {deleteLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      {deleteLoading ? (es ? 'Enviando código…' : 'Sending code…') : (es ? 'Eliminar mi cuenta' : 'Delete my account')}
                    </button>
                  </>
                )}

                {deleteStep === 'code' && (
                  <>
                    <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                      <p className="text-sm font-semibold text-amber-800 mb-0.5">{es ? 'Confirma la eliminación' : 'Confirm deletion'}</p>
                      <p className="text-xs text-amber-700 leading-relaxed">
                        {es ? 'Hemos enviado un código a' : 'We sent a code to'} <span className="font-semibold">{user?.email}</span>.
                      </p>
                    </div>
                    <input
                      type="text" inputMode="numeric" maxLength={6}
                      value={inputCode}
                      onChange={e => setInputCode(e.target.value.replace(/\D/g, ''))}
                      placeholder={es ? 'Ingresa el código' : 'Enter the code'}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-400 text-center text-xl font-mono tracking-[0.4em] text-gray-800"
                    />
                    {deleteMsg && (
                      <div className="flex items-center gap-2 text-sm rounded-xl px-3 py-2 bg-red-50 text-red-700">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {deleteMsg.text}
                      </div>
                    )}
                    <div className="flex gap-3">
                      <button onClick={() => { setDeleteStep('confirm'); setInputCode(''); setDeleteMsg(null); }} disabled={deleteLoading} className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition disabled:opacity-50">
                        {es ? 'Cancelar' : 'Cancel'}
                      </button>
                      <button onClick={handleConfirmDelete} disabled={deleteLoading || inputCode.length !== 6} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
                        {deleteLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {deleteLoading ? (es ? 'Eliminando…' : 'Deleting…') : (es ? 'Eliminar cuenta' : 'Delete account')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Tab: Notificaciones ── */}
            {tab === 'notificaciones' && (
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-2 mb-1">
                  <Bell className="w-5 h-5 text-indigo-500" />
                  <h2 className="text-base font-bold text-gray-800">{es ? 'Notificaciones Push' : 'Push Notifications'}</h2>
                </div>

                {!push.supported && (
                  <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {es ? 'Tu navegador no soporta notificaciones push. Prueba con Chrome o Edge.' : 'Your browser does not support push notifications. Try Chrome or Edge.'}
                  </div>
                )}

                {push.supported && push.permission === 'denied' && (
                  <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                    <BellOff className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {es ? 'Bloqueaste las notificaciones en este navegador. Habilítalas desde la configuración del sitio.' : 'You blocked notifications in this browser. Enable them in site settings.'}
                  </div>
                )}

                {push.supported && push.permission !== 'denied' && (
                  <>
                    {/* Toggle principal */}
                    <div className={`rounded-2xl border-2 p-4 flex items-center justify-between gap-4 transition-all ${push.subscribed ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 bg-gray-50'}`}>
                      <div className="flex items-center gap-3">
                        {push.subscribed
                          ? <BellRing className="w-6 h-6 text-indigo-600" />
                          : <BellOff  className="w-6 h-6 text-gray-400" />}
                        <div>
                          <p className="text-sm font-bold text-gray-800">
                            {push.subscribed
                              ? (es ? 'Notificaciones activadas' : 'Notifications enabled')
                              : (es ? 'Notificaciones desactivadas' : 'Notifications disabled')}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {push.subscribed
                              ? (es ? 'Recibirás recordatorios en este dispositivo' : 'You will receive reminders on this device')
                              : (es ? 'Activa para recibir recordatorios personalizados' : 'Enable to receive personalized reminders')}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => push.subscribed ? push.unsubscribe() : push.subscribe()}
                        disabled={push.loading}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
                          push.subscribed
                            ? 'bg-white border border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-500'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        } disabled:opacity-50`}
                      >
                        {push.loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {push.subscribed ? (es ? 'Desactivar' : 'Disable') : (es ? 'Activar' : 'Enable')}
                      </button>
                    </div>

                    {/* Preferencias (solo si está suscrito) */}
                    {push.subscribed && (
                      <div className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col gap-3">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                          {es ? 'Qué recordatorios recibir' : 'Which reminders to receive'}
                        </p>
                        {([
                          { key: 'exercises',     icon: '🏋️', label: es ? 'Ejercicios diarios'          : 'Daily exercises',     desc: es ? 'Si no hiciste ejercicios hoy (2pm)' : "If you haven't exercised today (2pm)" },
                          { key: 'questionnaire', icon: '📊', label: es ? 'Cuestionario semanal'        : 'Weekly questionnaire', desc: es ? 'Los lunes si no evaluaste la semana'  : 'Mondays if you missed the weekly check' },
                          { key: 'streak',        icon: '🔥', label: es ? 'Racha en riesgo'             : 'Streak at risk',       desc: es ? 'Cuando tu racha pueda romperse hoy'  : 'When your streak may break today' },
                        ] as const).map(({ key, icon, label, desc }) => (
                          <div key={key} className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5">
                              <span className="text-lg flex-shrink-0">{icon}</span>
                              <div>
                                <p className="text-sm font-semibold text-gray-700">{label}</p>
                                <p className="text-xs text-gray-400">{desc}</p>
                              </div>
                            </div>
                            <label className="relative inline-block w-[44px] h-[24px] cursor-pointer flex-shrink-0 mt-0.5">
                              <input
                                type="checkbox"
                                checked={push.prefs[key]}
                                onChange={() => push.updatePrefs({ ...push.prefs, [key]: !push.prefs[key] })}
                                className="sr-only peer"
                              />
                              <div className="w-full h-full bg-gray-200 rounded-full peer-checked:bg-indigo-600 transition-colors">
                                <div className="absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5 shadow-sm" />
                              </div>
                            </label>
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="text-xs text-gray-400">
                      {es
                        ? '💡 Las notificaciones se envían automáticamente desde el servidor — funcionan aunque la app esté cerrada.'
                        : '💡 Notifications are sent automatically from the server — they work even when the app is closed.'}
                    </p>
                  </>
                )}
              </div>
            )}

            {/* ── Tab: Exportar datos ── */}
            {tab === 'exportar' && user?.id && (
              <ExportarDatos userId={user.id} />
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SideTab ──────────────────────────────────────────────────────────────────
function SideTab({ active, icon, label, danger = false, onClick }: {
  active: boolean; icon: React.ReactNode; label: string; danger?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition text-left w-full ${
        active
          ? danger ? 'bg-red-50 text-red-600 border-2 border-red-200' : 'bg-indigo-50 text-indigo-700 border-2 border-indigo-200'
          : 'text-gray-600 hover:bg-gray-100 border-2 border-transparent'
      }`}
    >
      <span className={active ? (danger ? 'text-red-500' : 'text-indigo-500') : 'text-gray-400'}>{icon}</span>
      {label}
    </button>
  );
}

// ─── ExportarDatos ────────────────────────────────────────────────────────────
function ExportarDatos({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const exportar = async (formato: 'json' | 'csv') => {
    setLoading(true);
    setError(null);
    setDone(false);
    try {
      // Fetch all tables in parallel
      const [evaluaciones, ejercicios, diario, rutinas, pomodoro, contraste, zenSessions] = await Promise.all([
        sql`SELECT * FROM respuestas_cuestionario WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 500`,
        sql`SELECT * FROM sesiones_ejercicio WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 500`.catch(() => []),
        sql`SELECT id, texto, clasificacion, sintomas_detectados, estado_animo_visual, created_at FROM diario_visual WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 500`.catch(() => []),
        sql`SELECT id, objetivo, consejos, created_at FROM rutinas_personalizadas WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 100`.catch(() => []),
        sql`SELECT * FROM pomodoro_sessions WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 500`.catch(() => []),
        sql`SELECT nivel_final, created_at FROM contrast_tests WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 200`.catch(() => []),
        sql`SELECT rutina_id, rutina_nombre, created_at FROM modo_zen_sessions WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 200`.catch(() => []),
      ]);

      const allData = {
        evaluaciones,
        ejercicios,
        diario_visual: diario,
        rutinas_ia: rutinas,
        pomodoro_sessions: pomodoro,
        contrast_tests: contraste,
        modo_zen: zenSessions,
        exportado_en: new Date().toISOString(),
        usuario_id: userId,
      };

      if (formato === 'json') {
        const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
        downloadBlob(blob, `therapheye_datos_${new Date().toISOString().slice(0, 10)}.json`);
      } else {
        // CSV: one sheet per table, separated by blank lines
        const sections: string[] = [];
        for (const [key, rows] of Object.entries(allData)) {
          if (!Array.isArray(rows) || rows.length === 0) continue;
          const headers = Object.keys(rows[0]).join(',');
          const csvRows = (rows as Record<string, unknown>[]).map(row =>
            Object.values(row).map(v => {
              const s = v === null || v === undefined ? '' : String(v);
              return s.includes(',') || s.includes('"') || s.includes('\n')
                ? `"${s.replace(/"/g, '""')}"` : s;
            }).join(',')
          );
          sections.push(`### ${key}\n${headers}\n${csvRows.join('\n')}`);
        }
        const blob = new Blob([sections.join('\n\n')], { type: 'text/csv;charset=utf-8;' });
        downloadBlob(blob, `therapheye_datos_${new Date().toISOString().slice(0, 10)}.csv`);
      }
      setDone(true);
    } catch (e) {
      setError('Error al exportar. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 mb-1">
        <Download className="w-5 h-5 text-indigo-500"/>
        <h2 className="text-lg font-bold text-gray-800">Exportar mis datos</h2>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-sm text-indigo-700 leading-relaxed">
        Descarga todos tus datos de Therapheye: evaluaciones, ejercicios, diario visual, rutinas con IA, sesiones Pomodoro y más.
        Los datos son solo tuyos y puedes compartirlos con tu oftalmólogo.
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl divide-y divide-gray-50">
        {[
          { key: 'evaluaciones', label: 'Evaluaciones / cuestionarios', icon: '📋' },
          { key: 'ejercicios', label: 'Sesiones de ejercicio', icon: '🏃' },
          { key: 'diario_visual', label: 'Entradas del diario visual', icon: '📓' },
          { key: 'rutinas_ia', label: 'Rutinas generadas con IA', icon: '🤖' },
          { key: 'pomodoro', label: 'Sesiones Pomodoro Visual', icon: '⏱' },
          { key: 'contraste', label: 'Tests de sensibilidad al contraste', icon: '🔲' },
          { key: 'modo_zen', label: 'Sesiones Modo Zen', icon: '🧘' },
        ].map(({ label, icon }) => (
          <div key={label} className="flex items-center gap-3 px-4 py-3">
            <span className="text-lg">{icon}</span>
            <span className="text-sm text-gray-700">{label}</span>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {done && <p className="text-sm text-emerald-600 flex items-center gap-1"><CheckCircle className="w-4 h-4"/> Descarga iniciada</p>}

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => exportar('json')}
          disabled={loading}
          className="py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4"/>}
          Descargar JSON
        </button>
        <button
          onClick={() => exportar('csv')}
          disabled={loading}
          className="py-3 rounded-xl bg-gray-800 text-white font-semibold text-sm hover:bg-gray-900 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4"/>}
          Descargar CSV
        </button>
      </div>

      <p className="text-xs text-gray-400 text-center">
        Los archivos se descargan localmente. Ningún dato se envía a terceros.
      </p>
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
