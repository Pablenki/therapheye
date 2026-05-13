// =========================================
// CHAT DE SÍNTOMAS VISUALES — Therapheye
// Asistente de IA especializado en salud visual
// Sistema de cola: 1 usuario activo a la vez
// Inactividad: 2 min sin actividad → cede turno
// =========================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Send, Bot, User, Sparkles, RefreshCw, Headphones, CheckCircle, Play, Clock } from 'lucide-react';
import { useLanguage } from '../i18n';
import { useUser } from '../context/UserContext';
import { callClaude } from '../utils/claudeApi';
import { enviarSoporteTecnico } from '../utils/emailService';

interface Props {
  onBack: () => void;
  onStartExercise?: (exerciseId: string) => void;
}

interface Message {
  role: 'assistant' | 'user';
  content: string;
  timestamp: Date;
  provider?: string;
}

type QueueStatus = 'checking' | 'active' | 'waiting' | 'inactive_kicked';

const QUICK_SYMPTOMS_ES = [
  'Me pica el ojo', 'Tengo el ojo rojo', 'Visión borrosa',
  'Ojo seco y ardor', 'Dolor de cabeza al leer', 'Veo destellos de luz',
  'Sensibilidad a la luz', 'Ojo lloroso', 'Cansancio visual al final del día',
];

const QUICK_SYMPTOMS_EN = [
  'My eye itches', 'Red eye', 'Blurry vision',
  'Dry and burning eye', 'Headache when reading', 'I see flashes of light',
  'Light sensitivity', 'Watery eye', 'Eye fatigue at end of day',
];

const getSystemPrompt = (lang: string) => lang === 'en'
  ? `You are a specialized visual health assistant for the Therapheye platform.
Your role: guide users on common visual symptoms, possible causes, and when to seek medical attention.

Rules:
- Always respond in English, clearly, empathetically and concisely (max 4-5 sentences)
- Use emojis in moderation to keep responses friendly
- NEVER diagnose diseases — only guide on common symptoms and probable causes
- For serious symptoms (sudden vision loss, intense pain, trauma, sudden floaters, dark curtain in vision): URGENTLY recommend seeing an ophthalmologist
- DO NOT proactively recommend exercises in every response — only mention them if the user explicitly asks for exercises or if the symptom makes it very clearly appropriate
- If exercises might help, ask at the end: "Would you like me to suggest a visual exercise for this?" — do not just launch into recommending them
- When exercises are explicitly requested or confirmed, mention by exact name: "Palming", "20-20-20 rule", "eye circular movements", "near-far focus" (the system detects these names and shows action buttons)
- Always briefly add that you do not replace a professional medical diagnosis`
  : `Eres un asistente especializado en salud visual para la plataforma Therapheye.
Tu rol: orientar a los usuarios sobre síntomas visuales comunes, posibles causas y cuándo buscar atención médica.

Reglas:
- Responde siempre en español, de forma clara, empática y concisa (máximo 4-5 oraciones)
- Usa emojis con moderación para hacer la respuesta amigable
- NUNCA diagnostiques enfermedades — solo orienta sobre síntomas comunes y probables causas
- Para síntomas graves (pérdida súbita de visión, dolor intenso, trauma, moscas flotantes súbitas, cortina oscura en la visión): recomienda URGENTEMENTE al oftalmólogo con énfasis
- NO recomiendes ejercicios proactivamente en cada respuesta — solo mencionarlos si el usuario los pide explícitamente o si el síntoma lo hace muy evidente
- Si crees que ejercicios podrían ayudar, pregunta al final: "¿Quieres que te sugiera algún ejercicio visual para esto?" — no los incluyas sin que el usuario lo confirme
- Cuando el usuario pida ejercicios o lo confirme, menciónalos por su nombre exacto: "Palming", "Regla 20-20-20", "movimientos circulares de ojos", "enfoque cercano-lejano" (el sistema los detecta y muestra botones de acción)
- Añade siempre brevemente que no reemplazas un diagnóstico médico profesional`;

const WELCOME_MSG_ES = `¡Hola! 👋 Soy tu asistente de salud visual.\n\nCuéntame qué molestia o síntoma tienes — puedo orientarte sobre posibles causas y si deberías consultar a un especialista. ¿Qué te pasa?`;
const WELCOME_MSG_EN = `Hi! 👋 I'm your visual health assistant.\n\nTell me what symptom or discomfort you have — I can guide you on possible causes and whether you should see a specialist. What's going on?`;

// ── Persistencia de chat en localStorage ────────────────────────────────────
const CHAT_STORAGE_KEY = 'therapheye_chat_v1';

function saveChatMessages(msgs: Message[], userId: string) {
  try {
    const serializable = msgs.map(m => ({
      role: m.role, content: m.content,
      timestamp: m.timestamp.toISOString(), provider: m.provider,
    }));
    localStorage.setItem(`${CHAT_STORAGE_KEY}_${userId}`, JSON.stringify(serializable));
  } catch { /* noop */ }
}

function loadChatMessages(userId: string, welcome: string): Message[] {
  try {
    const raw = localStorage.getItem(`${CHAT_STORAGE_KEY}_${userId}`);
    if (!raw) return [{ role: 'assistant', content: welcome, timestamp: new Date() }];
    const parsed: Array<{ role: string; content: string; timestamp: string; provider?: string }> = JSON.parse(raw);
    if (!parsed.length) return [{ role: 'assistant', content: welcome, timestamp: new Date() }];
    return parsed.map(m => ({
      role: m.role as 'assistant' | 'user',
      content: m.content,
      timestamp: new Date(m.timestamp),
      provider: m.provider,
    }));
  } catch { return [{ role: 'assistant', content: welcome, timestamp: new Date() }]; }
}

function clearChatMessages(userId: string) {
  try { localStorage.removeItem(`${CHAT_STORAGE_KEY}_${userId}`); } catch { /* noop */ }
}

// ── Detección de ejercicios mencionados en respuesta IA ──────────────────────
type ExerciseMatch = { id: string; labelEs: string; labelEn: string };

const EXERCISE_PATTERNS: Array<{ id: string; labelEs: string; labelEn: string; patternsEs: RegExp[]; patternsEn: RegExp[] }> = [
  {
    id: 'palming',
    labelEs: 'Palming',
    labelEn: 'Palming',
    patternsEs: [/palming/i, /palmas? (sobre|cubriendo) (los )?ojos/i],
    patternsEn: [/palming/i, /cover.*eyes.*palm/i],
  },
  {
    id: '20-20-20',
    labelEs: 'Regla 20-20-20',
    labelEn: '20-20-20 Rule',
    patternsEs: [/20[-–]20[-–]20/i, /regla.*20/i, /descanso.*20/i],
    patternsEn: [/20[-–]20[-–]20/i, /rule.*20/i],
  },
  {
    id: 'circles',
    labelEs: 'Movimientos circulares',
    labelEn: 'Eye circles',
    patternsEs: [/c[íi]rculos? (oculares?|de ojos)/i, /rotar (los )?ojos/i, /movimientos? circular/i],
    patternsEn: [/eye circles?/i, /circular.*eye/i, /rotate.*eye/i],
  },
  {
    id: 'near-far',
    labelEs: 'Enfoque cercano-lejano',
    labelEn: 'Near-far focus',
    patternsEs: [/enfoque (cercano|lejano|near|far)/i, /cerca.*lejos/i, /alternando.*distancia/i],
    patternsEn: [/near.?far focus/i, /focus.*near.*far/i, /near and far/i],
  },
  {
    id: 'focus',
    labelEs: 'Ejercicio de enfoque',
    labelEn: 'Focus exercise',
    patternsEs: [/ejercicio de enfoque/i, /enfocar.*objeto/i],
    patternsEn: [/focus exercise/i, /focusing exercise/i],
  },
];

function detectExercises(text: string, lang: string): ExerciseMatch[] {
  const found: ExerciseMatch[] = [];
  const seen = new Set<string>();
  for (const ex of EXERCISE_PATTERNS) {
    const patterns = lang === 'en' ? ex.patternsEn : ex.patternsEs;
    if (patterns.some(p => p.test(text)) && !seen.has(ex.id)) {
      seen.add(ex.id);
      found.push({ id: ex.id, labelEs: ex.labelEs, labelEn: ex.labelEn });
    }
  }
  return found;
}

// ── API de cola ───────────────────────────────────────────────────────────────
async function callQueue(action: string, userId: string): Promise<{ status?: string; position?: number; ok?: boolean } | null> {
  try {
    const res = await fetch('/.netlify/functions/ai-queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, userId }),
    });
    return res.ok ? res.json() : null;
  } catch { return null; }
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

function ChatBubble({
  msg,
  lang,
  exercises,
  onStartExercise,
}: {
  msg: Message;
  lang: string;
  exercises?: ExerciseMatch[];
  onStartExercise?: (id: string) => void;
}) {
  const isBot = msg.role === 'assistant';
  const formattedTime = msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`flex gap-2.5 mb-4 ${isBot ? 'justify-start' : 'justify-end'}`}>
      {isBot && (
        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-1">
          <Bot className="w-4 h-4 text-indigo-600" />
        </div>
      )}
      <div className={`max-w-[80%] ${isBot ? '' : 'order-first'}`}>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isBot
            ? 'bg-white border border-gray-100 text-gray-800 shadow-sm rounded-tl-sm'
            : 'bg-indigo-600 text-white rounded-tr-sm'
        }`}>
          {msg.content}
        </div>
        {/* Exercise action buttons — only for bot messages with detected exercises */}
        {isBot && exercises && exercises.length > 0 && onStartExercise && (
          <div className="mt-2 flex flex-wrap gap-2">
            {exercises.map(ex => (
              <button
                key={ex.id}
                onClick={() => onStartExercise(ex.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-full transition shadow-sm active:scale-95"
              >
                <Play className="w-3 h-3" />
                {lang === 'en' ? ex.labelEn : ex.labelEs}
              </button>
            ))}
          </div>
        )}
        <div className={`flex items-center gap-2 mt-1 ${isBot ? 'justify-start' : 'justify-end'}`}>
          <p className="text-[10px] text-gray-400">{formattedTime}</p>
          {isBot && msg.provider && (
            <span className="text-[9px] bg-indigo-50 text-indigo-400 px-1.5 py-0.5 rounded-full font-medium">
              {msg.provider}
            </span>
          )}
        </div>
      </div>
      {!isBot && (
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-1">
          <User className="w-4 h-4 text-white" />
        </div>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ChatSintomas({ onBack, onStartExercise }: Props) {
  const { lang } = useLanguage();
  const { user } = useUser();
  const quickSymptoms = lang === 'en' ? QUICK_SYMPTOMS_EN : QUICK_SYMPTOMS_ES;
  const welcomeMsg = lang === 'en' ? WELCOME_MSG_EN : WELCOME_MSG_ES;

  const [messages, setMessages] = useState<Message[]>(() =>
    user?.id ? loadChatMessages(user.id, welcomeMsg) : [{ role: 'assistant', content: welcomeMsg, timestamp: new Date() }]
  );
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState('');
  const [currentProvider, setCurrentProvider] = useState('');
  const [supportSent, setSupportSent] = useState(false);
  const [supportSending, setSupportSending] = useState(false);

  // ── Cola de espera ─────────────────────────────────────────────────────────
  const [queueStatus, setQueueStatus] = useState<QueueStatus>('checking');
  const [queuePosition, setQueuePosition] = useState(0);
  const lastActivityRef = useRef<number>(Date.now());
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Persistir mensajes
  useEffect(() => {
    if (user?.id && messages.length > 1) {
      saveChatMessages(messages, user.id);
    }
  }, [messages, user?.id]);

  // ── Efecto 1: Unirse a la cola al montar ──────────────────────────────────
  useEffect(() => {
    if (!user?.id) {
      // Sin autenticación: acceso directo (fallback)
      setQueueStatus('active');
      return;
    }

    let mounted = true;
    const userId = user.id;

    callQueue('join', userId).then(data => {
      if (!mounted) return;
      if (!data) {
        // Error de red: permitir acceso directo como fallback
        setQueueStatus('active');
        return;
      }
      lastActivityRef.current = Date.now();
      setQueueStatus(data.status === 'active' ? 'active' : 'waiting');
      setQueuePosition(data.position ?? 0);
    });

    return () => {
      mounted = false;
      // Liberar turno al desmontar (navegar hacia atrás)
      callQueue('leave', userId);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [user?.id]);

  // ── Efecto 2: Heartbeat cuando está activo ────────────────────────────────
  useEffect(() => {
    if (queueStatus !== 'active' || !user?.id) {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      return;
    }

    const userId = user.id;
    const INACTIVITY_MS = 2 * 60 * 1000;

    heartbeatIntervalRef.current = setInterval(async () => {
      // Comprobar inactividad: 2 min sin actividad → ceder turno
      if (Date.now() - lastActivityRef.current > INACTIVITY_MS) {
        await callQueue('leave', userId);
        setQueueStatus('inactive_kicked');
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }
        return;
      }
      // Heartbeat normal
      const data = await callQueue('heartbeat', userId);
      if (data?.status === 'expired') {
        // El servidor limpió la sesión (no debería pasar si hay heartbeat activo)
        setQueueStatus('waiting');
        setQueuePosition(99);
      }
    }, 30_000);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [queueStatus, user?.id]);

  // ── Efecto 3: Poll cuando está en espera ──────────────────────────────────
  useEffect(() => {
    if (queueStatus !== 'waiting' || !user?.id) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    const userId = user.id;

    pollIntervalRef.current = setInterval(async () => {
      const data = await callQueue('heartbeat', userId);
      if (!data) return;

      if (data.status === 'active') {
        lastActivityRef.current = Date.now();
        setQueueStatus('active');
      } else if (data.status === 'expired') {
        // Sesión expiró en el servidor, reintentamos unirse
        const joinData = await callQueue('join', userId);
        if (joinData?.status === 'active') {
          lastActivityRef.current = Date.now();
          setQueueStatus('active');
        } else {
          setQueuePosition(joinData?.position ?? 0);
        }
      } else {
        setQueuePosition(data.position ?? 0);
      }
    }, 8_000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [queueStatus, user?.id]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    if (user?.id) callQueue('leave', user.id);
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    onBack();
  }, [user?.id, onBack]);

  const handleRejoin = useCallback(async () => {
    if (!user?.id) return;
    setQueueStatus('checking');
    const data = await callQueue('join', user.id);
    if (!data) { setQueueStatus('active'); return; }
    lastActivityRef.current = Date.now();
    setQueueStatus(data.status === 'active' ? 'active' : 'waiting');
    setQueuePosition(data.position ?? 0);
  }, [user?.id]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    lastActivityRef.current = Date.now(); // Registrar actividad

    const userMsg: Message = { role: 'user', content: trimmed, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    setError('');

    // Build conversation history for API (last 10 messages, no welcome)
    const history = [...messages, userMsg]
      .filter((_, i) => i > 0) // skip welcome
      .slice(-10)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const data = await callClaude({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: getSystemPrompt(lang),
        messages: history,
      });
      const reply = data.content?.[0]?.text ?? '...';
      const provider = data.provider || '';
      if (provider) setCurrentProvider(provider);

      setMessages(prev => [...prev, { role: 'assistant', content: reply, timestamp: new Date(), provider }]);
    } catch (e: any) {
      const msg = e?.message || 'Error desconocido';
      setError(msg);
    }
    setIsTyping(false);
  }, [messages, isTyping, lang]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleReset = () => {
    if (user?.id) clearChatMessages(user.id);
    setMessages([{ role: 'assistant', content: welcomeMsg, timestamp: new Date() }]);
    setError('');
    setInput('');
    setSupportSent(false);
  };

  const handleSendSupport = async () => {
    if (supportSending || supportSent) return;
    setSupportSending(true);
    try {
      const transcript = messages
        .map(m => {
          const who = m.role === 'assistant' ? 'Asistente IA' : (user?.nombre ?? 'Usuario');
          const time = m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return `[${time}] ${who}: ${m.content}`;
        })
        .join('\n\n');

      await enviarSoporteTecnico(
        user?.nombre ?? 'Usuario desconocido',
        user?.email ?? 'sin email',
        transcript,
        new Date().toLocaleString('es-MX', { dateStyle: 'full', timeStyle: 'short' })
      );
      setSupportSent(true);
    } catch {
      setError(lang === 'es' ? 'Error al enviar a soporte. Intenta de nuevo.' : 'Error sending to support. Try again.');
    }
    setSupportSending(false);
  };

  // ── Indicador de estado para el header ────────────────────────────────────
  const statusColor =
    queueStatus === 'waiting' ? 'text-amber-500' :
    queueStatus === 'inactive_kicked' ? 'text-orange-500' :
    queueStatus === 'checking' ? 'text-gray-400' : 'text-green-500';

  const statusDotColor =
    queueStatus === 'waiting' ? 'bg-amber-500' :
    queueStatus === 'inactive_kicked' ? 'bg-orange-500' :
    queueStatus === 'checking' ? 'bg-gray-300' : 'bg-green-500';

  const statusText =
    queueStatus === 'checking'
      ? (lang === 'es' ? 'Conectando...' : 'Connecting...')
      : queueStatus === 'waiting'
      ? (lang === 'es' ? `En fila · Posición #${queuePosition + 1}` : `In queue · Position #${queuePosition + 1}`)
      : queueStatus === 'inactive_kicked'
      ? (lang === 'es' ? 'Sesión cerrada por inactividad' : 'Session closed: inactive')
      : messages.length > 1
        ? (lang === 'es' ? `Conversación activa · ${messages.length - 1} mensajes` : `Active chat · ${messages.length - 1} messages`)
        : (lang === 'es' ? 'En línea · Therapheye IA' : 'Online · Therapheye AI');

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="text-gray-500 hover:text-gray-800 transition mr-1">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center">
            <Bot className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="font-bold text-gray-800 text-sm leading-tight">
              {lang === 'es' ? 'Asistente Visual' : 'Visual Assistant'}
            </p>
            <p className={`text-xs flex items-center gap-1 ${statusColor}`}>
              <span className={`w-1.5 h-1.5 rounded-full inline-block ${statusDotColor}`} />
              {statusText}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full font-medium flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            {currentProvider || 'Therapheye IA'}
          </span>
          <button
            onClick={handleReset}
            className="text-gray-400 hover:text-gray-600 transition p-1.5 rounded-lg hover:bg-gray-100"
            title={lang === 'es' ? 'Nueva conversación' : 'New conversation'}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Pantallas de cola (checking / waiting / inactive_kicked) ── */}
      {queueStatus !== 'active' && (
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">

          {queueStatus === 'checking' && (
            <>
              <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              <p className="text-sm text-gray-500">
                {lang === 'es' ? 'Conectando al asistente...' : 'Connecting to assistant...'}
              </p>
            </>
          )}

          {queueStatus === 'waiting' && (
            <>
              <div className="w-18 h-18 w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                <Clock className="w-8 h-8 text-amber-500" />
              </div>
              <div className="text-center">
                <p className="font-bold text-gray-800 text-base">
                  {lang === 'es' ? 'En fila de espera' : 'Waiting in queue'}
                </p>
                <p className="text-4xl font-bold text-amber-500 mt-2">
                  #{queuePosition + 1}
                </p>
                <p className="text-sm text-gray-500 mt-3 max-w-xs leading-relaxed">
                  {lang === 'es'
                    ? 'Los 2 turnos activos están ocupados. Serás atendido automáticamente en cuanto quede un lugar libre.'
                    : 'Both active slots are taken. You\'ll be served automatically as soon as one becomes available.'}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  {lang === 'es' ? 'Verificando cada 8 segundos...' : 'Checking every 8 seconds...'}
                </p>
              </div>
              <button
                onClick={handleBack}
                className="px-5 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
              >
                {lang === 'es' ? 'Salir de la fila' : 'Leave queue'}
              </button>
            </>
          )}

          {queueStatus === 'inactive_kicked' && (
            <>
              <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center">
                <Clock className="w-8 h-8 text-orange-500" />
              </div>
              <div className="text-center">
                <p className="font-bold text-gray-800 text-base">
                  {lang === 'es' ? 'Turno cedido por inactividad' : 'Turn passed: inactive'}
                </p>
                <p className="text-sm text-gray-500 mt-3 max-w-xs leading-relaxed">
                  {lang === 'es'
                    ? 'Llevas 2 minutos sin actividad, así que cedimos tu turno al siguiente usuario en la fila.'
                    : 'You were inactive for 2 minutes, so your turn was passed to the next user in queue.'}
                </p>
              </div>
              <button
                onClick={handleRejoin}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition"
              >
                {lang === 'es' ? 'Volver a la fila' : 'Rejoin queue'}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Chat (solo cuando está activo) ── */}
      {queueStatus === 'active' && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {messages.map((msg, i) => (
              <ChatBubble
                key={i}
                msg={msg}
                lang={lang}
                exercises={msg.role === 'assistant' && i > 0 ? detectExercises(msg.content, lang) : undefined}
                onStartExercise={onStartExercise}
              />
            ))}
            {isTyping && (
              <div className="flex gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm shadow-sm">
                  <TypingDots />
                </div>
              </div>
            )}
            {error && (
              <div className="mx-4 mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
                <span className="text-lg leading-none mt-0.5">
                  {error === 'AI_BUSY' ? '⏳' : '🔧'}
                </span>
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    {error === 'AI_BUSY'
                      ? (lang === 'es' ? 'El asistente está muy ocupado' : 'Assistant is busy right now')
                      : (lang === 'es' ? 'El asistente no está disponible' : 'Assistant unavailable')}
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    {error === 'AI_BUSY'
                      ? (lang === 'es' ? 'Demasiadas consultas al mismo tiempo. Intenta de nuevo en unos segundos.' : 'Too many requests. Try again in a few seconds.')
                      : (lang === 'es' ? 'Estamos teniendo problemas técnicos. Inténtalo de nuevo en un momento.' : 'We\'re having technical issues. Please try again shortly.')}
                  </p>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick symptoms — show only on first message */}
          {messages.length === 1 && (
            <div className="px-4 pb-2 flex-shrink-0">
              <p className="text-xs text-gray-400 mb-2 font-medium">
                {lang === 'es' ? 'Síntomas frecuentes:' : 'Common symptoms:'}
              </p>
              <div className="flex flex-wrap gap-2">
                {quickSymptoms.map(s => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium transition border border-indigo-100"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Support escalation — shown after at least 3 messages */}
          {messages.length >= 3 && (
            <div className="px-4 pb-2 flex-shrink-0">
              {supportSent ? (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <p className="text-xs text-green-700 font-medium">
                    {lang === 'es'
                      ? 'Transcript enviado a soporte. Te responderemos pronto.'
                      : 'Transcript sent to support. We\'ll get back to you soon.'}
                  </p>
                </div>
              ) : (
                <button
                  onClick={handleSendSupport}
                  disabled={supportSending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl text-xs text-amber-700 font-medium transition disabled:opacity-60"
                >
                  <Headphones className="w-3.5 h-3.5" />
                  {supportSending
                    ? (lang === 'es' ? 'Enviando...' : 'Sending...')
                    : (lang === 'es' ? '¿No resolviste tu problema? Contactar soporte' : 'Didn\'t solve your issue? Contact support')}
                </button>
              )}
            </div>
          )}

          {/* Input */}
          <div className="px-4 pb-4 pt-2 bg-white border-t border-gray-100 flex-shrink-0">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={lang === 'es' ? 'Describe tu síntoma... (Enter para enviar)' : 'Describe your symptom... (Enter to send)'}
                rows={1}
                className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition max-h-28 overflow-y-auto"
                style={{ minHeight: '44px' }}
                onInput={e => {
                  lastActivityRef.current = Date.now(); // Registrar actividad al escribir
                  const t = e.currentTarget;
                  t.style.height = 'auto';
                  t.style.height = Math.min(t.scrollHeight, 112) + 'px';
                }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isTyping}
                className="w-11 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 text-white flex items-center justify-center transition flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5 text-center">
              {lang === 'es'
                ? '⚠ Orientación informativa — no reemplaza el diagnóstico médico'
                : '⚠ Informational guidance — does not replace medical diagnosis'}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
