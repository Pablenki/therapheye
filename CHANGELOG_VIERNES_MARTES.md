# Therapheye — Cambios del Viernes 25 al Martes 29 de Abril 2026

---

## INFRAESTRUCTURA Y SEGURIDAD

### 1. Migraciones de base de datos centralizadas
- Se movió toda la lógica de migración a `src/utils/migrations.ts`
- Garantiza que las tablas se creen automáticamente al primer uso
- Evita errores silenciosos por tablas faltantes

### 2. Bcrypt movido a servidor (Netlify Function)
- El hash de contraseñas ya no ocurre en el navegador del usuario
- Se creó `netlify/functions/auth-hash.ts`
- Mejora la seguridad: las contraseñas nunca viajan en texto claro

### 3. API de IA protegida en proxy serverless
- La API key nunca se expone al navegador
- Se creó `netlify/functions/claude-proxy.ts` como intermediario seguro

### 4. Migración de Claude API (pago) → Google Gemini (gratuito)
- Se reemplazó la API de Anthropic Claude por Google Gemini 2.0 Flash
- Tier gratuito: 1,500 solicitudes/día, 1 millón de tokens/día
- Cero costo para el proyecto

### 5. Modo offline mejorado
- Cache estratégico en Service Worker
- Cola de sincronización: las acciones realizadas sin internet se sincronizan al reconectarse
- El usuario puede seguir usando la app sin conexión

### 6. Eliminación de EmailJS → Gmail SMTP directo
- Se desinstala `@emailjs/browser` (límite de 2 templates gratuitos)
- Se crea `netlify/functions/send-email.ts` con Nodemailer + Gmail
- Sin límite de templates ni de volumen mensual
- Diseño HTML propio para cada tipo de correo

### 7. Limpieza de dependencias
- Eliminado `@supabase/supabase-js` (instalado pero nunca usado)
- Eliminado `src/test-db.ts` (script de prueba)

---

## CORREOS ELECTRÓNICOS

Todos los correos tienen diseño visual con header morado, iconos y botones de acción.

### 8. Correo de verificación de cuenta
- Se envía al registrarse
- Incluye código de 6 dígitos con diseño destacado
- Expira en 10 minutos

### 9. Correo de bienvenida
- Se envía al verificar la cuenta exitosamente
- Lista las 4 funciones principales de la app
- Incluye tip de la regla 20-20-20
- Botón directo a la app

### 10. Correo de confirmación de eliminación de cuenta
- Código de seguridad en rojo para confirmar acción irreversible
- Advertencia visual destacada

### 11. Correo de reporte semanal
- Se envía automáticamente cada semana al usuario
- Muestra: ejercicios completados, racha activa, puntaje promedio
- Resumen textual del progreso

### 12. Correo de soporte técnico
- Se envía a therapheye@gmail.com cuando un usuario usa el chat de soporte
- Incluye el transcript completo de la conversación con la IA
- Datos del usuario (nombre y email)

---

## INTELIGENCIA ARTIFICIAL

### 13. Chat de síntomas visuales
- Chat con IA especializada en salud visual
- Respuestas contextualizadas al historial del usuario
- Opción de enviar el transcript al soporte por correo

### 14. Detector de parpadeo (MediaPipe)
- Usa la cámara para detectar la frecuencia de parpadeo
- Compara con el rango normal (15–20 ppm)
- Detecta posible síndrome de ojo seco

### 15. Coach visual semanal con IA
- Analiza el historial del usuario
- Genera recomendaciones personalizadas cada semana
- Predictor de fatiga visual basado en patrones

### 16. Rutinas personalizadas con IA
- La IA genera rutinas de ejercicios adaptadas al nivel del usuario
- Se actualiza según el progreso

### 17. Análisis de imagen con IA (Claude Vision / Gemini)
- Analiza fotos del ojo capturadas desde la app
- Detecta: enrojecimiento ocular, enrojecimiento de piel, párpado caído
- Backend en Python (FastAPI) desplegado en Railway

### 18. Analizador de síntomas con IA
- Formulario guiado de síntomas
- La IA genera un análisis clínico en formato SOAP
- Incluido en el reporte PDF médico

### 19. Reporte PDF médico con análisis clínico
- Genera un PDF completo con todos los datos del paciente
- Sección de análisis clínico generada por IA
- Incluye tests especializados, adherencia, síntomas, recomendaciones

---

## TESTS CLÍNICOS

### 20. Test de contraste
- Evalúa la sensibilidad al contraste del ojo
- Registra nivel y porcentaje detectado

### 21. Test cromático
- Detecta posibles deficiencias en la percepción del color
- Múltiples categorías de evaluación

### 22. Test de campo visual periférico
- Mapea los puntos detectados en el campo visual
- Detecta puntos ciegos o pérdida periférica

### 23. Test de acomodación visual
- Evalúa la capacidad del ojo de enfocar a distintas distancias
- Genera score y nivel de acomodación

### 24. Test de rejilla de Amsler
- Detecta distorsiones en la visión central
- Identifica cuadrantes afectados

### 25. Test de dominancia ocular
- Determina cuál es el ojo dominante del usuario

### 26. Test de reacción visual
- Mide el tiempo de reacción a estímulos visuales
- Útil para evaluar agilidad visual

### 27. Test de vergencia
- Evalúa la capacidad de los ojos de moverse coordinadamente

### 28. Test de lectura visual con reconocimiento de voz
- El usuario lee en voz alta y la app transcribe
- Evalúa velocidad y fluidez de lectura

### 29. Evolución de tests clínicos
- Gráficas de progresión temporal para cada tipo de test
- Permite ver el avance o deterioro a lo largo del tiempo

---

## FUNCIONES DE BIENESTAR

### 30. Pomodoro visual
- Temporizador especializado para descansos visuales
- Integrado con la regla 20-20-20

### 31. Modo zen con audio
- Ejercicios de relajación visual con sonido ambiente
- Guías de respiración

### 32. Respiración 4-7-8
- Técnica de respiración para reducir fatiga visual y estrés
- Animación guiada

### 33. Monitor de distancia
- Alerta cuando el usuario está demasiado cerca de la pantalla
- Usa la cámara para estimar la distancia

### 34. Detector de condiciones ambientales
- Mide luminosidad del entorno
- Recomienda ajustes de pantalla

### 35. Carga visual del día
- Estima la fatiga acumulada basándose en las actividades registradas
- Recomendaciones adaptadas

### 36. Ejercicios avanzados
- Ejercicios específicos para condiciones concretas
- Más variados que los ejercicios básicos

### 37. Entrenamiento visual-cognitivo
- Test de Stroop (colores vs. palabras)
- Span de dígitos (memoria de trabajo)
- Entrena la conexión ojo-cerebro

---

## FUNCIONES DE REGISTRO Y SEGUIMIENTO

### 38. Diario visual
- El usuario registra cómo se sintió cada día
- Notas libres sobre su salud visual

### 39. Historial ocular completo
- Registro de todas las evaluaciones, tests y capturas
- Filtros por fecha, tipo y resultado

### 40. Notas médicas con OCR
- El usuario fotografia recetas médicas
- La IA extrae texto con OCR automático
- Almacena diagnósticos y prescripciones

### 41. Galería de capturas
- Todas las fotos del ojo tomadas desde la app
- Organizadas cronológicamente

### 42. Exportar datos en CSV
- El usuario puede descargar todo su historial en formato CSV
- Compatible con Excel y Google Sheets

### 43. Estadísticas avanzadas
- Tendencias semanales y mensuales
- Patrones horarios (a qué hora hay más fatiga)
- Correlaciones entre síntomas y actividades

---

## FUNCIONES SOCIALES Y DE COMUNICACIÓN

### 44. Informe médico SOAP
- Genera un documento en formato clínico estándar SOAP
- Listo para mostrar al oftalmólogo

### 45. Informe QR
- Genera un código QR con el resumen de salud visual
- El médico puede escanearlo para ver el historial

### 46. Compartir resultados
- El usuario puede compartir su progreso en redes sociales o WhatsApp

### 47. Recordatorios por WhatsApp
- Configura recordatorios enviados por WhatsApp
- Integrado con enlace directo a wa.me

### 48. Integración Google Calendar
- Permite agendar sesiones de ejercicios directamente en Google Calendar

### 49. Mapa de oftalmólogos
- Mapa interactivo con clínicas cercanas
- Basado en la ubicación del usuario (Leaflet + OpenStreetMap)

---

## EXPERIENCIA DE USUARIO (UX)

### 50. PWA instalable
- La app se puede instalar en el móvil como app nativa
- Funciona sin internet (modo offline)
- Ícono en pantalla de inicio

### 51. Chrome Extension — Therapheye Screen Guard
- Extensión para Chrome que monitorea el tiempo de pantalla
- Muestra recordatorios de descanso visual en el navegador

### 52. Tour interactivo con spotlight
- Al entrar por primera vez, un tour guiado muestra las funciones principales
- Spotlight que resalta cada elemento paso a paso

### 53. Feature Showcase automático
- Carousel que presenta todas las funciones nuevas al usuario
- Se muestra una sola vez al actualizar la app

### 54. Dashboard colapsable
- Cada sección del dashboard se puede expandir o colapsar
- El usuario personaliza qué ve primero

### 55. Onboarding personalizado
- Flujo de bienvenida adaptado al perfil del usuario
- Recoge preferencias iniciales (edad, ocupación, síntomas frecuentes)

### 56. Panel de acceso rápido
- 12 herramientas avanzadas accesibles desde el dashboard con un clic
- FAB (botón flotante de acción) para acceso rápido en móvil

### 57. Dark mode
- Modo oscuro completo en toda la app
- Se activa automáticamente según preferencia del sistema

### 58. Modo nocturno programado
- Activa filtros de luz azul a una hora determinada por el usuario

### 59. Bottom navigation en móvil
- Barra de navegación inferior en dispositivos móviles
- Acceso a las 5 secciones principales

### 60. Lazy loading con Suspense
- Las 34 páginas se cargan bajo demanda
- Reduce el tiempo de carga inicial significativamente

### 61. Error Boundary
- Si una página falla, muestra un mensaje amigable en vez de romper toda la app
- Opción de reintentar sin perder sesión

### 62. Transiciones animadas entre páginas
- Animación suave de fade al navegar entre secciones

### 63. Ojo del día
- Dato curioso o consejo visual diferente cada día
- Aparece en el dashboard

### 64. Racha de actividad
- Contador de días consecutivos activos
- Motivación para mantener el hábito

### 65. Quick check matutino
- Evaluación rápida de síntomas al empezar el día
- 3 preguntas, menos de 1 minuto

### 66. Indicador de presencia
- Detecta si el usuario sigue frente a la pantalla
- Pausa los temporizadores automáticamente al alejarse

---

## ACCESIBILIDAD

### 67. Wizard de accesibilidad con IA
- Configura la app según las necesidades del usuario
- Ajusta tamaño de texto, contraste, velocidad de animaciones

### 68. Modo de enfoque
- Elimina distracciones visuales en pantalla
- Útil para usuarios con sensibilidad a estímulos

### 69. Lector de pantalla compatible
- Navegación por teclado y compatibilidad con lectores de pantalla
- Indicadores visuales de enfoque accesibles

---

## NOTIFICACIONES

### 70. Push notifications
- Notificaciones push en el navegador y móvil (PWA)
- El usuario las activa desde su Perfil
- Configuradas con VAPID para máxima compatibilidad

### 71. Cron de notificaciones diarias
- Netlify ejecuta automáticamente notificaciones a las 8pm UTC todos los días
- Recuerda al usuario completar su rutina

---

*Documento generado el 29 de abril de 2026 — Therapheye v0.0.0*
*Total: 71 funciones / mejoras implementadas*
