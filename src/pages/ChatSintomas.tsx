// =========================================
// CHAT DE SÍNTOMAS VISUALES — Therapheye
// Asistente de IA especializado en salud visual
// Usa Claude Haiku para respuestas rápidas
// =========================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Send, Bot, User, Sparkles, RefreshCw, Headphones, CheckCircle } from 'lucide-react';
import { useLanguage } from '../i18n';
import { useUser } from '../context/UserContext';
import { callClaude } from '../utils/claudeApi';
import { enviarSoporteTecnico } from '../utils/emailService';

interface Props { onBack: () => void }

interface Message {
  role: 'assistant' | 'user';
  content: string;
  timestamp: Date;
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

const SYSTEM_PROMPT = `Eres un asistente especializado en salud visual para la plataforma Therapheye.
Tu rol: orientar a los usuarios sobre síntomas visuales comunes, posibles causas y cuándo buscar atención médica.

Reglas:
- Responde siempre en español, de forma clara, empática y concisa (máximo 4-5 oraciones)
- Usa emojis con moderación para hacer la respuesta amigable
- NUNCA diagnostiques enfermedades — solo orienta sobre síntomas comunes y probables causas
- Para síntomas graves (pérdida súbita de visión, dolor intenso, trauma, moscas flotantes súbitas, cortina oscura en la visión): recomienda URGENTEMENTE al oftalmólogo con énfasis
- Cuando sea relevante, sugiere usar alguna función de Therapheye: cuestionario de fatiga, ejercicios oculares, detector de parpadeo, o captura de imagen
- Añade siempre brevemente que no reemplazas un diagnóstico médico profesional cuando des orientación sobre síntomas
- Si el usuario escribe en inglés, responde en inglés pero mantén el mismo estilo`;

const WELCOME_MSG_ES = `¡Hola! 👋 Soy tu asistente de salud visual.\n\nCuéntame qué molestia o síntoma tienes — puedo orientarte sobre posibles causas y si deberías consultar a un especialista. ¿Qué te pasa?`;
const WELCOME_MSG_EN = `Hi! 👋 I'm your visual health assistant.\n\nTell me what symptom or discomfort you have — I can guide you on possible causes and whether you should see a specialist. What's going on?`;

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

function ChatBubble({ msg }: { msg: Message }) {
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
        <p className={`text-[10px] mt-1 text-gray-400 ${isBot ? 'text-left' : 'text-right'}`}>
          {formattedTime}
        </p>
      </div>
      {!isBot && (
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-1">
          <User className="w-4 h-4 text-white" />
        </div>
      )}
    </div>
  );
}

export default function ChatSintomas({ onBack }: Props) {
  const { lang } = useLanguage();
  const { user } = useUser();
  const quickSymptoms = lang === 'en' ? QUICK_SYMPTOMS_EN : QUICK_SYMPTOMS_ES;
  const welcomeMsg = lang === 'en' ? WELCOME_MSG_EN : WELCOME_MSG_ES;

  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: welcomeMsg, timestamp: new Date() },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState('');

  const [supportSent, setSupportSent] = useState(false);
  const [supportSending, setSupportSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

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
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: history,
      });
      const reply = data.content?.[0]?.text ?? '...';

      setMessages(prev => [...prev, { role: 'assistant', content: reply, timestamp: new Date() }]);
    } catch (e) {
      setError(lang === 'es' ? 'Error al conectar con la IA. Intenta de nuevo.' : 'Error connecting to AI. Try again.');
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
              {lang === 'es' ? 'En línea · Therapheye IA' : 'Online · Therapheye AI'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full font-medium flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Claude Haiku
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
          <ChatBubble key={i} msg={msg} />
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
          <p className="text-center text-xs text-red-500 mb-4">{error}</p>
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
