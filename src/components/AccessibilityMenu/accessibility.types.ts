// =========================================
// TIPOS PARA EL SISTEMA DE ACCESIBILIDAD
// =========================================

export type FontFamily = 'default' | 'Arial, sans-serif' | 'Georgia, serif' | 'Courier New, monospace' | 'Comic Sans MS, cursive' | 'OpenDyslexic, sans-serif';
export type ColorBlindMode = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia';
export type AppLanguage = 'es' | 'en';
export type { Theme } from '../../themes';

export interface AccessibilitySettings {
  // Idioma de la aplicación
  appLanguage: AppLanguage;

  // Tema visual
  theme: import('../../themes').Theme;

  // Visuales
  highContrast: boolean;
  fontSize: number;       // 75–125 → aplicado en html font-size (escala rem)
  fontFamily: FontFamily;
  zoom: number;           // 80–150 → body.style.zoom
  invertColors: boolean;
  visualIndicators: boolean;
  colorBlindMode: ColorBlindMode;

  // Lectura y navegación
  screenReader: boolean;
  readingGuide: boolean;
  readAloud: boolean;

  // Motoras y físicas
  onScreenKeyboard: boolean;
  bigCursor: boolean;
  highlightLinks: boolean;
  focusMode: boolean;
  simplifiedMenus: boolean;
}

export const defaultSettings: AccessibilitySettings = {
  appLanguage: 'es',
  theme: 'limpio',
  highContrast: false,
  fontSize: 100,
  fontFamily: 'default',
  zoom: 100,
  invertColors: false,
  visualIndicators: false,
  colorBlindMode: 'none',
  screenReader: false,
  readingGuide: false,
  readAloud: false,
  onScreenKeyboard: false,
  bigCursor: false,
  highlightLinks: false,
  focusMode: false,
  simplifiedMenus: false,
};
