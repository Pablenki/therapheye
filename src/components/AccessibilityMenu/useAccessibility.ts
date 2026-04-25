// =========================================
// HOOK DE ACCESIBILIDAD - useAccessibility
// Lógica completa del sistema de accesibilidad
// IMPORTANTE: Filtros CSS van en #root, no en body
// =========================================

import { useState, useEffect, useCallback } from 'react';
import type { AccessibilitySettings } from './accessibility.types';
import { defaultSettings } from './accessibility.types';
import { THEMES } from '../../themes';

const STORAGE_KEY = 'therapeye_accessibility_settings';

export const useAccessibility = () => {
  const [settings, setSettings] = useState<AccessibilitySettings>(defaultSettings);
  const [isOpen, setIsOpen] = useState(false);

  // ==================== CARGAR CONFIGURACIÓN GUARDADA ====================
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({ ...defaultSettings, ...parsed });
      } catch (error) {
        console.error('Error cargando configuración:', error);
      }
    }
  }, []);

  // ==================== GUARDAR CONFIGURACIÓN ====================
  const saveSettings = useCallback((newSettings: AccessibilitySettings) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
  }, []);

  // ==================== APLICAR CONFIGURACIÓN AL DOM ====================
  useEffect(() => {
    const body = document.body;
    const root = document.getElementById('root');

    // ===== Clases en BODY (NO usan filter) =====

    // Tamaño de letra — escala SOLO las clases de texto Tailwind via CSS var
    // Esto NO afecta iconos, padding, ni layout (a diferencia de html font-size)
    document.documentElement.style.removeProperty('font-size');
    document.documentElement.style.setProperty(
      '--a11y-text-scale',
      String(settings.fontSize / 100)
    );

    // Tipo de fuente
    if (settings.fontFamily === 'default') {
      body.style.fontFamily = '';
    } else {
      body.style.fontFamily = settings.fontFamily;
    }

    // Zoom
    body.style.zoom = `${settings.zoom}%`;

    // Indicadores visuales
    body.classList.toggle('visual-indicators', settings.visualIndicators);

    // Cursor grande
    body.classList.toggle('big-cursor', settings.bigCursor);

    // Resaltar enlaces
    body.classList.toggle('highlight-links', settings.highlightLinks);

    // Modo foco
    body.classList.toggle('focus-mode', settings.focusMode);

    // ===== Clases en #ROOT (SÍ usan filter) =====
    // Esto evita que filter rompa position:fixed del menú de accesibilidad
    if (root) {
      // Alto contraste
      root.classList.toggle('high-contrast', settings.highContrast);

      // Inversión de colores
      root.classList.toggle('invert-colors', settings.invertColors);

      // Modo daltonismo
      root.classList.remove(
        'colorblind-protanopia',
        'colorblind-deuteranopia',
        'colorblind-tritanopia',
        'colorblind-achromatopsia'
      );
      if (settings.colorBlindMode !== 'none') {
        root.classList.add(`colorblind-${settings.colorBlindMode}`);
      }
    }

    // Tema visual — CSS variable para el sidebar + evento para Dashboard
    const themeConfig = THEMES[settings.theme] ?? THEMES.colorido;
    document.documentElement.style.setProperty('--sidebar-bg', themeConfig.sidebarColor);

    saveSettings(settings);
    window.dispatchEvent(new CustomEvent('therapheye-theme-changed'));
  }, [settings, saveSettings]);

  // ==================== FUNCIONES DE ACTUALIZACIÓN ====================
  const updateSetting = useCallback(<K extends keyof AccessibilitySettings>(
    key: K,
    value: AccessibilitySettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const toggleSetting = useCallback((key: keyof AccessibilitySettings) => {
    setSettings(prev => ({ 
      ...prev, 
      [key]: !(prev[key] as boolean) 
    }));
  }, []);

  // ==================== ZOOM de página (80–150%) ====================
  const zoomIn = useCallback(() => {
    setSettings(prev => ({ ...prev, zoom: Math.min(prev.zoom + 10, 150) }));
  }, []);

  const zoomOut = useCallback(() => {
    setSettings(prev => ({ ...prev, zoom: Math.max(prev.zoom - 10, 80) }));
  }, []);

  const zoomReset = useCallback(() => {
    setSettings(prev => ({ ...prev, zoom: 100 }));
  }, []);

  // ==================== TAMAÑO DE LETRA (80–180%) ====================
  const setFontSize = useCallback((value: number) => {
    setSettings(prev => ({
      ...prev,
      fontSize: Math.min(Math.max(Math.round(value), 80), 180),
    }));
  }, []);

  // ==================== LECTURA EN VOZ ALTA ====================
  useEffect(() => {
    if (!settings.readAloud) {
      // Detener cualquier lectura en curso
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      document.removeEventListener('click', handleReadAloudClick);
      return;
    }

    // Verificar soporte
    if (!('speechSynthesis' in window)) {
      alert('❌ Tu navegador no soporta síntesis de voz.');
      setSettings(prev => ({ ...prev, readAloud: false }));
      return;
    }

    document.addEventListener('click', handleReadAloudClick);
    return () => {
      document.removeEventListener('click', handleReadAloudClick);
    };
  }, [settings.readAloud]);

  const handleReadAloudClick = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // No leer el menú de accesibilidad
    if (target.closest('.accessibility-menu')) return;

    let texto = '';

    // INPUTS Y TEXTAREAS
    if (target.matches('input, textarea')) {
      const input = target as HTMLInputElement;
      const label = document.querySelector(`label[for="${input.id}"]`) as HTMLElement;
      
      if (label) texto += label.textContent?.trim() + '. ';
      if (input.placeholder) texto += input.placeholder + '. ';
      
      if (input.value?.trim()) {
        texto += 'Valor actual: ' + input.value;
      } else {
        texto += 'Campo vacío';
      }
    }
    // SELECT
    else if (target.matches('select')) {
      const select = target as HTMLSelectElement;
      const label = document.querySelector(`label[for="${select.id}"]`) as HTMLElement;
      
      if (label) texto += label.textContent?.trim() + '. ';
      
      const selectedOption = select.options[select.selectedIndex];
      if (selectedOption) {
        texto += 'Opción seleccionada: ' + selectedOption.textContent?.trim();
      }
    }
    // BOTONES E ICONOS
    else if (target.matches('button, a')) {
      texto = target.getAttribute('aria-label') || 
             target.getAttribute('title') || 
             target.textContent?.trim() ||
             'Botón o enlace';
    }
    // TEXTO GENERAL
    else if (target.matches('p, h1, h2, h3, h4, h5, h6, li, span, div, label')) {
      texto = target.textContent?.trim() || '';
    }

    if (texto) {
      speakText(texto);
      
      // Resaltar elemento
      const originalBg = target.style.backgroundColor;
      target.style.backgroundColor = 'rgba(100, 200, 255, 0.3)';
      target.style.transition = 'background-color 0.2s';
      
      setTimeout(() => {
        target.style.backgroundColor = originalBg;
      }, 2000);
    }
  }, []);

  const speakText = (texto: string) => {
    if (!('speechSynthesis' in window)) {
      console.error('❌ speechSynthesis no disponible');
      return;
    }
    
    // IMPORTANTE: Cancelar lecturas previas
    window.speechSynthesis.cancel();
    
    // Pequeño delay para asegurar que se canceló
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(texto);
      
      // FORZAR español
      utterance.lang = 'es-MX';
      utterance.rate = 0.85;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      // Obtener voces disponibles
      let voces = window.speechSynthesis.getVoices();
      
      // Función para encontrar y usar voz en español
      const usarVozEspanol = () => {
        voces = window.speechSynthesis.getVoices();
        
        if (voces.length === 0) {
          console.warn('⚠️ No hay voces disponibles todavía');
          return;
        }
        
        console.log('🔊 Todas las voces:', voces.map(v => `${v.name} [${v.lang}]`));
        
        // Buscar voz en español (orden de prioridad)
        const vozEspanol = 
          voces.find(v => v.lang === 'es-MX') ||           // México
          voces.find(v => v.lang === 'es-US') ||           // US Español
          voces.find(v => v.lang === 'es-419') ||          // Latinoamérica
          voces.find(v => v.lang.startsWith('es-') && 
                         !v.lang.includes('ES')) ||        // Cualquier español NO de España
          voces.find(v => v.lang.startsWith('es')) ||      // Cualquier español
          voces.find(v => v.name.toLowerCase().includes('spanish')) || // Nombre incluye "spanish"
          voces.find(v => v.name.toLowerCase().includes('español'));   // Nombre incluye "español"
        
        if (vozEspanol) {
          utterance.voice = vozEspanol;
          console.log('✅ VOZ SELECCIONADA:', vozEspanol.name, `[${vozEspanol.lang}]`);
        } else {
          console.warn('⚠️ NO SE ENCONTRÓ VOZ EN ESPAÑOL - Usando voz por defecto');
          console.warn('💡 Instala voces en español en tu sistema operativo');
        }
        
        // Hablar
        window.speechSynthesis.speak(utterance);
      };
      
      // Si ya hay voces, usar inmediatamente
      if (voces.length > 0) {
        usarVozEspanol();
      } else {
        // Esperar a que se carguen las voces
        console.log('⏳ Esperando a que se carguen las voces...');
        window.speechSynthesis.onvoiceschanged = () => {
          usarVozEspanol();
          window.speechSynthesis.onvoiceschanged = null; // Limpiar evento
        };
      }
    }, 100);
  };

  // ==================== GUÍA DE LECTURA ====================
  useEffect(() => {
    if (!settings.readingGuide) {
      const guide = document.getElementById('reading-guide');
      if (guide) guide.remove();
      return;
    }

    // Crear guía de lectura
    let guide = document.getElementById('reading-guide') as HTMLDivElement;
    if (!guide) {
      guide = document.createElement('div');
      guide.id = 'reading-guide';
      guide.style.cssText = `
        position: fixed;
        left: 0;
        right: 0;
        height: 2px;
        background: rgba(27, 57, 107, 0.8);
        pointer-events: none;
        z-index: 9998;
        box-shadow: 0 0 10px rgba(27, 57, 107, 0.5);
      `;
      document.body.appendChild(guide);
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (guide) {
        guide.style.top = `${e.clientY}px`;
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [settings.readingGuide]);

  // ==================== MODO NOCTURNO PROGRAMADO ====================
  useEffect(() => {
    if (!settings.darkScheduleEnabled) return;

    const checkSchedule = () => {
      const now   = new Date();
      const hhmm  = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      const from  = settings.darkScheduleFrom;
      const to    = settings.darkScheduleTo;
      // Handles overnight range (e.g. 21:00 → 07:00)
      const isNight = from > to
        ? hhmm >= from || hhmm < to
        : hhmm >= from && hhmm < to;
      setSettings(prev => {
        const wantsDark = isNight;
        if (wantsDark && prev.theme !== 'oscuro')  return { ...prev, theme: 'oscuro' };
        if (!wantsDark && prev.theme === 'oscuro') return { ...prev, theme: 'limpio' };
        return prev;
      });
    };

    checkSchedule();
    const id = setInterval(checkSchedule, 60_000);
    return () => clearInterval(id);
  }, [settings.darkScheduleEnabled, settings.darkScheduleFrom, settings.darkScheduleTo]);

  // ==================== APLICAR CONFIGURACIÓN EN BULK ====================
  const applyBulkSettings = useCallback((partial: Partial<AccessibilitySettings>) => {
    setSettings(prev => ({ ...prev, ...partial }));
  }, []);

  // ==================== RESETEAR ====================
  const resetSettings = useCallback(() => {
    setSettings(defaultSettings);
    localStorage.removeItem(STORAGE_KEY);
    
    // Detener lectura en voz alta
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // Restaurar sidebar color por default
    document.documentElement.style.setProperty('--sidebar-bg', THEMES.colorido.sidebarColor);
    window.dispatchEvent(new CustomEvent('therapheye-theme-changed'));

    // Limpiar clases de #root al resetear
    const root = document.getElementById('root');
    if (root) {
      root.classList.remove(
        'high-contrast',
        'invert-colors',
        'colorblind-protanopia',
        'colorblind-deuteranopia',
        'colorblind-tritanopia',
        'colorblind-achromatopsia'
      );
    }
  }, []);

  return {
    settings,
    isOpen,
    setIsOpen,
    updateSetting,
    toggleSetting,
    zoomIn,
    zoomOut,
    zoomReset,
    setFontSize,
    resetSettings,
    applyBulkSettings,
  };
};
