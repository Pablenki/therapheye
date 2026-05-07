// =========================================
// CHAT DE SÍNTOMAS VISUALES — Therapheye
// Asistente de IA especializado en salud visual
// Usa Claude Haiku para respuestas rápidas
// =========================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Send, Bot, User, Sparkles, RefreshCw, Headphones, CheckCircle, Play } from 'lucide-react';
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
- When relevant, mention Therapheye exercises by their exact name: "Palming", "20-20-20 rule", "eye circular movements", "near-far focus". The system will detect those names and show buttons to start them directly
- Always briefly add that you do not replace a professional medical diagnosis`
  : `Eres un asistente especializado en salud visual para la plataforma Therapheye.
Tu rol: orientar a los usuarios sobre síntomas visuales comunes, posibles causas y cuándo buscar atención médica.

Reglas:
- Responde siempre en español, de forma clara, empática y concisa (máximo 4-5 oraciones)
- Usa emojis con moderación para hacer la respuesta amigable
- NUNCA diagnostiques enfermedades — solo orienta sobre síntomas comunes y probables causas
- Para síntomas graves (pérdida súbita de visión, dolor intenso, trauma, moscas flotantes súbitas, cortina oscura en la visión): recomienda URGENTEMENTE al oftalmólogo con énfasis
- Cuando sea relevante, menciona ejercicios de Therapheye por su nombre exacto: "Palming", "Regla 20-20-20", "movimientos circulares de ojos", "enfoque cercano-lejano". El sistema detectará esos nombres y mostrará botones para iniciarlos directamente
- Añade siempre brevemente que no reemplazas un diagnóstico médico profesional cuando des orientación sobre síntomas`;

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
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Persistir mensajes cada vez que cambien (solo si hay más de 1 mensaje)
  useEffect(() => {
    if (user?.id && messages.length > 1) {
      saveChatMessages(messages, user.id);
    }
  }, [messages, user?.id]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

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

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-500 hover:text-gray-800 transition mr-1">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center">
            <Bot className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="font-bold text-gray-800 text-sm leading-tight">
              {lang === 'es' ? 'Asistente Visual' : 'Visual Assistant'}
            </p>
            <p className="text-xs text-green-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />
              {messages.length > 1
                ? (lang === 'es' ? `Conversación activa · ${messages.length - 1} mensajes` : `Active chat · ${messages.length - 1} messages`)
                : (lang === 'es' ? 'En línea · Therapheye IA' : 'Online · Therapheye AI')}
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
    </div>
  );
}
