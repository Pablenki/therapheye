// =========================================
// COMPONENTE MENÚ DE ACCESIBILIDAD
// Sistema completo de accesibilidad visual
// Usa React Portal → renderiza en #a11y-portal fuera de #root
// =========================================

import { useAccessibility } from './useAccessibility';
import { createPortal } from 'react-dom';
import { X, Settings, Eye, Volume2, MousePointer } from 'lucide-react';
import type { FontFamily, ColorBlindMode } from './accessibility.types';

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
  } = useAccessibility();

  const portalTarget = document.getElementById('a11y-portal') || document.body;

  return createPortal(
    <div 
      className="accessibility-menu fixed bottom-5 right-5 z-[9999]"
      style={settings.invertColors ? { filter: 'invert(1) hue-rotate(180deg)' } : undefined}
    >
      {/* Botón flotante principal */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-[60px] h-[60px] rounded-full bg-gradient-to-br from-[#1B396B] to-[#003875] 
                   text-white flex items-center justify-center shadow-lg
                   hover:scale-110 active:scale-95 transition-all duration-300"
        aria-label="Abrir menú de accesibilidad"
      >
        <Settings className="w-7 h-7" />
      </button>

      {/* Panel desplegable */}
      <div
        className={`absolute bottom-[75px] right-0 w-[350px] bg-white rounded-2xl shadow-2xl
                   transition-all duration-300 max-h-[600px] overflow-y-auto
                   ${isOpen 
                     ? 'opacity-100 visible translate-y-0 scale-100' 
                     : 'opacity-0 invisible translate-y-5 scale-90'}`}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 bg-gradient-to-r from-[#1B396B] to-[#003875] 
                       text-white rounded-t-2xl sticky top-0 z-10">
          <h3 className="text-lg font-semibold">Accesibilidad</h3>
          <button
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full
                     hover:bg-white/20 transition-colors"
            aria-label="Cerrar menú"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-5">
          
          {/* ========== 1. VISUALES ========== */}
          <div className="mb-6 pb-5 border-b-2 border-gray-200">
            <h4 className="text-base font-bold text-[#1B396B] mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Visuales
            </h4>

            {/* Alto Contraste */}
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-gray-700">Alto Contraste</span>
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
                <label className="text-sm font-medium text-gray-700">Tamaño de letra</label>
                <div className="flex items-center gap-1.5">
                  {settings.fontSize !== 100 && (
                    <button
                      onClick={() => setFontSize(100)}
                      className="text-xs text-gray-400 hover:text-gray-600 underline"
                    >
                      reset
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
                aria-label="Tamaño de letra"
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
                Tipo de Fuente
              </label>
              <select
                value={settings.fontFamily}
                onChange={(e) => updateSetting('fontFamily', e.target.value as FontFamily)}
                className="w-full p-2 border-2 border-[#1B396B] rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#1B396B]/30"
              >
                <option value="default">Predeterminada</option>
                <option value="Arial, sans-serif">Arial</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="Courier New, monospace">Courier New</option>
                <option value="Comic Sans MS, cursive">Comic Sans</option>
                <option value="OpenDyslexic, sans-serif">OpenDyslexic (Dislexia)</option>
              </select>
            </div>

            {/* Zoom de página */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Zoom de pantalla
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
              <span className="text-sm font-medium text-gray-700">Invertir Colores</span>
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
                Modo Daltonismo
              </label>
              <select
                value={settings.colorBlindMode}
                onChange={(e) => updateSetting('colorBlindMode', e.target.value as ColorBlindMode)}
                className="w-full p-2 border-2 border-[#1B396B] rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#1B396B]/30"
              >
                <option value="none">Ninguno</option>
                <option value="protanopia">Protanopia (Rojo-Verde)</option>
                <option value="deuteranopia">Deuteranopia (Verde-Rojo)</option>
                <option value="tritanopia">Tritanopia (Azul-Amarillo)</option>
                <option value="achromatopsia">Acromatopsia (Sin Color)</option>
              </select>
            </div>
          </div>

          {/* ========== 2. LECTURA Y NAVEGACIÓN ========== */}
          <div className="mb-6 pb-5 border-b-2 border-gray-200">
            <h4 className="text-base font-bold text-[#1B396B] mb-4 flex items-center gap-2">
              <Volume2 className="w-5 h-5" />
              Lectura y Navegación
            </h4>

            {/* Guía de Lectura */}
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-gray-700">Guía de Lectura</span>
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
              <span className="text-sm font-medium text-gray-700">Lectura en Voz Alta</span>
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
              <span className="text-sm font-medium text-gray-700">Indicadores Visuales</span>
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

          {/* ========== 3. MOTORAS Y FÍSICAS ========== */}
          <div className="mb-6 pb-5 border-b-2 border-gray-200">
            <h4 className="text-base font-bold text-[#1B396B] mb-4 flex items-center gap-2">
              <MousePointer className="w-5 h-5" />
              Motoras y Físicas
            </h4>

            {/* Cursor Grande */}
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-gray-700">Cursor Grande</span>
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
              <span className="text-sm font-medium text-gray-700">Resaltar Enlaces</span>
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
              <span className="text-sm font-medium text-gray-700">Modo Foco</span>
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

          {/* Botón Resetear */}
          <button
            onClick={resetSettings}
            className="w-full py-3 bg-red-500 text-white font-semibold rounded-lg
                     hover:bg-red-600 active:scale-95 transition-all duration-200"
          >
            Restablecer Todo
          </button>
        </div>
      </div>
    </div>,
    portalTarget
  );
};

export default AccessibilityMenu;
