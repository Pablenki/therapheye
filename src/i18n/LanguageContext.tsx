// =========================================
// CONTEXTO DE IDIOMA - LanguageContext
// Lee appLanguage de localStorage (compartido con AccessibilityMenu)
// Provee t() para traducir cadenas
// =========================================

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import translations, { type Lang } from './translations';

const STORAGE_KEY = 'therapeye_accessibility_settings';

type TranslationValue = { es: string; en: string } | { es: string[]; en: string[] };

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (section: string, key: string) => string;
  tArray: (section: string, key: string) => string[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Detecta idioma del navegador/SO como fallback
const detectBrowserLang = (): Lang => {
  try {
    const browserLang = navigator.language || (navigator as any).userLanguage || '';
    if (browserLang.startsWith('en')) return 'en';
  } catch { /* noop */ }
  return 'es';
};

// Lee el idioma actual desde la configuración de accesibilidad en localStorage
// Si no hay configuración guardada, detecta el idioma del navegador
const readLangFromStorage = (): Lang => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.appLanguage === 'en') return 'en';
      if (parsed.appLanguage === 'es') return 'es';
      // Si hay settings pero no tiene appLanguage, detectar del navegador
      return detectBrowserLang();
    }
  } catch { /* noop */ }
  // Primera visita (sin settings) → detectar idioma del navegador/SO
  return detectBrowserLang();
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(readLangFromStorage);

  // Escuchar cambios en localStorage (para sincronizar con AccessibilityMenu)
  useEffect(() => {
    const handleStorageChange = () => {
      setLangState(readLangFromStorage());
    };

    // Poll localStorage cada 500ms para detectar cambios del menú de accesibilidad
    const interval = setInterval(handleStorageChange, 500);

    // También escuchar el evento storage (para cambios de otras pestañas)
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    // Actualizar también en localStorage de accesibilidad
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const settings = raw ? JSON.parse(raw) : {};
      settings.appLanguage = newLang;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch { /* noop */ }
  }, []);

  // Función de traducción: t('section', 'key') → string
  const t = useCallback((section: string, key: string): string => {
    try {
      const sectionObj = (translations as Record<string, Record<string, TranslationValue>>)[section];
      if (!sectionObj) return `[${section}.${key}]`;
      const entry = sectionObj[key];
      if (!entry) return `[${section}.${key}]`;
      const val = (entry as Record<string, unknown>)[lang];
      if (typeof val === 'string') return val;
      if (Array.isArray(val)) return val.join(', ');
      return `[${section}.${key}]`;
    } catch {
      return `[${section}.${key}]`;
    }
  }, [lang]);

  // Para arrays de pasos
  const tArray = useCallback((section: string, key: string): string[] => {
    try {
      const sectionObj = (translations as Record<string, Record<string, TranslationValue>>)[section];
      if (!sectionObj) return [];
      const entry = sectionObj[key];
      if (!entry) return [];
      const val = (entry as Record<string, unknown>)[lang];
      if (Array.isArray(val)) return val as string[];
      return [];
    } catch {
      return [];
    }
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, tArray }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used inside LanguageProvider');
  }
  return context;
};
