// =========================================
// TIPOS PARA EL SISTEMA DE ACCESIBILIDAD
// =========================================

export type TextSize = 'small' | 'normal' | 'large';
export type FontFamily = 'default' | 'Arial, sans-serif' | 'Georgia, serif' | 'Courier New, monospace' | 'Comic Sans MS, cursive' | 'OpenDyslexic, sans-serif';
export type ColorBlindMode = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia';

export interface AccessibilitySettings {
  // Visuales
  highContrast: boolean;
  textSize: TextSize;
  fontFamily: FontFamily;
  zoom: number;
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
  highContrast: false,
  textSize: 'normal',
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