import { useState, useMemo, type ReactElement } from 'react';
import { ArrowLeft, BookOpen, Clock, Search, ChevronRight, ChevronLeft } from 'lucide-react';
import { useLanguage } from '../i18n';
import { ARTICLES, CATEGORY_META, type Article, type ArticleCategory } from '../data/articles';

// ─── SVG Ilustraciones ────────────────────────────────────────────────────────

const IlluFatigaDigital = () => (
  <svg viewBox="0 0 240 160" className="w-full h-full" aria-hidden="true">
    <defs>
      <radialGradient id="fd-bg" cx="50%" cy="50%" r="55%">
        <stop offset="0%" stopColor="#1e3a8a"/>
        <stop offset="100%" stopColor="#0f172a"/>
      </radialGradient>
      <radialGradient id="fd-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.5"/>
        <stop offset="100%" stopColor="#60a5fa" stopOpacity="0"/>
      </radialGradient>
    </defs>
    <rect width="240" height="160" fill="url(#fd-bg)"/>
    {/* Glow detrás del ojo */}
    <ellipse cx="120" cy="80" rx="55" ry="40" fill="url(#fd-glow)"/>
    {/* Esclerótica */}
    <ellipse cx="120" cy="80" rx="50" ry="30" fill="white" opacity="0.95"/>
    {/* Iris */}
    <circle cx="120" cy="80" r="20" fill="#3b82f6"/>
    <circle cx="120" cy="80" r="18" fill="#1d4ed8"/>
    {/* Pantalla reflejada en la pupila */}
    <rect x="107" y="67" width="26" height="19" rx="3" fill="#0f172a"/>
    <rect x="109" y="69" width="22" height="15" rx="2" fill="#1e40af"/>
    <rect x="111" y="71" width="14" height="2" rx="1" fill="#60a5fa" opacity="0.8"/>
    <rect x="111" y="75" width="10" height="2" rx="1" fill="#60a5fa" opacity="0.5"/>
    <rect x="111" y="79" width="12" height="2" rx="1" fill="#60a5fa" opacity="0.5"/>
    {/* Brillo del iris */}
    <circle cx="112" cy="73" r="3" fill="white" opacity="0.2"/>
    {/* Líneas de tensión (vasos) */}
    <path d="M 70 78 Q 85 75 100 78" stroke="#ef4444" strokeWidth="1" fill="none" opacity="0.7"/>
    <path d="M 73 84 Q 88 82 100 82" stroke="#ef4444" strokeWidth="0.8" fill="none" opacity="0.5"/>
    <path d="M 140 78 Q 155 75 168 78" stroke="#ef4444" strokeWidth="1" fill="none" opacity="0.7"/>
    <path d="M 140 82 Q 155 82 167 85" stroke="#ef4444" strokeWidth="0.8" fill="none" opacity="0.5"/>
    {/* Párpados */}
    <path d="M 70 80 Q 120 48 170 80" fill="#1e3a8a" stroke="none"/>
    <path d="M 70 80 Q 120 112 170 80" fill="#1e3a8a" stroke="none"/>
    {/* Pestañas superiores */}
    {[75,90,105,120,135,150,163].map((x,i)=>(
      <line key={i} x1={x} y1="80" x2={x - 2 + Math.sin(i)*4} y2="64" stroke="#1e3a8a" strokeWidth="1.5" strokeLinecap="round"/>
    ))}
    {/* Ondas de cansancio */}
    {[0,1,2].map(i=>(
      <ellipse key={i} cx="120" cy="80" rx={60+i*12} ry={42+i*8}
        fill="none" stroke="#f87171" strokeWidth="0.8" opacity={0.4-i*0.12}
        strokeDasharray="4 6"/>
    ))}
    {/* Badge CVS */}
    <rect x="174" y="16" width="52" height="22" rx="6" fill="#ef4444" opacity="0.9"/>
    <text x="200" y="31" textAnchor="middle" fontSize="9" fontWeight="bold" fill="white">CVS</text>
    {/* Gotita de lágrima */}
    <path d="M 76 96 Q 74 102 76 106 Q 78 102 76 96 Z" fill="#93c5fd" opacity="0.8"/>
  </svg>
);

const IlluRegla202020 = () => (
  <svg viewBox="0 0 240 160" className="w-full h-full" aria-hidden="true">
    <rect width="240" height="160" fill="#f0fdf4"/>
    {/* Tres círculos conectados */}
    <line x1="60" y1="80" x2="100" y2="80" stroke="#16a34a" strokeWidth="2" strokeDasharray="4 3" opacity="0.6"/>
    <line x1="140" y1="80" x2="180" y2="80" stroke="#16a34a" strokeWidth="2" strokeDasharray="4 3" opacity="0.6"/>
    {/* Círculo 1: 20 min */}
    <circle cx="50" cy="80" r="36" fill="white" stroke="#16a34a" strokeWidth="2"/>
    {/* Reloj */}
    <circle cx="50" cy="72" r="14" fill="none" stroke="#16a34a" strokeWidth="1.5"/>
    <line x1="50" y1="72" x2="50" y2="63" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="50" y1="72" x2="56" y2="76" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="50" cy="72" r="1.5" fill="#16a34a"/>
    <text x="50" y="95" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#15803d">20 min</text>
    {/* Círculo 2: ojo */}
    <circle cx="120" cy="80" r="36" fill="#dcfce7" stroke="#16a34a" strokeWidth="2"/>
    <ellipse cx="120" cy="78" rx="18" ry="11" fill="white"/>
    <circle cx="120" cy="78" r="7" fill="#16a34a"/>
    <circle cx="120" cy="78" r="4" fill="#0f4c1a"/>
    <circle cx="117" cy="75" r="2" fill="white" opacity="0.7"/>
    <path d="M 102 78 Q 120 62 138 78" fill="none" stroke="#15803d" strokeWidth="1.2"/>
    <path d="M 102 78 Q 120 94 138 78" fill="none" stroke="#15803d" strokeWidth="1.2"/>
    <text x="120" y="103" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#15803d">tus ojos</text>
    {/* Círculo 3: distancia */}
    <circle cx="190" cy="80" r="36" fill="white" stroke="#16a34a" strokeWidth="2"/>
    {/* Ventana */}
    <rect x="178" y="60" width="24" height="22" rx="2" fill="#bae6fd" stroke="#16a34a" strokeWidth="1.2"/>
    <line x1="190" y1="60" x2="190" y2="82" stroke="#16a34a" strokeWidth="0.8"/>
    <line x1="178" y1="71" x2="202" y2="71" stroke="#16a34a" strokeWidth="0.8"/>
    <circle cx="186" cy="66" r="4" fill="#fde68a" opacity="0.8"/>
    {/* Flecha distancia */}
    <line x1="178" y1="90" x2="202" y2="90" stroke="#16a34a" strokeWidth="1" strokeDasharray="3 2"/>
    <text x="190" y="102" textAnchor="middle" fontSize="8" fill="#15803d">6 m</text>
    {/* Label "20 seg" */}
    <rect x="174" y="108" width="32" height="14" rx="4" fill="#16a34a"/>
    <text x="190" y="119" textAnchor="middle" fontSize="8" fontWeight="bold" fill="white">20 seg</text>
    {/* Flechas entre círculos */}
    <polygon points="102,77 96,74 96,80" fill="#16a34a" opacity="0.7"/>
    <polygon points="138,77 144,74 144,80" fill="#16a34a" opacity="0.7"/>
  </svg>
);

const IlluSintomas = () => (
  <svg viewBox="0 0 240 160" className="w-full h-full" aria-hidden="true">
    <rect width="240" height="160" fill="#fff7ed"/>
    {/* Ojo central grande */}
    <ellipse cx="120" cy="85" rx="60" ry="38" fill="white" stroke="#d1d5db" strokeWidth="1.5"/>
    {/* Iris */}
    <circle cx="120" cy="85" r="22" fill="#fbbf24" opacity="0.8"/>
    <circle cx="120" cy="85" r="14" fill="#78350f"/>
    <circle cx="113" cy="79" r="4" fill="white" opacity="0.5"/>
    {/* Párpados */}
    <path d="M 60 85 Q 120 52 180 85" fill="#fff7ed" stroke="none"/>
    <path d="M 60 85 Q 120 118 180 85" fill="#fff7ed" stroke="none"/>
    <path d="M 60 85 Q 120 52 180 85" fill="none" stroke="#92400e" strokeWidth="1.5"/>
    <path d="M 60 85 Q 120 118 180 85" fill="none" stroke="#92400e" strokeWidth="1.5"/>
    {/* Vasos sanguíneos (rojo) */}
    <path d="M 63 82 Q 78 78 93 81" stroke="#ef4444" strokeWidth="1.2" fill="none" opacity="0.8"/>
    <path d="M 65 90 Q 80 87 90 89" stroke="#ef4444" strokeWidth="0.9" fill="none" opacity="0.6"/>
    <path d="M 148 82 Q 162 78 175 82" stroke="#ef4444" strokeWidth="1.2" fill="none" opacity="0.8"/>
    <path d="M 150 89 Q 162 87 174 90" stroke="#ef4444" strokeWidth="0.9" fill="none" opacity="0.6"/>
    {/* Lagrimón (azul) */}
    <path d="M 66 98 Q 63 108 66 115 Q 69 108 66 98Z" fill="#60a5fa" opacity="0.9"/>
    {/* Relámpago (dolor) */}
    <polygon points="155,30 148,45 156,45 149,60 163,40 154,40" fill="#f59e0b" opacity="0.9"/>
    {/* Anillo de desenfoque */}
    <ellipse cx="120" cy="85" rx="28" ry="28" fill="none" stroke="#d1d5db" strokeWidth="6" opacity="0.3"/>
    <ellipse cx="120" cy="85" rx="38" ry="34" fill="none" stroke="#d1d5db" strokeWidth="3" opacity="0.2"/>
    {/* Badge de advertencia */}
    <polygon points="200,16 208,32 192,32" fill="#ef4444"/>
    <text x="200" y="30" textAnchor="middle" fontSize="10" fontWeight="bold" fill="white">!</text>
    {/* Labels */}
    <text x="50" y="128" textAnchor="middle" fontSize="7" fill="#b91c1c">Irritación</text>
    <text x="66" y="120" textAnchor="middle" fontSize="7" fill="#2563eb">Sequedad</text>
    <text x="160" y="26" textAnchor="middle" fontSize="7" fill="#d97706">Dolor</text>
  </svg>
);

const IlluLuzAzul = () => (
  <svg viewBox="0 0 240 160" className="w-full h-full" aria-hidden="true">
    <defs>
      <linearGradient id="lb-spec" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"   stopColor="#7c3aed"/>
        <stop offset="18%"  stopColor="#4f46e5"/>
        <stop offset="36%"  stopColor="#2563eb"/>
        <stop offset="50%"  stopColor="#06b6d4"/>
        <stop offset="65%"  stopColor="#16a34a"/>
        <stop offset="80%"  stopColor="#ca8a04"/>
        <stop offset="100%" stopColor="#dc2626"/>
      </linearGradient>
    </defs>
    <rect width="240" height="160" fill="#0f0a1e"/>
    {/* Espectro */}
    <rect x="16" y="60" width="160" height="24" rx="4" fill="url(#lb-spec)"/>
    {/* Sección azul destacada */}
    <rect x="50" y="52" width="38" height="40" rx="4" fill="none" stroke="#60a5fa" strokeWidth="2" strokeDasharray="4 2"/>
    <rect x="50" y="52" width="38" height="40" rx="4" fill="#3b82f6" opacity="0.15"/>
    <text x="69" y="104" textAnchor="middle" fontSize="7" fill="#93c5fd">Alta energía</text>
    {/* Flechas de luz desde pantalla */}
    <rect x="192" y="30" width="38" height="28" rx="4" fill="#1e3a8a" stroke="#3b82f6" strokeWidth="1.5"/>
    <rect x="195" y="33" width="32" height="22" rx="2" fill="#1e40af"/>
    <rect x="198" y="36" width="18" height="2" rx="1" fill="#93c5fd" opacity="0.8"/>
    <rect x="198" y="40" width="14" height="2" rx="1" fill="#93c5fd" opacity="0.5"/>
    <rect x="198" y="44" width="16" height="2" rx="1" fill="#93c5fd" opacity="0.5"/>
    {/* Rayos de luz azul */}
    {[0,1,2,3].map(i=>(
      <line key={i} x1={192} y1={36+i*6} x2={176} y2={72} stroke="#60a5fa" strokeWidth="1" opacity={0.5-i*0.1}/>
    ))}
    {/* Ojo receptor */}
    <ellipse cx="120" cy="130" rx="32" ry="18" fill="#1e293b"/>
    <ellipse cx="120" cy="130" rx="26" ry="14" fill="white" opacity="0.9"/>
    <circle cx="120" cy="130" r="9" fill="#4f46e5"/>
    <circle cx="120" cy="130" r="5" fill="#0f0a1e"/>
    <circle cx="116" cy="127" r="2.5" fill="white" opacity="0.5"/>
    {/* Melatonina suprimida */}
    <text x="16" y="148" fontSize="7.5" fill="#a78bfa" fontWeight="500">Melatonina ↓  Circadiano afectado</text>
    {/* Luna / sueño */}
    <path d="M 210 130 Q 198 120 198 130 Q 198 140 210 130 Q 204 134 204 130 Q 204 125 210 130Z" fill="#fde68a" opacity="0.7"/>
  </svg>
);

const IlluEjercicios = () => (
  <svg viewBox="0 0 240 160" className="w-full h-full" aria-hidden="true">
    <rect width="240" height="160" fill="#ecfdf5"/>
    {/* Ojo central */}
    <ellipse cx="120" cy="80" rx="28" ry="17" fill="white" stroke="#d1d5db" strokeWidth="1.5"/>
    <circle cx="120" cy="80" r="10" fill="#0d9488"/>
    <circle cx="120" cy="80" r="6" fill="#0f172a"/>
    <circle cx="116" cy="77" r="2.5" fill="white" opacity="0.6"/>
    <path d="M 92 80 Q 120 62 148 80" fill="none" stroke="#374151" strokeWidth="1.3"/>
    <path d="M 92 80 Q 120 98 148 80" fill="none" stroke="#374151" strokeWidth="1.3"/>
    {/* Círculo de movimiento */}
    <circle cx="120" cy="80" r="46" fill="none" stroke="#0d9488" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.5"/>
    {/* Flechas del círculo */}
    <path d="M 120 34 Q 166 34 166 80" fill="none" stroke="#0d9488" strokeWidth="2" strokeLinecap="round"/>
    <polygon points="168,80 162,72 174,72" fill="#0d9488"/>
    {/* Línea horizontal */}
    <line x1="56" y1="80" x2="90" y2="80" stroke="#6366f1" strokeWidth="1.8" strokeDasharray="4 3"/>
    <line x1="150" y1="80" x2="184" y2="80" stroke="#6366f1" strokeWidth="1.8" strokeDasharray="4 3"/>
    <polygon points="56,80 64,75 64,85" fill="#6366f1" opacity="0.7"/>
    <polygon points="184,80 176,75 176,85" fill="#6366f1" opacity="0.7"/>
    {/* Línea vertical */}
    <line x1="120" y1="24" x2="120" y2="60" stroke="#f59e0b" strokeWidth="1.8" strokeDasharray="4 3"/>
    <line x1="120" y1="100" x2="120" y2="136" stroke="#f59e0b" strokeWidth="1.8" strokeDasharray="4 3"/>
    <polygon points="120,24 115,32 125,32" fill="#f59e0b" opacity="0.7"/>
    <polygon points="120,136 115,128 125,128" fill="#f59e0b" opacity="0.7"/>
    {/* Diagonales */}
    <line x1="78" y1="38" x2="105" y2="65" stroke="#ec4899" strokeWidth="1.3" strokeDasharray="3 3" opacity="0.6"/>
    <line x1="135" y1="95" x2="162" y2="122" stroke="#ec4899" strokeWidth="1.3" strokeDasharray="3 3" opacity="0.6"/>
    {/* Labels */}
    <text x="32" y="83" fontSize="7" fill="#4f46e5" fontWeight="600">Izq.</text>
    <text x="186" y="83" fontSize="7" fill="#4f46e5" fontWeight="600">Der.</text>
    <text x="113" y="19" fontSize="7" fill="#b45309" fontWeight="600">Arr.</text>
    <text x="113" y="148" fontSize="7" fill="#b45309" fontWeight="600">Abj.</text>
    <text x="170" y="22" fontSize="7" fill="#0d9488" fontWeight="600">Círculos</text>
  </svg>
);

const IlluErgonomia = () => (
  <svg viewBox="0 0 240 160" className="w-full h-full" aria-hidden="true">
    <rect width="240" height="160" fill="#fffbeb"/>
    {/* Escritorio */}
    <rect x="20" y="108" width="180" height="8" rx="3" fill="#d97706" opacity="0.8"/>
    <rect x="30" y="116" width="8" height="32" rx="2" fill="#b45309" opacity="0.7"/>
    <rect x="182" y="116" width="8" height="32" rx="2" fill="#b45309" opacity="0.7"/>
    {/* Monitor */}
    <rect x="78" y="60" width="84" height="52" rx="6" fill="#1e293b" stroke="#374151" strokeWidth="1.5"/>
    <rect x="82" y="64" width="76" height="44" rx="4" fill="#0f172a"/>
    <rect x="85" y="67" width="50" height="4" rx="1" fill="#38bdf8" opacity="0.7"/>
    <rect x="85" y="75" width="38" height="3" rx="1" fill="#60a5fa" opacity="0.5"/>
    <rect x="85" y="82" width="44" height="3" rx="1" fill="#60a5fa" opacity="0.4"/>
    <rect x="85" y="89" width="30" height="3" rx="1" fill="#60a5fa" opacity="0.4"/>
    <rect x="115" y="108" width="10" height="6" rx="1" fill="#475569"/>
    <rect x="100" y="114" width="40" height="4" rx="2" fill="#475569"/>
    {/* Persona */}
    <circle cx="44" cy="70" r="12" fill="#fde68a" stroke="#d97706" strokeWidth="1.5"/>
    {/* Cuerpo */}
    <rect x="37" y="82" width="14" height="22" rx="5" fill="#1e40af"/>
    {/* Brazo extendido */}
    <line x1="44" y1="90" x2="72" y2="100" stroke="#fde68a" strokeWidth="4" strokeLinecap="round"/>
    <line x1="44" y1="90" x2="20" y2="100" stroke="#fde68a" strokeWidth="4" strokeLinecap="round"/>
    {/* Ojos */}
    <circle cx="40" cy="68" r="2" fill="#0f172a"/>
    <circle cx="48" cy="68" r="2" fill="#0f172a"/>
    <path d="M 40 74 Q 44 77 48 74" stroke="#0f172a" strokeWidth="1" fill="none"/>
    {/* Flecha de distancia */}
    <line x1="57" y1="96" x2="77" y2="96" stroke="#16a34a" strokeWidth="1.5"/>
    <polygon points="57,96 63,92 63,100" fill="#16a34a"/>
    <polygon points="77,96 71,92 71,100" fill="#16a34a"/>
    <text x="67" y="106" textAnchor="middle" fontSize="7" fill="#15803d" fontWeight="600">50-70cm</text>
    {/* Ángulo de visión */}
    <line x1="44" y1="70" x2="78" y2="80" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="3 2" opacity="0.8"/>
    <text x="56" y="72" fontSize="6.5" fill="#b45309">10-20°</text>
    {/* Check */}
    <circle cx="210" cy="30" r="14" fill="#16a34a"/>
    <path d="M 202 30 L 208 37 L 220 22" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <text x="210" y="52" textAnchor="middle" fontSize="7" fill="#15803d" fontWeight="600">Postura ✓</text>
  </svg>
);

const IlluNutricion = () => (
  <svg viewBox="0 0 240 160" className="w-full h-full" aria-hidden="true">
    <rect width="240" height="160" fill="#f0fdf4"/>
    {/* Ojo central */}
    <circle cx="120" cy="80" r="30" fill="white" stroke="#d1d5db" strokeWidth="1.5"/>
    <circle cx="120" cy="80" r="20" fill="#16a34a" opacity="0.8"/>
    <circle cx="120" cy="80" r="11" fill="#0f172a"/>
    <circle cx="114" cy="74" r="4" fill="white" opacity="0.4"/>
    {/* Líneas de conexión */}
    {[[40,35],[200,35],[28,120],[210,120]].map(([x,y],i)=>(
      <line key={i} x1={x} y1={y} x2={120} y2={80} stroke="#16a34a" strokeWidth="1" strokeDasharray="4 3" opacity="0.4"/>
    ))}
    {/* Zanahoria */}
    <g transform="translate(20,18)">
      <path d="M 0 0 L 12 20 L -4 18 Z" fill="#f97316"/>
      <path d="M 2 -2 L 6 8" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"/>
      <path d="M 6 -4 L 8 6" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"/>
      <text x="4" y="30" fontSize="6" fill="#c2410c" fontWeight="bold">Vit. A</text>
    </g>
    {/* Pescado */}
    <g transform="translate(185,18)">
      <ellipse cx="12" cy="10" rx="14" ry="7" fill="#60a5fa"/>
      <polygon points="26,10 34,4 34,16" fill="#3b82f6"/>
      <circle cx="6" cy="8" r="2" fill="#0f172a"/>
      <text x="10" y="26" textAnchor="middle" fontSize="6" fill="#1d4ed8" fontWeight="bold">Omega-3</text>
    </g>
    {/* Arándanos */}
    <g transform="translate(10,104)">
      <circle cx="8" cy="8" r="6" fill="#6d28d9"/>
      <circle cx="18" cy="6" r="5" fill="#7c3aed"/>
      <circle cx="13" cy="16" r="5.5" fill="#5b21b6"/>
      <text x="12" y="30" textAnchor="middle" fontSize="6" fill="#4c1d95" fontWeight="bold">Antioxid.</text>
    </g>
    {/* Hoja verde */}
    <g transform="translate(194,104)">
      <path d="M 12 0 Q 24 8 16 22 Q 8 14 0 8 Q 8 2 12 0Z" fill="#16a34a"/>
      <line x1="12" y1="2" x2="10" y2="20" stroke="#15803d" strokeWidth="1" strokeLinecap="round"/>
      <text x="10" y="32" textAnchor="middle" fontSize="6" fill="#14532d" fontWeight="bold">Luteína</text>
    </g>
    {/* Badge nutrición */}
    <rect x="148" y="54" width="44" height="14" rx="4" fill="#16a34a" opacity="0.9"/>
    <text x="170" y="64" textAnchor="middle" fontSize="7" fontWeight="bold" fill="white">Nutrición ✦</text>
  </svg>
);

const IlluEspecialista = () => (
  <svg viewBox="0 0 240 160" className="w-full h-full" aria-hidden="true">
    <rect width="240" height="160" fill="#fff1f2"/>
    {/* Calendario */}
    <rect x="20" y="30" width="80" height="90" rx="8" fill="white" stroke="#fda4af" strokeWidth="2"/>
    <rect x="20" y="30" width="80" height="22" rx="8" fill="#f43f5e"/>
    <rect x="20" y="44" width="80" height="8" fill="#f43f5e"/>
    <text x="60" y="47" textAnchor="middle" fontSize="10" fontWeight="bold" fill="white">AGENDA</text>
    {/* Días del calendario */}
    {[0,1,2,3,4].map(row => [0,1,2,3].map(col => {
      const n = row*4+col+1;
      if (n > 20) return null;
      const highlighted = n === 14;
      return (
        <g key={`${row}-${col}`}>
          <rect x={26+col*18} y={58+row*12} width="14" height="10" rx="2" fill={highlighted ? '#f43f5e' : 'transparent'}/>
          <text x={33+col*18} y={67+row*12} textAnchor="middle" fontSize="7" fontWeight={highlighted ? 'bold' : 'normal'} fill={highlighted ? 'white' : '#374151'}>{n}</text>
        </g>
      );
    }))}
    {/* Cruz médica */}
    <rect x="124" y="48" width="26" height="64" rx="8" fill="#f43f5e" opacity="0.9"/>
    <rect x="110" y="62" width="54" height="36" rx="8" fill="#f43f5e" opacity="0.9"/>
    <rect x="124" y="48" width="26" height="64" rx="8" fill="#fb7185" opacity="0.3"/>
    <rect x="110" y="62" width="54" height="36" rx="8" fill="#fb7185" opacity="0.3"/>
    {/* Ojo en la cruz */}
    <ellipse cx="137" cy="80" rx="14" ry="9" fill="white" opacity="0.95"/>
    <circle cx="137" cy="80" r="6" fill="#f43f5e"/>
    <circle cx="137" cy="80" r="3.5" fill="#0f172a"/>
    <circle cx="134" cy="77" r="1.5" fill="white" opacity="0.6"/>
    {/* Estetoscopio sugerido */}
    <path d="M 185 40 Q 210 40 210 60 Q 210 80 195 80 Q 185 80 185 70" stroke="#f43f5e" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <circle cx="185" cy="40" r="5" fill="#f43f5e"/>
    <circle cx="185" cy="40" r="2.5" fill="white"/>
    <circle cx="185" cy="70" r="7" fill="#fda4af" stroke="#f43f5e" strokeWidth="1.5"/>
    <circle cx="185" cy="70" r="3" fill="#f43f5e"/>
    {/* Texto */}
    <text x="120" y="148" textAnchor="middle" fontSize="8" fill="#be123c" fontWeight="600">Revisión anual recomendada</text>
  </svg>
);

const IlluTrabajoRemoto = () => (
  <svg viewBox="0 0 240 160" className="w-full h-full" aria-hidden="true">
    <defs>
      <radialGradient id="tr-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.4"/>
        <stop offset="100%" stopColor="#4f46e5" stopOpacity="0"/>
      </radialGradient>
    </defs>
    <rect width="240" height="160" fill="#0f172a"/>
    {/* Casa */}
    <polygon points="120,18 170,52 70,52" fill="#1e293b" stroke="#334155" strokeWidth="1.5"/>
    <rect x="74" y="52" width="92" height="68" fill="#1e293b" stroke="#334155" strokeWidth="1.5"/>
    {/* Ventana */}
    <rect x="84" y="62" width="28" height="22" rx="2" fill="#1e3a8a" opacity="0.8"/>
    <line x1="98" y1="62" x2="98" y2="84" stroke="#2563eb" strokeWidth="0.8"/>
    <line x1="84" y1="73" x2="112" y2="73" stroke="#2563eb" strokeWidth="0.8"/>
    {/* Laptop */}
    <rect x="108" y="62" width="56" height="36" rx="3" fill="#334155"/>
    <rect x="111" y="65" width="50" height="30" rx="2" fill="#0f172a"/>
    {/* Pantalla con glow */}
    <rect x="113" y="67" width="46" height="26" rx="1" fill="#1e3a8a"/>
    <ellipse cx="136" cy="80" rx="18" ry="12" fill="url(#tr-glow)"/>
    <rect x="117" y="70" width="30" height="3" rx="1" fill="#60a5fa" opacity="0.6"/>
    <rect x="117" y="76" width="22" height="2" rx="1" fill="#60a5fa" opacity="0.4"/>
    <rect x="117" y="81" width="26" height="2" rx="1" fill="#60a5fa" opacity="0.4"/>
    {/* Base del laptop */}
    <rect x="104" y="98" width="64" height="5" rx="2" fill="#475569"/>
    {/* Reloj con muchas horas */}
    <circle cx="200" cy="50" r="22" fill="none" stroke="#334155" strokeWidth="2"/>
    <circle cx="200" cy="50" r="20" fill="#0f172a"/>
    <text x="200" y="45" textAnchor="middle" fontSize="8" fill="#94a3b8">HORAS</text>
    <text x="200" y="58" textAnchor="middle" fontSize="14" fontWeight="black" fill="#f43f5e">10.3</text>
    <line x1="200" y1="32" x2="200" y2="38" stroke="#64748b" strokeWidth="1.5"/>
    <line x1="200" y1="62" x2="200" y2="68" stroke="#64748b" strokeWidth="1.5"/>
    {/* Ojo cansado */}
    <ellipse cx="40" cy="110" rx="20" ry="13" fill="#1e293b" stroke="#475569" strokeWidth="1"/>
    <ellipse cx="40" cy="110" rx="16" ry="9" fill="#0f172a"/>
    <circle cx="40" cy="110" r="6" fill="#1e40af"/>
    <circle cx="40" cy="110" r="3.5" fill="#0f0a1e"/>
    <path d="M 24 106 Q 40 98 56 106" fill="none" stroke="#475569" strokeWidth="1.2"/>
    {/* Párpado caído */}
    <path d="M 24 108 Q 40 100 56 108 Q 48 104 40 104 Q 32 104 24 108 Z" fill="#1e293b" opacity="0.7"/>
    {/* ZZZ sueño */}
    <text x="58" y="100" fontSize="8" fill="#6366f1" fontWeight="bold" opacity="0.8">z</text>
    <text x="64" y="94" fontSize="9" fill="#6366f1" fontWeight="bold" opacity="0.6">z</text>
    <text x="72" y="87" fontSize="10" fill="#6366f1" fontWeight="bold" opacity="0.4">z</text>
    {/* Barra de tiempo */}
    <text x="120" y="148" textAnchor="middle" fontSize="7.5" fill="#94a3b8">+40% tiempo en pantalla post-pandemia</text>
  </svg>
);

const IlluTherapheye = () => (
  <svg viewBox="0 0 240 160" className="w-full h-full" aria-hidden="true">
    <defs>
      <radialGradient id="th-bg" cx="50%" cy="50%" r="55%">
        <stop offset="0%" stopColor="#312e81"/>
        <stop offset="100%" stopColor="#0f172a"/>
      </radialGradient>
      <radialGradient id="th-center" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#818cf8" stopOpacity="0.4"/>
        <stop offset="100%" stopColor="#818cf8" stopOpacity="0"/>
      </radialGradient>
    </defs>
    <rect width="240" height="160" fill="url(#th-bg)"/>
    {/* Glow central */}
    <circle cx="120" cy="80" r="40" fill="url(#th-center)"/>
    {/* Escudo central */}
    <path d="M 120 48 L 148 58 L 148 85 Q 148 105 120 115 Q 92 105 92 85 L 92 58 Z" fill="#4f46e5" opacity="0.9"/>
    <path d="M 120 48 L 148 58 L 148 85 Q 148 105 120 115 Q 92 105 92 85 L 92 58 Z" fill="none" stroke="#818cf8" strokeWidth="1.5"/>
    {/* Ojo dentro del escudo */}
    <ellipse cx="120" cy="82" rx="18" ry="11" fill="white" opacity="0.95"/>
    <circle cx="120" cy="82" r="8" fill="#6366f1"/>
    <circle cx="120" cy="82" r="5" fill="#0f0a1e"/>
    <circle cx="116" cy="79" r="2.5" fill="white" opacity="0.6"/>
    <path d="M 102 82 Q 120 70 138 82" fill="none" stroke="#e0e7ff" strokeWidth="1.2"/>
    <path d="M 102 82 Q 120 94 138 82" fill="none" stroke="#e0e7ff" strokeWidth="1.2"/>
    {/* Líneas de conexión */}
    {[[30,30],[210,30],[22,130],[218,130]].map(([x,y],i)=>(
      <line key={i} x1={x} y1={y} x2={x<120?92:148} y2={y<80?65:95}
        stroke="#818cf8" strokeWidth="1" strokeDasharray="4 3" opacity="0.5"/>
    ))}
    {/* Timer */}
    <rect x="12" y="16" width="42" height="30" rx="6" fill="#1e1b4b" stroke="#4f46e5" strokeWidth="1.5"/>
    <circle cx="33" cy="31" r="9" fill="none" stroke="#818cf8" strokeWidth="1.5"/>
    <line x1="33" y1="31" x2="33" y2="24" stroke="#a5b4fc" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="33" y1="31" x2="39" y2="34" stroke="#a5b4fc" strokeWidth="1.5" strokeLinecap="round"/>
    <text x="33" y="54" textAnchor="middle" fontSize="6.5" fill="#818cf8">Timer</text>
    {/* Gráfica */}
    <rect x="186" y="16" width="42" height="30" rx="6" fill="#1e1b4b" stroke="#4f46e5" strokeWidth="1.5"/>
    <polyline points="192,40 198,32 204,36 210,26 216,30 222,22" fill="none" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <text x="207" y="54" textAnchor="middle" fontSize="6.5" fill="#818cf8">Análisis</text>
    {/* Ejercicio */}
    <rect x="4" y="114" width="42" height="30" rx="6" fill="#1e1b4b" stroke="#4f46e5" strokeWidth="1.5"/>
    <circle cx="25" cy="129" r="9" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 3"/>
    <path d="M 25 120 L 25 129 L 32 129" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round"/>
    <text x="25" y="152" textAnchor="middle" fontSize="6.5" fill="#818cf8">Ejercicios</text>
    {/* Diagnóstico */}
    <rect x="194" y="114" width="42" height="30" rx="6" fill="#1e1b4b" stroke="#4f46e5" strokeWidth="1.5"/>
    <path d="M 206 129 L 210 129 L 213 122 L 216 136 L 219 126 L 222 129 L 230 129" fill="none" stroke="#f43f5e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <text x="215" y="152" textAnchor="middle" fontSize="6.5" fill="#818cf8">Diagnóstico</text>
    {/* Check en escudo */}
    <path d="M 110 82 L 117 90 L 132 72" stroke="#a5b4fc" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IlluGlaucoma = () => (
  <svg viewBox="0 0 240 160" className="w-full h-full" aria-hidden="true">
    <defs>
      <radialGradient id="gl-bg" cx="50%" cy="50%" r="55%">
        <stop offset="0%" stopColor="#1e1b4b"/>
        <stop offset="100%" stopColor="#0f0a1e"/>
      </radialGradient>
      <radialGradient id="gl-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.5"/>
        <stop offset="100%" stopColor="#7c3aed" stopOpacity="0"/>
      </radialGradient>
    </defs>
    <rect width="240" height="160" fill="url(#gl-bg)"/>
    {/* Glow */}
    <ellipse cx="80" cy="80" rx="50" ry="32" fill="url(#gl-glow)"/>
    {/* Esclerótica */}
    <ellipse cx="80" cy="80" rx="52" ry="33" fill="white" opacity="0.92"/>
    {/* Iris */}
    <circle cx="80" cy="80" r="22" fill="#6d28d9"/>
    <circle cx="80" cy="80" r="20" fill="#4c1d95"/>
    {/* Copa óptica agrandada — signo de daño */}
    <circle cx="80" cy="80" r="13" fill="#2e1065" opacity="0.95"/>
    <circle cx="80" cy="80" r="7" fill="#6d28d9" opacity="0.5"/>
    {/* Brillo iris */}
    <circle cx="72" cy="73" r="3" fill="white" opacity="0.25"/>
    {/* Párpados */}
    <path d="M 28 80 Q 80 48 132 80" fill="#0f0a1e" stroke="none"/>
    <path d="M 28 80 Q 80 112 132 80" fill="#0f0a1e" stroke="none"/>
    {/* Flechas de presión intraocular */}
    {[0,60,120,180,240,300].map((deg, i) => {
      const r = Math.PI * deg / 180;
      const x1 = 80 + Math.cos(r) * 44, y1 = 80 + Math.sin(r) * 28;
      const x2 = 80 + Math.cos(r) * 34, y2 = 80 + Math.sin(r) * 21;
      return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#f59e0b" strokeWidth="1.8" opacity="0.75" strokeLinecap="round"/>;
    })}
    {/* Label PIO */}
    <rect x="132" y="14" width="64" height="20" rx="5" fill="#7c3aed" opacity="0.9"/>
    <text x="164" y="28" textAnchor="middle" fontSize="8.5" fontWeight="bold" fill="white">PIO elevada</text>
    {/* Gráfica de barras proyección */}
    <rect x="152" y="46" width="78" height="82" rx="6" fill="#1e1b4b" stroke="#4c1d95" strokeWidth="1"/>
    <text x="191" y="62" textAnchor="middle" fontSize="6.5" fill="#a78bfa">Millones afectados</text>
    {/* Barra 2013 */}
    <rect x="161" y="102" width="14" height="18" rx="2" fill="#6d28d9"/>
    <text x="168" y="99" textAnchor="middle" fontSize="5.5" fill="#c4b5fd">64.3</text>
    <text x="168" y="130" textAnchor="middle" fontSize="5.5" fill="#c4b5fd">2013</text>
    {/* Barra 2020 */}
    <rect x="181" y="96" width="14" height="24" rx="2" fill="#7c3aed"/>
    <text x="188" y="93" textAnchor="middle" fontSize="5.5" fill="#c4b5fd">76.0</text>
    <text x="188" y="130" textAnchor="middle" fontSize="5.5" fill="#c4b5fd">2020</text>
    {/* Barra 2040 */}
    <rect x="201" y="74" width="14" height="46" rx="2" fill="#a855f7"/>
    <text x="208" y="71" textAnchor="middle" fontSize="5.5" fill="#e9d5ff">111.8</text>
    <text x="208" y="130" textAnchor="middle" fontSize="5.5" fill="#e9d5ff">2040</text>
    {/* Fuente */}
    <text x="12" y="150" fontSize="6.5" fill="#7c3aed" opacity="0.8">Tham et al. Ophthalmology 2014 · 50 estudios</text>
  </svg>
);

const IlluMiopia = () => (
  <svg viewBox="0 0 240 160" className="w-full h-full" aria-hidden="true">
    <rect width="240" height="160" fill="#f0fdf4"/>
    {/* Divisor */}
    <line x1="120" y1="10" x2="120" y2="150" stroke="#d1d5db" strokeWidth="1.5" strokeDasharray="5 3"/>
    {/* === Lado exterior (izquierdo) === */}
    {/* Sol */}
    <circle cx="55" cy="34" r="14" fill="#fbbf24" opacity="0.9"/>
    {[0,45,90,135,180,225,270,315].map((a, i) => {
      const r = a * Math.PI / 180;
      return <line key={i} x1={55+Math.cos(r)*16} y1={34+Math.sin(r)*16} x2={55+Math.cos(r)*24} y2={34+Math.sin(r)*24} stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"/>;
    })}
    {/* Árbol */}
    <rect x="44" y="82" width="7" height="28" rx="2" fill="#92400e"/>
    <ellipse cx="47" cy="74" rx="16" ry="14" fill="#16a34a"/>
    {/* Niño exterior */}
    <circle cx="95" cy="90" r="10" fill="#fde68a" stroke="#d97706" strokeWidth="1.2"/>
    <circle cx="92" cy="88" r="2" fill="#0f172a"/>
    <circle cx="98" cy="88" r="2" fill="#0f172a"/>
    <path d="M 92 95 Q 95 98 98 95" stroke="#0f172a" strokeWidth="1" fill="none"/>
    <rect x="91" y="100" width="8" height="15" rx="3" fill="#16a34a"/>
    {/* Ojo sano encima del niño */}
    <ellipse cx="95" cy="68" rx="10" ry="6" fill="white" stroke="#16a34a" strokeWidth="1.2"/>
    <circle cx="95" cy="68" r="4" fill="#16a34a"/>
    <circle cx="95" cy="68" r="2" fill="#0f172a"/>
    <text x="95" y="56" textAnchor="middle" fontSize="7" fill="#15803d" fontWeight="bold">Sano</text>
    {/* === Lado pantalla (derecho) === */}
    {/* Monitor */}
    <rect x="148" y="46" width="62" height="42" rx="4" fill="#1e293b"/>
    <rect x="152" y="50" width="54" height="34" rx="3" fill="#0f172a"/>
    <rect x="156" y="54" width="32" height="3" rx="1" fill="#60a5fa" opacity="0.7"/>
    <rect x="156" y="61" width="24" height="2" rx="1" fill="#60a5fa" opacity="0.4"/>
    <rect x="156" y="67" width="28" height="2" rx="1" fill="#60a5fa" opacity="0.4"/>
    <rect x="175" y="88" width="10" height="4" rx="1" fill="#334155"/>
    {/* Niño con gafas */}
    <circle cx="140" cy="90" r="10" fill="#fde68a" stroke="#d97706" strokeWidth="1.2"/>
    <rect x="134" y="86" width="12" height="6" rx="2" fill="none" stroke="#1d4ed8" strokeWidth="1.3"/>
    <line x1="134" y1="89" x2="130" y2="89" stroke="#1d4ed8" strokeWidth="1"/>
    <line x1="146" y1="89" x2="150" y2="89" stroke="#1d4ed8" strokeWidth="1"/>
    <path d="M 136 95 Q 140 98 143 95" stroke="#0f172a" strokeWidth="1" fill="none"/>
    <rect x="136" y="100" width="8" height="15" rx="3" fill="#1d4ed8"/>
    {/* Badge reducción */}
    <rect x="128" y="14" width="82" height="22" rx="7" fill="#16a34a"/>
    <text x="169" y="29" textAnchor="middle" fontSize="11" fontWeight="bold" fill="white">−50% miopía</text>
    {/* Etiquetas */}
    <text x="62" y="148" textAnchor="middle" fontSize="7" fill="#15803d" fontWeight="600">80 min/día exterior</text>
    <text x="175" y="148" textAnchor="middle" fontSize="7" fill="#dc2626" fontWeight="600">Solo pantallas</text>
    {/* Fuentes */}
    <text x="12" y="10" fontSize="6" fill="#6b7280">He et al. JAMA 2015 · Wu et al. Ophthalmology 2013</text>
  </svg>
);

const IlluOjoSeco = () => (
  <svg viewBox="0 0 240 160" className="w-full h-full" aria-hidden="true">
    <rect width="240" height="160" fill="#eff6ff"/>
    {/* Ojo central */}
    <ellipse cx="110" cy="85" rx="65" ry="42" fill="white" stroke="#bfdbfe" strokeWidth="1.5"/>
    {/* Capa lipídica (exterior) */}
    <ellipse cx="110" cy="85" rx="56" ry="35" fill="#dbeafe" opacity="0.45"/>
    {/* Capa acuosa */}
    <ellipse cx="110" cy="85" rx="46" ry="28" fill="#bfdbfe" opacity="0.45"/>
    {/* Iris */}
    <circle cx="110" cy="85" r="18" fill="#3b82f6" opacity="0.85"/>
    <circle cx="110" cy="85" r="12" fill="#1e40af"/>
    <circle cx="110" cy="85" r="7" fill="#0f172a"/>
    <circle cx="103" cy="79" r="3" fill="white" opacity="0.45"/>
    {/* Párpados */}
    <path d="M 45 85 Q 110 52 175 85" fill="#eff6ff" stroke="none"/>
    <path d="M 45 85 Q 110 118 175 85" fill="#eff6ff" stroke="none"/>
    <path d="M 45 85 Q 110 52 175 85" fill="none" stroke="#93c5fd" strokeWidth="1.5"/>
    <path d="M 45 85 Q 110 118 175 85" fill="none" stroke="#93c5fd" strokeWidth="1.5"/>
    {/* Flechas de evaporación */}
    {[70,93,116,139,162].map((x, i) => (
      <g key={i}>
        <line x1={x} y1={58} x2={x} y2={38} stroke="#f87171" strokeWidth="1.3" strokeDasharray="3 2" opacity="0.75"/>
        <polygon points={`${x},36 ${x-4},46 ${x+4},46`} fill="#f87171" opacity="0.75"/>
      </g>
    ))}
    <text x="110" y="26" textAnchor="middle" fontSize="7.5" fill="#dc2626" fontWeight="600">Evaporación ↑</text>
    {/* Badge prevalencia */}
    <rect x="178" y="12" width="52" height="22" rx="6" fill="#3b82f6" opacity="0.9"/>
    <text x="204" y="27" textAnchor="middle" fontSize="9" fontWeight="bold" fill="white">5–50%</text>
    {/* Leyenda capas */}
    <rect x="10" y="40" width="8" height="8" rx="2" fill="#bfdbfe" stroke="#93c5fd" strokeWidth="0.8"/>
    <text x="23" y="48" fontSize="6.5" fill="#1d4ed8">Capa lipídica</text>
    <rect x="10" y="52" width="8" height="8" rx="2" fill="#93c5fd" stroke="#60a5fa" strokeWidth="0.8"/>
    <text x="23" y="60" fontSize="6.5" fill="#1d4ed8">Capa acuosa</text>
    <rect x="10" y="64" width="8" height="8" rx="2" fill="#60a5fa" opacity="0.5"/>
    <text x="23" y="72" fontSize="6.5" fill="#1d4ed8">Capa mucosa</text>
    {/* Escalones terapéuticos DEWS II */}
    <text x="196" y="58" textAnchor="middle" fontSize="6.5" fill="#1d4ed8" fontWeight="600">DEWS II</text>
    {[0,1,2,3].map(i => (
      <rect key={i} x={178+i*9} y={118-i*10} width="9" height={42+i*10} rx="2" fill="#3b82f6" opacity={0.35+i*0.18}/>
    ))}
    <text x="198" y="148" textAnchor="middle" fontSize="6" fill="#1d4ed8">Escalones terapéuticos</text>
    {/* Badge DEWS II */}
    <rect x="10" y="130" width="62" height="16" rx="4" fill="#1d4ed8" opacity="0.85"/>
    <text x="41" y="141" textAnchor="middle" fontSize="7" fontWeight="bold" fill="white">TFOS DEWS II 2017</text>
    {/* Fuente */}
    <text x="10" y="156" fontSize="6" fill="#6b7280">Stapleton et al. · Jones et al. Ocul Surf 2017</text>
  </svg>
);

// ─── Mapa ilustración ID → componente ─────────────────────────────────────────

const ILLUSTRATIONS: Record<string, () => ReactElement> = {
  'fatiga-visual-digital':   IlluFatigaDigital,
  'regla-20-20-20':          IlluRegla202020,
  'sintomas-alerta':         IlluSintomas,
  'luz-azul-mitos':          IlluLuzAzul,
  'ejercicios-oculares':     IlluEjercicios,
  'ergonomia-visual':        IlluErgonomia,
  'nutricion-ojos':          IlluNutricion,
  'cuando-especialista':     IlluEspecialista,
  'impacto-trabajo-remoto':  IlluTrabajoRemoto,
  'glaucoma-epidemiologia':  IlluGlaucoma,
  'miopia-tiempo-exterior':  IlluMiopia,
  'ojo-seco-dews':           IlluOjoSeco,
  'por-que-therapheye':      IlluTherapheye,
};

// ─── Componente principal ─────────────────────────────────────────────────────

type Category = ArticleCategory | 'all';

interface LearnProps {
  onBack: () => void;
}

const Learn = ({ onBack }: LearnProps) => {
  const { lang } = useLanguage();
  const es = lang === 'es';

  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [activeCategory, setActiveCategory]   = useState<Category>('all');
  const [search, setSearch]                   = useState('');
  const [detailArticleIndex, setDetailArticleIndex] = useState(0);

  const filteredArticles = useMemo(() => {
    return ARTICLES.filter(a => {
      const matchesCat = activeCategory === 'all' || a.category === activeCategory;
      const q = search.toLowerCase();
      const title = es ? a.titleEs : a.titleEn;
      const summary = es ? a.summaryEs : a.summaryEn;
      const matchesSearch = !q || title.toLowerCase().includes(q) || summary.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [activeCategory, search, es]);

  const openArticle = (article: Article) => {
    setSelectedArticle(article);
    setDetailArticleIndex(ARTICLES.findIndex(a => a.id === article.id));
    window.scrollTo(0, 0);
  };

  const categories: { id: Category; labelEs: string; labelEn: string; emoji: string; activeClass: string }[] = [
    { id: 'all',        labelEs: 'Todos',       labelEn: 'All',        emoji: '🔍', activeClass: 'bg-white text-indigo-700'           },
    { id: 'ciencia',    labelEs: 'Ciencia',     labelEn: 'Science',    emoji: '🔬', activeClass: 'bg-blue-500 text-white'             },
    { id: 'habitos',    labelEs: 'Hábitos',     labelEn: 'Habits',     emoji: '🌿', activeClass: 'bg-green-500 text-white'            },
    { id: 'sintomas',   labelEs: 'Síntomas',    labelEn: 'Symptoms',   emoji: '⚠️', activeClass: 'bg-red-500 text-white'              },
    { id: 'ejercicios', labelEs: 'Ejercicios',  labelEn: 'Exercises',  emoji: '👁️', activeClass: 'bg-violet-500 text-white'           },
    { id: 'therapheye', labelEs: 'Therapheye',  labelEn: 'Therapheye', emoji: '✨', activeClass: 'bg-indigo-500 text-white'           },
  ];

  // ── Vista de detalle ────────────────────────────────────────────────────────
  if (selectedArticle) {
    const Illu = ILLUSTRATIONS[selectedArticle.id];
    const title   = es ? selectedArticle.titleEs   : selectedArticle.titleEn;
    const content = es ? selectedArticle.contentEs : selectedArticle.contentEn;
    const catMeta = CATEGORY_META[selectedArticle.category];
    const prevA = detailArticleIndex > 0                  ? ARTICLES[detailArticleIndex - 1] : null;
    const nextA = detailArticleIndex < ARTICLES.length - 1 ? ARTICLES[detailArticleIndex + 1] : null;

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header fijo del artículo */}
        <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
          <button
            onClick={() => setSelectedArticle(null)}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4"/>
            {es ? 'Volver al Centro' : 'Back to Library'}
          </button>
          <span className="text-gray-200">|</span>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${catMeta.bg} ${catMeta.color}`}>
            {es ? catMeta.labelEs : catMeta.labelEn}
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-400 ml-auto">
            <Clock className="w-3.5 h-3.5"/>
            {selectedArticle.readMinutes} {es ? 'min de lectura' : 'min read'}
          </span>
        </header>

        <div className="max-w-3xl mx-auto px-4 py-8">
          {/* Ilustración hero */}
          <div className="w-full h-52 rounded-2xl overflow-hidden mb-8 shadow-lg">
            {Illu && <Illu/>}
          </div>

          {/* Título */}
          <h1 className="text-3xl font-black text-gray-900 leading-tight mb-6">{title}</h1>

          {/* Contenido */}
          <div className="space-y-8">
            {content.map((section, i) => (
              <div key={i}>
                {section.heading && (
                  <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="w-1 h-5 bg-indigo-500 rounded-full flex-shrink-0"/>
                    {section.heading}
                  </h2>
                )}
                <p className="text-gray-600 leading-relaxed text-[15px]">{section.body}</p>
              </div>
            ))}
          </div>

          {/* Navegación prev / next */}
          <div className="flex gap-4 mt-12 pt-8 border-t border-gray-200">
            {prevA ? (
              <button
                onClick={() => openArticle(prevA)}
                className="flex-1 flex items-center gap-3 bg-white rounded-xl p-4 border border-gray-200 hover:border-indigo-300 hover:shadow-md transition text-left"
              >
                <ChevronLeft className="w-5 h-5 text-indigo-500 flex-shrink-0"/>
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">{es ? 'Anterior' : 'Previous'}</p>
                  <p className="text-sm font-semibold text-gray-700 truncate">{es ? prevA.titleEs : prevA.titleEn}</p>
                </div>
              </button>
            ) : <div className="flex-1"/>}
            {nextA ? (
              <button
                onClick={() => openArticle(nextA)}
                className="flex-1 flex items-center justify-end gap-3 bg-white rounded-xl p-4 border border-gray-200 hover:border-indigo-300 hover:shadow-md transition text-right"
              >
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">{es ? 'Siguiente' : 'Next'}</p>
                  <p className="text-sm font-semibold text-gray-700 truncate">{es ? nextA.titleEs : nextA.titleEn}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-indigo-500 flex-shrink-0"/>
              </button>
            ) : <div className="flex-1"/>}
          </div>
        </div>
      </div>
    );
  }

  // ── Vista de lista ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Banner superior */}
      <div className="invert-safe bg-[#0e1f47] px-6 py-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition text-sm mb-4"
        >
          <ArrowLeft className="w-4 h-4"/>
          Dashboard
        </button>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-6 h-6 text-indigo-400"/>
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">{es ? 'Centro de Aprendizaje' : 'Learning Center'}</h1>
            <p className="text-gray-400 text-sm mt-1 max-w-xl">
              {es
                ? 'Artículos basados en evidencia científica sobre salud visual, hábitos digitales y cómo proteger tu vista.'
                : 'Evidence-based articles on eye health, digital habits, and how to protect your vision.'}
            </p>
          </div>
        </div>

        {/* Búsqueda */}
        <div className="relative mt-5 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"/>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={es ? 'Buscar artículos…' : 'Search articles…'}
            className="w-full pl-9 pr-4 py-2.5 bg-white/10 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-400 focus:bg-white/15 transition"
          />
        </div>

        {/* Filtros de categoría — dentro del banner */}
        <div className="mt-5 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {categories.map(cat => {
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all flex-shrink-0 ${
                  active
                    ? cat.activeClass + ' shadow-lg scale-105'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white'
                }`}
              >
                <span>{cat.emoji}</span>
                {es ? cat.labelEs : cat.labelEn}
              </button>
            );
          })}
          <span className="ml-2 text-xs text-gray-500 self-center flex-shrink-0 pl-2 whitespace-nowrap">
            {filteredArticles.length} {es ? 'artículos' : 'articles'}
          </span>
        </div>
      </div>

      {/* Grid de artículos */}
      <main className="flex-1 px-6 py-6">
        {filteredArticles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <BookOpen className="w-12 h-12 mb-4 opacity-30"/>
            <p className="text-sm">{es ? 'No se encontraron artículos' : 'No articles found'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredArticles.map(article => {
              const Illu = ILLUSTRATIONS[article.id];
              const title   = es ? article.titleEs   : article.titleEn;
              const summary = es ? article.summaryEs : article.summaryEn;
              const catMeta = CATEGORY_META[article.category];

              return (
                <button
                  key={article.id}
                  onClick={() => openArticle(article)}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 text-left overflow-hidden group"
                >
                  {/* Ilustración */}
                  <div className="h-40 overflow-hidden">
                    {Illu && <Illu/>}
                  </div>

                  {/* Contenido de la tarjeta */}
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${catMeta.bg} ${catMeta.color}`}>
                        {es ? catMeta.labelEs : catMeta.labelEn}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-gray-400 ml-auto">
                        <Clock className="w-3 h-3"/>
                        {article.readMinutes} min
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-gray-800 leading-tight mb-2 line-clamp-2 group-hover:text-indigo-700 transition-colors">
                      {title}
                    </h3>
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">
                      {summary}
                    </p>
                    <div className="flex items-center gap-1 mt-3 text-indigo-600 text-xs font-semibold group-hover:gap-2 transition-all">
                      {es ? 'Leer artículo' : 'Read article'}
                      <ChevronRight className="w-3.5 h-3.5"/>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Learn;
