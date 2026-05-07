// =========================================
// COMPONENTE MENÚ DE ACCESIBILIDAD
// Sistema completo de accesibilidad visual
// Usa React Portal → renderiza en #a11y-portal fuera de #root
// =========================================

import { useState, useEffect } from 'react';
import { useAccessibility } from './useAccessibility';
import { createPortal } from 'react-dom';
import { X, Eye, Volume2, MousePointer, Globe, Palette, Sparkles } from 'lucide-react';
import { useLanguage } from '../../i18n';
import type { FontFamily, ColorBlindMode, AppLanguage } from './accessibility.types';
import { THEMES } from '../../themes';
import type { Theme } from '../../themes';
import AIConfigWizard from './AIConfigWizard';

const AccessibilityMenu = () => {
  const {
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
  } = useAccessibility();
  const { t } = useLanguage();
  const [showWizard, setShowWizard] = useState(false);

  // Escuchar evento desde la sidebar para abrir el panel
  useEffect(() => {
    const handler = () => setIsOpen(v => !v);
    window.addEventListener('therapheye-open-accessibility', handler);
    return () => window.removeEventListener('therapheye-open-accessibility', handler);
  }, [setIsOpen]);

  const portalTarget = document.getElementById('a11y-portal') || document.body;

  const menu = createPortal(
    <div
      className="accessibility-menu fixed bottom-5 right-5 z-[9999]"
      style={settings.invertColors ? { filter: 'invert(1) hue-rotate(180deg)' } : undefined}
    >
      {/* Panel desplegable — se activa desde la sidebar */}
      <div
        className={`absolute bottom-0 right-0 w-[350px] bg-white rounded-2xl shadow-2xl
                   transition-all duration-300 max-h-[600px] overflow-y-auto
                   ${isOpen
                     ? 'opacity-100 visible translate-y-0 scale-100'
                     : 'opacity-0 invisible translate-y-5 scale-90'}`}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 bg-gradient-to-r from-[#1B396B] to-[#003875]
                       text-white rounded-t-2xl sticky top-0 z-10">
          <h3 className="text-lg font-semibold">{t('accessibility', 'title')}</h3>
          <button
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full
                     hover:bg-white/20 transition-colors"
            aria-label={t('accessibility', 'closeMenu')}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-5">

          {/* ========== BOTÓN IA ========== */}
          <button
            onClick={() => setShowWizard(true)}
            className="w-full mb-5 py-3 px-4 bg-gradient-to-r from-[#1B396B] to-[#4f46e5] text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-md"
          >
            <Sparkles className="w-4 h-4 text-yellow-300" />
            {settings.appLanguage === 'es' ? 'Configurar con IA' : 'Configure with AI'}
          </button>

          {/* ========== 0. IDIOMA ========== */}
          <div className="mb-6 pb-5 border-b-2 border-gray-200">
            <h4 className="text-base font-bold text-[#1B396B] mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5" />
              {t('accessibility', 'language')}
            </h4>
            <div className="flex gap-2">
              {(['es', 'en'] as AppLanguage[]).map(lang => (
                <button
                  key={lang}
                  onClick={() => updateSetting('appLanguage', lang)}
                  className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-semibold transition
                    ${settings.appLanguage === lang
                      ? 'bg-[#1B396B] text-white border-[#1B396B]'
                      : 'bg-white text-[#1B396B] border-[#1B396B]/30 hover:border-[#1B396B]'}`}
                >
                  {lang === 'es' ? '🇲🇽 Español' : '🇺🇸 English'}
                </button>
              ))}
            </div>
          </div>

          {/* ========== 1. TEMA VISUAL ========== */}
          <div className="mb-6 pb-5 border-b-2 border-gray-200">
            <h4 className="text-base font-bold text-[#1B396B] mb-4 flex items-center gap-2">
              <Palette className="w-5 h-5" />
              {settings.appLanguage === 'es' ? 'Tema Visual' : 'Visual Theme'}
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(THEMES) as [Theme, typeof THEMES[Theme]][]).map(([key, cfg]) => {
                const active = settings.theme === key;
                return (
                  <button
                    key={key}
                    onClick={() => updateSetting('theme', key)}
                    className={`relative rounded-xl p-3 text-left border-2 transition-all
                      ${active
                        ? 'border-[#1B396B] bg-[#1B396B]/5 shadow-md'
                        : 'border-gray-200 hover:border-[#1B396B]/40 bg-white'}`}
                  >
                    {/* Swatches de color */}
                    <div className="flex gap-1 mb-2">
                      {cfg.previewColors.map((color, i) => (
                        <div
                          key={i}
                          className="w-5 h-5 rounded-full flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <p className="text-xs font-bold text-gray-800 leading-tight">
                      {cfg.emoji} {settings.appLanguage === 'es' ? cfg.labelEs : cfg.labelEn}
                    </p>
                    {active && (
                      <div className="absolute top-2 right-2 w-4 h-4 bg-[#1B396B] rounded-full flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ========== 2. VISUALES ========== */}
          <div className="mb-6 pb-5 border-b-2 border-gray-200">
            <h4 className="text-base font-bold text-[#1B396B] mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5" />
              {t('accessibility', 'visuals')}
            </h4>

            {/* Alto Contraste */}
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-gray-700">{t('accessibility', 'highContrast')}</span>
              <label className="relative inline-block w-[50px] h-[26px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.highContrast}
                  onChange={() => toggleSetting('highContrast')}
                  className="sr-only peer"
                />
                <div className="w-full h-full bg-gray-300 rounded-full peer-checked:bg-[#1B396B] 
                               transition-colors duration-300">
                  <div className="absolute top-[3px] left-[3px] w-5 h-5 bg-white rounded-full 
                                transition-transform duration-300 peer-checked:translate-x-6" />
                </div>
              </label>
            </div>

            {/* Tamaño de Letra — solo escala texto, no iconos ni layout */}
            <div className="mb-3">
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-medium text-gray-700">{t('accessibility', 'fontSize')}</label>
                <div className="flex items-center gap-1.5">
                  {settings.fontSize !== 100 && (
                    <button
                      onClick={() => setFontSize(100)}
                      className="text-xs text-gray-400 hover:text-gray-600 underline"
                    >
                      {t('common', 'reset')}
                    </button>
                  )}
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md
                    ${settings.fontSize === 100 ? 'bg-gray-100 text-gray-600' : 'bg-[#1B396B] text-white'}`}>
                    {settings.fontSize}%
                  </span>
                </div>
              </div>
              <input
                type="range"
                min={80} max={180} step={10}
                value={settings.fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer mb-1"
                style={{
                  background: `linear-gradient(to right, #1B396B ${((settings.fontSize - 80) / 100) * 100}%, #e5e7eb ${((settings.fontSize - 80) / 100) * 100}%)`
                }}
                aria-label={t('accessibility', 'fontSize')}
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span style={{ fontSize: '9px' }}>A</span>
                <span className="text-xs">80% · 100% · 140% · 180%</span>
                <span style={{ fontSize: '16px' }}>A</span>
              </div>
            </div>

            {/* Tipo de Fuente */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('accessibility', 'fontFamily')}
              </label>
              <select
                value={settings.fontFamily}
                onChange={(e) => updateSetting('fontFamily', e.target.value as FontFamily)}
                className="w-full p-2 border-2 border-[#1B396B] rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#1B396B]/30"
              >
                <option value="default">{t('accessibility', 'fontDefault')}</option>
                <option value="Arial, sans-serif">Arial</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="Courier New, monospace">Courier New</option>
                <option value="Comic Sans MS, cursive">Comic Sans</option>
                <option value="OpenDyslexic, sans-serif">{t('accessibility', 'fontDyslexia')}</option>
              </select>
            </div>

            {/* Zoom de página */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('accessibility', 'screenZoom')}
              </label>
              <div className="flex gap-2">
                <button onClick={zoomOut}
                  className="flex-1 py-2 px-3 rounded-lg border-2 border-[#1B396B] bg-white text-[#1B396B] font-semibold hover:bg-[#1B396B] hover:text-white transition-all duration-200">
                  −
                </button>
                <button onClick={zoomReset}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 font-semibold transition-all duration-200
                    ${settings.zoom === 100
                      ? 'bg-[#1B396B] text-white border-[#1B396B]'
                      : 'bg-white text-[#1B396B] border-[#1B396B] hover:bg-[#1B396B] hover:text-white'}`}>
                  {settings.zoom}%
                </button>
                <button onClick={zoomIn}
                  className="flex-1 py-2 px-3 rounded-lg border-2 border-[#1B396B] bg-white text-[#1B396B] font-semibold hover:bg-[#1B396B] hover:text-white transition-all duration-200">
                  +
                </button>
              </div>
            </div>

            {/* Invertir Colores */}
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-gray-700">{t('accessibility', 'invertColors')}</span>
              <label className="relative inline-block w-[50px] h-[26px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.invertColors}
                  onChange={() => toggleSetting('invertColors')}
                  className="sr-only peer"
                />
                <div className="w-full h-full bg-gray-300 rounded-full peer-checked:bg-[#1B396B] 
                               transition-colors duration-300">
                  <div className="absolute top-[3px] left-[3px] w-5 h-5 bg-white rounded-full 
                                transition-transform duration-300 peer-checked:translate-x-6" />
                </div>
              </label>
            </div>

            {/* Modo Daltonismo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('accessibility', 'colorBlindMode')}
              </label>
              <select
                value={settings.colorBlindMode}
                onChange={(e) => updateSetting('colorBlindMode', e.target.value as ColorBlindMode)}
                className="w-full p-2 border-2 border-[#1B396B] rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#1B396B]/30"
              >
                <option value="none">{t('accessibility', 'cbNone')}</option>
                <option value="protanopia">{t('accessibility', 'cbProtanopia')}</option>
                <option value="deuteranopia">{t('accessibility', 'cbDeuteranopia')}</option>
                <option value="tritanopia">{t('accessibility', 'cbTritanopia')}</option>
                <option value="achromatopsia">{t('accessibility', 'cbAchromatopsia')}</option>
              </select>
            </div>
          </div>

          {/* ========== 3. LECTURA Y NAVEGACIÓN ========== */}
          <div className="mb-6 pb-5 border-b-2 border-gray-200">
            <h4 className="text-base font-bold text-[#1B396B] mb-4 flex items-center gap-2">
              <Volume2 className="w-5 h-5" />
              {t('accessibility', 'readingNav')}
            </h4>

            {/* Guía de Lectura */}
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-gray-700">{t('accessibility', 'readingGuide')}</span>
              <label className="relative inline-block w-[50px] h-[26px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.readingGuide}
                  onChange={() => toggleSetting('readingGuide')}
                  className="sr-only peer"
                />
                <div className="w-full h-full bg-gray-300 rounded-full peer-checked:bg-[#1B396B] 
                               transition-colors duration-300">
                  <div className="absolute top-[3px] left-[3px] w-5 h-5 bg-white rounded-full 
                                transition-transform duration-300 peer-checked:translate-x-6" />
                </div>
              </label>
            </div>

            {/* Lectura en Voz Alta */}
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-gray-700">{t('accessibility', 'readAloud')}</span>
              <label className="relative inline-block w-[50px] h-[26px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.readAloud}
                  onChange={() => toggleSetting('readAloud')}
                  className="sr-only peer"
                />
                <div className="w-full h-full bg-gray-300 rounded-full peer-checked:bg-[#1B396B] 
                               transition-colors duration-300">
                  <div className="absolute top-[3px] left-[3px] w-5 h-5 bg-white rounded-full 
                                transition-transform duration-300 peer-checked:translate-x-6" />
                </div>
              </label>
            </div>

            {/* Indicadores Visuales */}
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">{t('accessibility', 'visualIndicators')}</span>
              <label className="relative inline-block w-[50px] h-[26px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.visualIndicators}
                  onChange={() => toggleSetting('visualIndicators')}
                  className="sr-only peer"
                />
                <div className="w-full h-full bg-gray-300 rounded-full peer-checked:bg-[#1B396B] 
                               transition-colors duration-300">
                  <div className="absolute top-[3px] left-[3px] w-5 h-5 bg-white rounded-full 
                                transition-transform duration-300 peer-checked:translate-x-6" />
                </div>
              </label>
            </div>
          </div>

          {/* ========== 4. MOTORAS Y FÍSICAS ========== */}
          <div className="mb-6 pb-5 border-b-2 border-gray-200">
            <h4 className="text-base font-bold text-[#1B396B] mb-4 flex items-center gap-2">
              <MousePointer className="w-5 h-5" />
              {t('accessibility', 'motorPhysical')}
            </h4>

            {/* Cursor Grande */}
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-gray-700">{t('accessibility', 'bigCursor')}</span>
              <label className="relative inline-block w-[50px] h-[26px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.bigCursor}
                  onChange={() => toggleSetting('bigCursor')}
                  className="sr-only peer"
                />
                <div className="w-full h-full bg-gray-300 rounded-full peer-checked:bg-[#1B396B] 
                               transition-colors duration-300">
                  <div className="absolute top-[3px] left-[3px] w-5 h-5 bg-white rounded-full 
                                transition-transform duration-300 peer-checked:translate-x-6" />
                </div>
              </label>
            </div>

            {/* Resaltar Enlaces */}
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-gray-700">{t('accessibility', 'highlightLinks')}</span>
              <label className="relative inline-block w-[50px] h-[26px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.highlightLinks}
                  onChange={() => toggleSetting('highlightLinks')}
                  className="sr-only peer"
                />
                <div className="w-full h-full bg-gray-300 rounded-full peer-checked:bg-[#1B396B] 
                               transition-colors duration-300">
                  <div className="absolute top-[3px] left-[3px] w-5 h-5 bg-white rounded-full 
                                transition-transform duration-300 peer-checked:translate-x-6" />
                </div>
              </label>
            </div>

            {/* Modo Foco */}
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">{t('accessibility', 'focusMode')}</span>
              <label className="relative inline-block w-[50px] h-[26px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.focusMode}
                  onChange={() => toggleSetting('focusMode')}
                  className="sr-only peer"
                />
                <div className="w-full h-full bg-gray-300 rounded-full peer-checked:bg-[#1B396B] 
                               transition-colors duration-300">
                  <div className="absolute top-[3px] left-[3px] w-5 h-5 bg-white rounded-full 
                                transition-transform duration-300 peer-checked:translate-x-6" />
                </div>
              </label>
            </div>
          </div>

          {/* ── Modo nocturno programado ───────────────────────────────────── */}
          <div className="border-t pt-4">
            <p className="text-xs font-bold uppercase text-gray-500 tracking-wider mb-3">🌙 Modo Nocturno Automático</p>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">Activar programación</span>
              <label className="relative inline-block w-14 h-7 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.darkScheduleEnabled}
                  onChange={() => toggleSetting('darkScheduleEnabled')}
                  className="sr-only peer"
                />
                <div className="w-full h-full bg-gray-300 rounded-full peer-checked:bg-[#1B396B] transition-colors duration-300">
                  <div className="absolute top-[3px] left-[3px] w-5 h-5 bg-white rounded-full transition-transform duration-300 peer-checked:translate-x-6"/>
                </div>
              </label>
            </div>
            {settings.darkScheduleEnabled && (
              <div className="flex gap-3 text-sm">
                <label className="flex-1">
                  <span className="text-xs text-gray-500 block mb-1">Oscurecer desde</span>
                  <input
                    type="time"
                    value={settings.darkScheduleFrom}
                    onChange={e => updateSetting('darkScheduleFrom', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="flex-1">
                  <span className="text-xs text-gray-500 block mb-1">Aclarar desde</span>
                  <input
                    type="time"
                    value={settings.darkScheduleTo}
                    onChange={e => updateSetting('darkScheduleTo', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                  />
                </label>
              </div>
            )}
          </div>

          {/* ========== MONITOR DE DISTANCIA ========== */}
          <div className="mb-5 pb-5 border-b-2 border-gray-200">
            <h4 className="text-base font-bold text-[#1B396B] mb-3 flex items-center gap-2">
              <Eye className="w-5 h-5" />
              {settings.appLanguage === 'es' ? 'Monitor de Distancia' : 'Distance Monitor'}
            </h4>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-700">
                  {settings.appLanguage === 'es' ? 'Activar monitor de distancia' : 'Enable distance monitor'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {settings.appLanguage === 'es' ? 'Alerta si estás muy cerca de la pantalla' : 'Alerts if you\'re too close to the screen'}
                </p>
              </div>
              <label className="relative inline-block w-[50px] h-[26px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={(() => { try { return localStorage.getItem('therapheye_distance_monitor') === '1'; } catch { return false; } })()}
                  onChange={(e) => {
                    const val = e.target.checked ? '1' : '0';
                    localStorage.setItem('therapheye_distance_monitor', val);
                    window.dispatchEvent(new CustomEvent('therapheye-distance-monitor-changed', { detail: { active: e.target.checked } }));
                  }}
                  className="sr-only peer"
                />
                <div className="w-full h-full bg-gray-300 rounded-full peer-checked:bg-[#1B396B] transition-colors duration-300">
                  <div className="absolute top-[3px] left-[3px] w-5 h-5 bg-white rounded-full transition-transform duration-300 peer-checked:translate-x-6" />
                </div>
              </label>
            </div>
          </div>

          {/* Botón Resetear */}
          <button
            onClick={resetSettings}
            className="w-full py-3 bg-red-500 text-white font-semibold rounded-lg
                     hover:bg-red-600 active:scale-95 transition-all duration-200"
          >
            {t('accessibility', 'resetAll')}
          </button>
        </div>
      </div>
    </div>,
    portalTarget
  );

  return (
    <>
      {menu}
      {showWizard && (
        <AIConfigWizard
          lang={settings.appLanguage}
          onApply={(partial) => {
            applyBulkSettings(partial);
            setShowWizard(false);
          }}
          onClose={() => setShowWizard(false)}
        />
      )}
    </>
  );
};

export default AccessibilityMenu;
