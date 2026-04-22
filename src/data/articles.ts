// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ArticleCategory = 'ciencia' | 'habitos' | 'sintomas' | 'ejercicios' | 'therapheye';

export const CATEGORY_META: Record<ArticleCategory, { labelEs: string; labelEn: string; color: string; bg: string; border: string }> = {
  ciencia:    { labelEs: 'Ciencia',    labelEn: 'Science',    color: 'text-blue-700',   bg: 'bg-blue-100',   border: 'border-blue-200'   },
  habitos:    { labelEs: 'Hábitos',    labelEn: 'Habits',     color: 'text-green-700',  bg: 'bg-green-100',  border: 'border-green-200'  },
  sintomas:   { labelEs: 'Síntomas',   labelEn: 'Symptoms',   color: 'text-red-700',    bg: 'bg-red-100',    border: 'border-red-200'    },
  ejercicios: { labelEs: 'Ejercicios', labelEn: 'Exercises',  color: 'text-violet-700', bg: 'bg-violet-100', border: 'border-violet-200' },
  therapheye: { labelEs: 'Therapheye', labelEn: 'Therapheye', color: 'text-indigo-700', bg: 'bg-indigo-100', border: 'border-indigo-200' },
};

export interface ArticleSection {
  heading?: string;
  body: string;
}

export interface Article {
  id: string;
  category: ArticleCategory;
  titleEs: string;
  titleEn: string;
  summaryEs: string;
  summaryEn: string;
  readMinutes: number;
  accentFrom: string; // tailwind gradient from class
  accentTo: string;   // tailwind gradient to class
  contentEs: ArticleSection[];
  contentEn: ArticleSection[];
}

// ─── Artículos ────────────────────────────────────────────────────────────────

export const ARTICLES: Article[] = [
  // ── 1. Fatiga Visual Digital ─────────────────────────────────────────────────
  {
    id: 'fatiga-visual-digital',
    category: 'ciencia',
    titleEs: 'Fatiga Visual Digital: lo que le pasa a tus ojos frente a pantallas',
    titleEn: 'Digital Eye Strain: what really happens to your eyes on screens',
    summaryEs: 'El Síndrome Visual Informático afecta al 64–90% de usuarios de computadora según Rosenfield (2011) y ≥50% según Sheppard & Wolffsohn (2018). Conoce la ciencia detrás del cansancio ocular.',
    summaryEn: 'Computer Vision Syndrome affects 64–90% of computer users (Rosenfield 2011) and ≥50% according to Sheppard & Wolffsohn (2018). Learn the science behind digital eye strain.',
    readMinutes: 6,
    accentFrom: 'from-blue-500',
    accentTo: 'to-indigo-600',
    contentEs: [
      {
        heading: '¿Qué es el Síndrome Visual Informático?',
        body: 'La fatiga visual digital, clínicamente conocida como Síndrome Visual Informático (SVI) o Computer Vision Syndrome (CVS), es un conjunto de síntomas oculares y visuales que resultan del uso prolongado de pantallas. Rosenfield (Ophthalmic Physiol Opt, 2011) describió su presencia en el 64–90% de los usuarios de computadora, con síntomas oculares, visuales y musculoesqueléticos. Sheppard y Wolffsohn (BMJ Open Ophthalmol, 2018) estimaron una prevalencia ≥50% y propusieron la clasificación en dos grupos de síntomas que explica mejor la fisiopatología.'
      },
      {
        heading: 'Síntomas internos y externos: la clasificación de Sheppard & Wolffsohn',
        body: 'Sheppard y Wolffsohn (2018) diferenciaron los síntomas del SVI en dos categorías. Los síntomas internos —astenopía, cefalea, visión borrosa— están vinculados a disfunción acomodativa y de vergencia: el músculo ciliar trabaja en "acomodación sostenida" forzando el cristalino a mantener el enfoque en una pantalla cercana. Los síntomas externos —ardor, sequedad, irritación, sensación de cuerpo extraño— derivan del ojo seco evaporativo: frente a pantallas parpadeas 5–7 veces por minuto en lugar de 15–20, y el parpadeo suele ser incompleto, dejando la córnea expuesta.'
      },
      {
        heading: 'Anomalías oculomotoras: el hallazgo de Rosenfield',
        body: 'Rosenfield (2011) identificó como causas principales del SVI las anomalías acomodativas y de vergencia: las respuestas de enfoque frente a pantallas son similares a las del papel, pero las demandas sostenidas durante horas generan fatiga del músculo ciliar y de los músculos extraoculares. Las letras impresas tienen bordes perfectamente definidos; los píxeles crean bordes difusos que el ojo intenta reenfocar de forma repetida e inconsciente. Este microesfuerzo, acumulado durante horas, agota la musculatura ocular antes de que percibas el cansancio.'
      },
      {
        heading: 'Síntomas más frecuentes y cuándo aparecen',
        body: 'El SVI se manifiesta como visión borrosa temporal, ojos secos o con sensación de ardor, cefalea frontal o en las sienes, dolor de cuello y hombros (tensión postural asociada), y dificultad para reenfocar al apartar la vista de la pantalla. Estos síntomas suelen aparecer después de 2–3 horas de exposición continua y desaparecen con descanso, aunque si se vuelven diarios es una señal de alerta. Rosenfield señaló que la eficacia de muchos tratamientos propuestos (filtros, lágrimas artificiales) permanecía sin demostrarse rigurosamente en 2011 — agenda que sigue vigente.'
      },
      {
        heading: 'Por qué la prevención sistemática supera a la reacción',
        body: 'El sistema visual humano es extraordinariamente adaptable: los músculos extraoculares y el músculo ciliar pueden sostener el esfuerzo durante horas antes de que sientas molestia. Para cuando el cansancio es evidente, el daño acumulado del día ya ha ocurrido. Sheppard y Wolffsohn (2018) recomiendan un abordaje multimodal: corrección refractiva precisa, manejo del ojo seco, pausas regulares con la regla 20-20-20 y ajustes ergonómicos. Estos elementos combinados tienen mucho mayor respaldo que cualquier gadget o filtro individual.'
      },
    ],
    contentEn: [
      {
        heading: 'What is Computer Vision Syndrome?',
        body: 'Digital eye strain, clinically known as Computer Vision Syndrome (CVS), is a group of ocular and visual symptoms resulting from prolonged screen use. Rosenfield (Ophthalmic Physiol Opt, 2011) described it in 64–90% of computer users, with ocular, visual, and musculoskeletal symptoms. Sheppard and Wolffsohn (BMJ Open Ophthalmol, 2018) estimated a prevalence of ≥50% and proposed a two-category symptom classification that better explains the pathophysiology.'
      },
      {
        heading: 'Internal and external symptoms: Sheppard & Wolffsohn\'s classification',
        body: 'Sheppard and Wolffsohn (2018) divided CVS symptoms into two categories. Internal symptoms — asthenopia, headache, blurred vision — are linked to accommodative and vergence dysfunction: the ciliary muscle works in "sustained accommodation," forcing the lens to maintain focus on a close screen. External symptoms — burning, dryness, irritation, foreign body sensation — stem from evaporative dry eye: in front of screens you blink 5–7 times per minute instead of 15–20, and blinking is often incomplete, leaving the cornea exposed.'
      },
      {
        heading: 'Oculomotor anomalies: Rosenfield\'s finding',
        body: 'Rosenfield (2011) identified accommodative and vergence anomalies as the main causes of CVS: focusing responses to screens are similar to paper, but sustained demands for hours generate ciliary muscle and extra-ocular muscle fatigue. Printed letters have perfectly defined edges; pixels create blurred edges that the eye tries to refocus repeatedly and unconsciously. This micro-effort, accumulated over hours, exhausts the ocular musculature before you perceive the fatigue.'
      },
      {
        heading: 'Most common symptoms and when they appear',
        body: 'CVS manifests as temporary blurred vision, dry or burning eyes, frontal headache or in the temples, neck and shoulder pain (associated postural tension), and difficulty refocusing when looking away from the screen. Symptoms usually appear after 2–3 hours of continuous exposure and disappear with rest, though if they become daily, it is a warning sign. Rosenfield noted that the efficacy of many proposed treatments (filters, artificial tears) remained unproven as of 2011 — an agenda that remains active today.'
      },
      {
        heading: 'Why systematic prevention beats reaction',
        body: 'The human visual system is extraordinarily adaptable: extra-ocular muscles and the ciliary muscle can sustain effort for hours before you feel discomfort. By the time the fatigue is evident, the day\'s accumulated damage has already occurred. Sheppard and Wolffsohn (2018) recommend a multimodal approach: precise refractive correction, dry eye management, regular breaks with the 20-20-20 rule, and ergonomic adjustments. These combined elements have far more clinical support than any single gadget or filter.'
      },
    ],
  },

  // ── 2. Regla 20-20-20 ────────────────────────────────────────────────────────
  {
    id: 'regla-20-20-20',
    category: 'habitos',
    titleEs: 'La Regla 20-20-20: el hábito más simple para proteger tu vista',
    titleEn: 'The 20-20-20 Rule: the simplest habit to protect your vision',
    summaryEs: 'Cada 20 minutos, mira algo a 6 metros de distancia durante 20 segundos. Un método respaldado por la ciencia que puede prevenir el síndrome visual informático.',
    summaryEn: 'Every 20 minutes, look at something 20 feet away for 20 seconds. A science-backed method that can prevent computer vision syndrome.',
    readMinutes: 4,
    accentFrom: 'from-emerald-500',
    accentTo: 'to-teal-600',
    contentEs: [
      {
        heading: 'Origen de la regla',
        body: 'La regla 20-20-20 fue popularizada por el optometrista Jeffrey Anshel y adoptada por la American Optometric Association como recomendación estándar. Su nombre es fácil de recordar precisamente para favorecer la adherencia: cada 20 minutos de trabajo en pantalla, realiza una pausa de 20 segundos mirando un objeto a 20 pies (aproximadamente 6 metros) de distancia.'
      },
      {
        heading: 'La ciencia del descanso acomodativo',
        body: 'El músculo ciliar, responsable del enfoque, trabaja en modo de "acomodación sostenida" cuando mantienes la vista fija en una pantalla cercana. Al mirar a 6 metros o más, el cristalino se aplana y el músculo se relaja completamente: es el equivalente a estirar un músculo después de tenerlo contraído. 20 segundos son suficientes para romper el ciclo de tensión y reducir la fatiga acumulada.'
      },
      {
        heading: 'Evidencia clínica',
        body: 'Un estudio publicado en el Journal of Ophthalmology (2018) encontró que los trabajadores que aplicaban la regla 20-20-20 reportaban 37 % menos de síntomas de fatiga visual al final de la jornada. Otro ensayo con universitarios (2021) mostró una reducción significativa de cefalea y sequedad ocular en el grupo que siguió el protocolo. La consistencia del hábito, no su duración, es el factor determinante.'
      },
      {
        heading: 'Cómo practicarlo de verdad',
        body: 'El mayor obstáculo es recordarlo. Las estrategias más efectivas son: usar un temporizador o app dedicada (como el widget de Therapheye), vincularlo a una acción ya establecida (cada vez que terminas un párrafo largo), o activar las notificaciones del sistema. No es necesario levantarse de la silla; simplemente desviar la mirada hacia una ventana o un objeto distante en la habitación es suficiente para activar la relajación acomodativa.'
      },
    ],
    contentEn: [
      {
        heading: 'Origin of the rule',
        body: 'The 20-20-20 rule was popularized by optometrist Jeffrey Anshel and adopted by the American Optometric Association as a standard recommendation. Its name is easy to remember to favor adherence: every 20 minutes of screen work, take a 20-second break looking at an object 20 feet (about 6 meters) away.'
      },
      {
        heading: 'The science of accommodative rest',
        body: 'The ciliary muscle, responsible for focusing, works in "sustained accommodation" mode when you keep your gaze fixed on a close screen. When looking at 6 meters or more, the lens flattens and the muscle fully relaxes: it\'s the equivalent of stretching a muscle after holding it contracted. 20 seconds are enough to break the tension cycle and reduce accumulated fatigue.'
      },
      {
        heading: 'Clinical evidence',
        body: 'A study published in the Journal of Ophthalmology (2018) found that workers who applied the 20-20-20 rule reported 37% fewer visual fatigue symptoms at the end of the day. Another trial with university students (2021) showed a significant reduction in headache and eye dryness in the group that followed the protocol. The consistency of the habit, not its duration, is the determining factor.'
      },
      {
        heading: 'How to practice it for real',
        body: 'The biggest obstacle is remembering. The most effective strategies are: using a dedicated timer or app (like the Therapheye widget), linking it to an already established action (every time you finish a long paragraph), or enabling system notifications. You don\'t need to get up from your chair; simply diverting your gaze toward a window or distant object in the room is enough to trigger accommodative relaxation.'
      },
    ],
  },

  // ── 3. Síntomas de Alerta ────────────────────────────────────────────────────
  {
    id: 'sintomas-alerta',
    category: 'sintomas',
    titleEs: 'Síntomas de Alerta: cuándo el cansancio ocular es algo más',
    titleEn: 'Warning Symptoms: when eye fatigue is something more',
    summaryEs: 'Distinguir entre fatiga visual normal y señales que requieren atención médica puede protegerte de problemas visuales graves. Conoce los signos clave.',
    summaryEn: 'Distinguishing between normal eye fatigue and signs that require medical attention can protect you from serious visual problems. Learn the key signs.',
    readMinutes: 5,
    accentFrom: 'from-red-500',
    accentTo: 'to-orange-500',
    contentEs: [
      {
        heading: 'Síntomas normales vs señales de alarma',
        body: 'El cansancio visual ordinario —leve picor, visión momentáneamente borrosa al apartar la mirada de la pantalla— se resuelve con descanso en menos de 30 minutos. Son señales de alarma: visión borrosa que persiste más de una hora tras descansar, pérdida repentina de campo visual, aparición de destellos, puntos flotantes nuevos o abundantes, dolor intenso dentro del globo ocular, o visión doble. Estos síntomas requieren consulta médica urgente, no una pausa de 20 segundos.'
      },
      {
        heading: 'Sequedad ocular crónica',
        body: 'La sequedad que no mejora con parpadeo consciente puede indicar Síndrome de Ojo Seco (SOS), una condición que afecta la película lagrimal y puede causar daño epitelial si no se trata. El SOS es 2.3 veces más prevalente en personas que pasan más de 8 horas diarias frente a pantallas. Si los ojos se sienten arenosos, con sensación de cuerpo extraño o con episodios de lagrimeo reflejo (los ojos lagrimean paradójicamente para compensar la sequedad), conviene consultar a un especialista.'
      },
      {
        heading: 'Cefalea persistente',
        body: 'El dolor de cabeza por fatiga visual se localiza típicamente en la frente, las sienes o el área supraorbitaria (sobre las cejas). Si el dolor aparece de forma consistente a la misma hora del día, especialmente tras varias horas de pantalla, puede ser el primer signo de un problema de refracción no corregido: miopía, astigmatismo o presbicia incipiente. La corrección con lentes puede eliminar estos episodios casi de inmediato.'
      },
      {
        heading: 'Cambios repentinos en la visión',
        body: 'Cualquier cambio agudo en la calidad visual —ver un "telón" negro, flashes de luz periférica, o una sombra en el campo visual— puede indicar desprendimiento de retina, que es una emergencia médica. Del mismo modo, ver halos de colores alrededor de las luces nocturnas puede ser un signo de glaucoma. En ambos casos, la ventana de tratamiento efectivo se mide en horas, no en días.'
      },
      {
        heading: 'La trampa del "ya se me pasa"',
        body: 'El ojo humano tiene una gran capacidad compensatoria. Muchos problemas oculares —como el glaucoma o la degeneración macular temprana— son indoloros en sus fases iniciales, por lo que la persona los atribuye al "cansancio normal". La detección temprana a través de revisiones periódicas (al menos una vez al año después de los 40, o con mayor frecuencia si se trabaja intensivamente con pantallas) es la única manera de interceptar estas condiciones antes de que causen daño irreversible.'
      },
    ],
    contentEn: [
      {
        heading: 'Normal symptoms vs. alarm signals',
        body: 'Ordinary visual fatigue — mild itching, momentarily blurred vision when looking away from the screen — resolves with rest in less than 30 minutes. Alarm signals are: blurred vision that persists more than an hour after resting, sudden loss of visual field, appearance of flashes, new or abundant floaters, intense pain inside the eyeball, or double vision. These symptoms require urgent medical consultation, not a 20-second break.'
      },
      {
        heading: 'Chronic dry eye',
        body: 'Dryness that does not improve with conscious blinking may indicate Dry Eye Syndrome (DES), a condition that affects the tear film and can cause epithelial damage if untreated. DES is 2.3 times more prevalent in people who spend more than 8 hours daily in front of screens. If eyes feel gritty, with a foreign body sensation or episodes of reflex tearing (eyes tear paradoxically to compensate for dryness), a specialist consultation is warranted.'
      },
      {
        heading: 'Persistent headache',
        body: 'Headache from visual fatigue is typically located in the forehead, temples, or supraorbital area (above the eyebrows). If the pain appears consistently at the same time of day, especially after several hours of screen time, it may be the first sign of an uncorrected refractive problem: myopia, astigmatism, or incipient presbyopia. Correction with lenses can eliminate these episodes almost immediately.'
      },
      {
        heading: 'Sudden changes in vision',
        body: 'Any acute change in visual quality — seeing a black "curtain," peripheral light flashes, or a shadow in the visual field — may indicate retinal detachment, which is a medical emergency. Likewise, seeing colored halos around nighttime lights may be a sign of glaucoma. In both cases, the effective treatment window is measured in hours, not days.'
      },
      {
        heading: 'The "it will pass" trap',
        body: 'The human eye has great compensatory capacity. Many eye problems — such as glaucoma or early macular degeneration — are painless in their initial phases, so people attribute them to "normal fatigue." Early detection through periodic check-ups (at least once a year after age 40, or more frequently if working intensively with screens) is the only way to intercept these conditions before they cause irreversible damage.'
      },
    ],
  },

  // ── 4. Luz Azul ──────────────────────────────────────────────────────────────
  {
    id: 'luz-azul-mitos',
    category: 'ciencia',
    titleEs: 'Luz Azul: mitos, realidades y lo que dice la evidencia',
    titleEn: 'Blue Light: myths, realities and what the evidence says',
    summaryEs: 'Las pantallas emiten luz azul, pero ¿es realmente tan dañina como se dice? Separamos los hechos del marketing y explicamos qué deberías hacer.',
    summaryEn: 'Screens emit blue light, but is it really as harmful as claimed? We separate facts from marketing and explain what you should actually do.',
    readMinutes: 5,
    accentFrom: 'from-violet-500',
    accentTo: 'to-purple-700',
    contentEs: [
      {
        heading: 'Qué es la luz azul',
        body: 'La luz visible se divide en el espectro de colores: desde el rojo (longitudes de onda largas, ~700 nm) hasta el violeta (longitudes cortas, ~380 nm). La luz azul de alta energía (HEV, High Energy Visible) ocupa el rango de 380–500 nm. Las pantallas LED y OLED emiten proporciones relativamente altas de este espectro. Sin embargo, el sol emite mucha más luz azul que cualquier dispositivo electrónico —algo que a menudo se olvida en el debate.'
      },
      {
        heading: 'El efecto sobre el sueño: esto sí está probado',
        body: 'La luz azul suprime la producción de melatonina, la hormona que regula el ciclo circadiano. La glándula pineal es particularmente sensible a la luz en el rango 460–480 nm. Estudios de Harvard han demostrado que la exposición a pantallas 2 horas antes de dormir puede retrasar el inicio del sueño entre 30 y 90 minutos y reducir la fase REM. Este es el efecto más sólido y replicable de la luz azul digital: no afecta tus ojos directamente, sino la calidad de tu descanso.'
      },
      {
        heading: 'El mito del daño retinal',
        body: 'El marketing de lentes "anti-luz azul" sugiere que la exposición a pantallas daña la retina de forma similar a como lo hace el sol. La evidencia actual no respalda esta afirmación. La intensidad de la luz azul emitida por una pantalla típica es 1.000 veces menor que la luz solar directa. La Academia Americana de Oftalmología (AAO) publicó en 2019 una declaración concluyendo que las lentes con filtro de luz azul no tienen evidencia suficiente para justificar su uso preventivo contra el daño retinal.'
      },
      {
        heading: 'Entonces, ¿qué causa la fatiga?',
        body: 'La fatiga visual digital no es causada principalmente por la luz azul, sino por el patrón de uso: foco sostenido, bajo parpadeo, distancia inapropiada, brillo excesivo del monitor y postura incorrecta. El modo oscuro y los filtros de luz azul pueden ayudar con el sueño (por el efecto sobre la melatonina), pero no abordan las causas reales del SVI. Los descansos, el ajuste del entorno y los ejercicios oculares son interveneviones con mucho mayor respaldo clínico.'
      },
      {
        heading: 'Recomendaciones prácticas basadas en evidencia',
        body: 'Activa el modo nocturno o "Night Shift" en tus dispositivos 2 horas antes de dormir: esto sí tiene impacto comprobado. Ajusta el brillo de tu pantalla para que no contraste bruscamente con el entorno. Evita usar pantallas en habitaciones completamente oscuras. Y si trabajas frente a pantallas más de 6 horas al día, prioriza las pausas activas y los ejercicios de relajación ocular por encima de cualquier gadget o lente especial.'
      },
    ],
    contentEn: [
      {
        heading: 'What is blue light',
        body: 'Visible light spans the color spectrum: from red (long wavelengths, ~700 nm) to violet (short wavelengths, ~380 nm). High-energy visible blue light (HEV) occupies the 380–500 nm range. LED and OLED screens emit relatively high proportions of this spectrum. However, the sun emits far more blue light than any electronic device — something often forgotten in the debate.'
      },
      {
        heading: 'The sleep effect: this is proven',
        body: 'Blue light suppresses melatonin production, the hormone that regulates the circadian cycle. The pineal gland is particularly sensitive to light in the 460–480 nm range. Harvard studies have shown that screen exposure 2 hours before sleep can delay sleep onset by 30–90 minutes and reduce REM sleep. This is the most robust, replicable effect of digital blue light: it doesn\'t directly damage your eyes, but it affects the quality of your rest.'
      },
      {
        heading: 'The retinal damage myth',
        body: 'The marketing of "anti-blue light" lenses suggests that screen exposure damages the retina similarly to the sun. Current evidence does not support this claim. The intensity of blue light emitted by a typical screen is 1,000 times lower than direct sunlight. The American Academy of Ophthalmology (AAO) published a 2019 statement concluding that blue light-filtering lenses lack sufficient evidence to justify preventive use against retinal damage.'
      },
      {
        heading: 'So what causes fatigue?',
        body: 'Digital eye fatigue is not primarily caused by blue light, but by the pattern of use: sustained focus, low blinking, inappropriate distance, excessive monitor brightness, and incorrect posture. Dark mode and blue light filters may help with sleep (due to the melatonin effect), but do not address the root causes of CVS. Breaks, environment adjustments, and eye exercises are interventions with much stronger clinical support.'
      },
      {
        heading: 'Evidence-based practical recommendations',
        body: 'Activate night mode or "Night Shift" on your devices 2 hours before sleep: this has a proven impact. Adjust your screen brightness so it doesn\'t contrast sharply with the surroundings. Avoid using screens in completely dark rooms. And if you work in front of screens for more than 6 hours a day, prioritize active breaks and eye relaxation exercises over any special gadget or lens.'
      },
    ],
  },

  // ── 5. Ejercicios Oculares ───────────────────────────────────────────────────
  {
    id: 'ejercicios-oculares',
    category: 'ejercicios',
    titleEs: 'Ejercicios Oculares: los que realmente funcionan y por qué',
    titleEn: 'Eye Exercises: the ones that actually work and why',
    summaryEs: 'No todos los ejercicios visuales tienen el mismo respaldo científico. Te explicamos cuáles tienen evidencia real y cómo practicarlos correctamente.',
    summaryEn: 'Not all visual exercises have the same scientific backing. We explain which ones have real evidence and how to practice them correctly.',
    readMinutes: 6,
    accentFrom: 'from-teal-500',
    accentTo: 'to-cyan-600',
    contentEs: [
      {
        heading: 'Por qué los ejercicios oculares importan',
        body: 'Los músculos que controlan el movimiento y el enfoque de los ojos —como cualquier músculo estriado— responden al entrenamiento y al descanso programado. La diferencia con otros grupos musculares es que no sentimos su fatiga de forma inmediata. Los ejercicios oculares no corrigen defectos de refracción (no eliminarán tu miopía), pero sí reducen la tensión acumulada, mejoran la flexibilidad acomodativa y pueden aliviar síntomas del SVI de forma significativa.'
      },
      {
        heading: 'Palming: la técnica de oro para la relajación',
        body: 'El palming consiste en cubrir los ojos con las palmas de las manos calentadas por fricción, sin presionar sobre los globos oculares, durante 2–5 minutos. La oscuridad completa y el calor relajan la musculatura intraocular y extra-ocular simultáneamente. Bates (1920) lo describió como la técnica de relajación visual más completa. Estudios modernos respaldan su efecto sobre la tensión muscular y la reducción de síntomas de sequedad.'
      },
      {
        heading: 'Enfoque cercano-lejano',
        body: 'Alterna el enfoque entre un objeto a 20–30 cm (puede ser tu pulgar extendido) y uno a 6 metros o más, durante 10–15 repeticiones. Este ejercicio trabaja activamente el músculo ciliar en ambas direcciones —contracción y relajación— mejorando su elasticidad y reduciendo la "rigidez acomodativa" que se desarrolla con años de trabajo en pantalla. Es especialmente útil para personas mayores de 40, donde la presbicia empieza a afectar la acomodación.'
      },
      {
        heading: 'Movimientos oculares dirigidos',
        body: 'Los movimientos de rastreo horizontal, vertical, diagonal y circular ejercitan los seis músculos extra-oculares. Deben realizarse lentamente, con control, siguiendo un punto imaginario o real en el límite del campo visual. Realizarlos rápidamente no tiene beneficio adicional y puede causar mareo. La clave es la amplitud del movimiento: llevar la mirada hasta el límite cómodo, no más allá. 8–10 repeticiones en cada dirección, 2 veces al día.'
      },
      {
        heading: 'Parpadeo consciente',
        body: 'Suena trivial, pero el parpadeo consciente es uno de los ejercicios con mayor evidencia. Realizar 10–20 parpadeos completos y deliberados cada hora restablece la película lagrimal, distribuye el moco que protege la córnea y "reinicia" la estimulación de los mecanorreceptores palpebrales. La técnica correcta: cierra los ojos completamente (no a medias) durante 1–2 segundos en cada parpadeo. Combinado con la regla 20-20-20, forma la rutina preventiva más efectiva y sin costo.'
      },
    ],
    contentEn: [
      {
        heading: 'Why eye exercises matter',
        body: 'The muscles that control eye movement and focus — like any striated muscle — respond to training and scheduled rest. The difference from other muscle groups is that we don\'t feel their fatigue immediately. Eye exercises don\'t correct refractive defects (they won\'t eliminate your myopia), but they do reduce accumulated tension, improve accommodative flexibility, and can significantly relieve CVS symptoms.'
      },
      {
        heading: 'Palming: the gold technique for relaxation',
        body: 'Palming involves covering the eyes with palms warmed by friction, without pressing on the eyeballs, for 2–5 minutes. Complete darkness and warmth simultaneously relax the intraocular and extra-ocular musculature. Bates (1920) described it as the most complete visual relaxation technique. Modern studies support its effect on muscle tension and reduction of dryness symptoms.'
      },
      {
        heading: 'Near-far focus',
        body: 'Alternate focus between an object at 20–30 cm (your extended thumb works) and one at 6 meters or more, for 10–15 repetitions. This exercise actively works the ciliary muscle in both directions — contraction and relaxation — improving its elasticity and reducing the "accommodative rigidity" that develops with years of screen work. It is especially useful for people over 40, where presbyopia begins to affect accommodation.'
      },
      {
        heading: 'Directed eye movements',
        body: 'Horizontal, vertical, diagonal, and circular tracking movements exercise all six extra-ocular muscles. They should be performed slowly, with control, following an imaginary or real point at the edge of the visual field. Performing them quickly has no additional benefit and can cause dizziness. The key is the amplitude of movement: bring the gaze to the comfortable limit, not beyond. 8–10 repetitions in each direction, twice a day.'
      },
      {
        heading: 'Conscious blinking',
        body: 'It sounds trivial, but conscious blinking is one of the exercises with the most evidence. Performing 10–20 complete, deliberate blinks every hour restores the tear film, distributes the mucus that protects the cornea, and "resets" stimulation of the palpebral mechanoreceptors. The correct technique: close the eyes completely (not halfway) for 1–2 seconds each blink. Combined with the 20-20-20 rule, it forms the most effective and cost-free preventive routine.'
      },
    ],
  },

  // ── 6. Ergonomía Visual ──────────────────────────────────────────────────────
  {
    id: 'ergonomia-visual',
    category: 'habitos',
    titleEs: 'Ergonomía Visual: configura tu espacio para proteger tus ojos',
    titleEn: 'Visual Ergonomics: set up your workspace to protect your eyes',
    summaryEs: 'La posición del monitor, la iluminación y la distancia a la pantalla tienen un impacto enorme en la salud ocular. Aprende a configurar tu entorno de trabajo.',
    summaryEn: 'Monitor position, lighting, and screen distance have a huge impact on eye health. Learn how to set up your work environment.',
    readMinutes: 4,
    accentFrom: 'from-amber-500',
    accentTo: 'to-yellow-500',
    contentEs: [
      {
        heading: 'La distancia ideal a la pantalla',
        body: 'La norma ANSI/HFES 100 establece que la distancia óptima entre los ojos y la pantalla es de 50–70 cm para monitores de escritorio estándar. A esta distancia, el ojo trabaja con la menor cantidad de acomodación necesaria. Si usas pantallas más grandes (27" o más), puedes alejarte hasta 80 cm sin perder legibilidad. La regla práctica: el monitor debe estar aproximadamente a la longitud de un brazo extendido.'
      },
      {
        heading: 'Altura y ángulo del monitor',
        body: 'El borde superior de la pantalla debe estar a la altura de los ojos o ligeramente por debajo (5–10 cm), de forma que la mirada natural caiga entre 10° y 20° por debajo de la horizontal. Este ángulo reduce la apertura palpebral (el área expuesta de la córnea), lo que disminuye la evaporación lagrimal y el riesgo de ojo seco. Además, alivia la tensión en el cuello y los músculos suboccipitales. Evita colocar el monitor por encima de la línea de ojos, una práctica muy común que aumenta significativamente la fatiga.'
      },
      {
        heading: 'Iluminación: el factor más olvidado',
        body: 'El contraste entre la luminosidad de la pantalla y el entorno es el principal causante de glare (deslumbramiento) y halos. La pantalla debe brillar aproximadamente igual que el ambiente circundante. Para lograrlo: coloca el monitor perpendicular a las ventanas (no frente a ellas ni de espaldas), usa iluminación difusa o indirecta en la habitación, y activa el control automático de brillo o calibra tu monitor para que en condiciones normales de trabajo esté a 120 cd/m² o menos. Los filtros de pantalla mate también ayudan en entornos con luz ambiental alta.'
      },
      {
        heading: 'Pequeños ajustes, gran impacto',
        body: 'Aumenta el tamaño del texto en el sistema operativo y el navegador al 110–125 % si trabajas con texto todo el día: el ojo hará menos microenfoque y la fatiga caerá notablemente. Usa temas de interfaz de color neutro o cálido para las horas de la tarde. Si usas dos monitores, coloca el principal directamente frente a ti y el secundario en el lateral; cada vez que gires el cuello hacia el secundario, asegúrate de que esté al mismo nivel que el principal para evitar asimetrías posturales. Estos ajustes toman 10 minutos pero repercuten en toda tu jornada.'
      },
    ],
    contentEn: [
      {
        heading: 'The ideal screen distance',
        body: 'The ANSI/HFES 100 standard establishes that the optimal distance between the eyes and the screen is 50–70 cm for standard desktop monitors. At this distance, the eye works with the minimum accommodation necessary. If using larger screens (27" or more), you can move back to 80 cm without losing readability. The practical rule: the monitor should be approximately one arm\'s length away.'
      },
      {
        heading: 'Monitor height and angle',
        body: 'The top edge of the screen should be at eye level or slightly below (5–10 cm), so the natural gaze falls 10°–20° below horizontal. This angle reduces palpebral aperture (the exposed area of the cornea), decreasing tear evaporation and the risk of dry eye. It also relieves tension in the neck and suboccipital muscles. Avoid placing the monitor above eye level, a very common practice that significantly increases fatigue.'
      },
      {
        heading: 'Lighting: the most forgotten factor',
        body: 'The contrast between screen brightness and the surrounding environment is the main cause of glare and halos. The screen should shine approximately as brightly as the surrounding environment. To achieve this: place the monitor perpendicular to windows (not facing them or with your back to them), use diffuse or indirect lighting in the room, and activate automatic brightness control or calibrate your monitor to 120 cd/m² or less under normal working conditions. Matte screen filters also help in environments with high ambient light.'
      },
      {
        heading: 'Small adjustments, big impact',
        body: 'Increase the text size in the operating system and browser to 110–125% if you work with text all day: the eye will do less microfocusing and fatigue will drop noticeably. Use neutral or warm-colored interface themes for the afternoon hours. If using two monitors, place the primary one directly in front of you and the secondary to the side; whenever you turn your neck toward the secondary, make sure it is at the same level as the primary to avoid postural asymmetries. These adjustments take 10 minutes but impact your entire workday.'
      },
    ],
  },

  // ── 7. Nutrición y Salud Visual ──────────────────────────────────────────────
  {
    id: 'nutricion-ojos',
    category: 'habitos',
    titleEs: 'Nutrición y Salud Visual: los nutrientes que protegen tu vista',
    titleEn: 'Nutrition and Eye Health: the nutrients that protect your vision',
    summaryEs: 'Lo que comes impacta directamente la salud de tu retina, tu película lagrimal y tu capacidad de adaptación a la luz. Descubre qué nutrientes son clave.',
    summaryEn: 'What you eat directly impacts the health of your retina, your tear film, and your ability to adapt to light. Discover which nutrients are key.',
    readMinutes: 5,
    accentFrom: 'from-lime-500',
    accentTo: 'to-green-600',
    contentEs: [
      {
        heading: 'Luteína y Zeaxantina: los filtros naturales de la retina',
        body: 'Estos dos carotenoides se acumulan en la mácula (la zona de mayor agudeza visual de la retina) formando el "pigmento macular". Actúan como filtros de luz azul y como antioxidantes, protegiendo los fotorreceptores del daño oxidativo. Estudios del AREDS2 (Age-Related Eye Disease Study) demostraron que la suplementación con 10 mg/día de luteína y 2 mg/día de zeaxantina reduce el riesgo de degeneración macular relacionada con la edad en un 26 %. Las fuentes alimentarias más ricas son la col rizada, las espinacas y los huevos.'
      },
      {
        heading: 'Omega-3: la base de la película lagrimal',
        body: 'Los ácidos grasos omega-3 (EPA y DHA) son componentes estructurales de la capa lipídica de la película lagrimal, que previene la evaporación de las lágrimas. Deficiencias de omega-3 se asocian con mayor prevalencia de Síndrome de Ojo Seco. Un metaanálisis de 2019 (30 estudios, 5.000 participantes) confirmó que la suplementación con omega-3 reduce significativamente los síntomas de ojo seco. Fuentes: salmón, sardinas, semillas de chía y lino. Si no consumes pescado regularmente, considera un suplemento de algas (fuente vegetal de DHA).'
      },
      {
        heading: 'Vitamina A y betacaroteno: la visión nocturna',
        body: 'La vitamina A es el precursor de la rodopsina, el pigmento visual de los bastones responsable de la visión en condiciones de baja luz. Su deficiencia es la principal causa de ceguera prevenible en el mundo (OMS). En países desarrollados la deficiencia grave es rara, pero niveles subóptimos pueden manifestarse como dificultad para adaptarse a la oscuridad (nictalopía funcional). El hígado de res, los lácteos y el huevo aportan vitamina A directa; las zanahorias, batatas y mangos aportan betacaroteno (el precursor que el cuerpo convierte).'
      },
      {
        heading: 'Vitamina C y E: antioxidantes de primera línea',
        body: 'La retina tiene uno de los metabolismos más activos del cuerpo, lo que la hace especialmente vulnerable al estrés oxidativo. Las vitaminas C y E son antioxidantes solubles en agua y grasa respectivamente, y trabajan en sinergia para neutralizar los radicales libres generados por la exposición a luz y oxígeno. El estudio AREDS (2001) demostró que la combinación de vitamina C (500 mg), E (400 UI), betacaroteno y zinc redujo en un 25 % el riesgo de progresión de la degeneración macular. Los cítricos, kiwi, pimientos y frutos secos son buenas fuentes de ambas vitaminas.'
      },
    ],
    contentEn: [
      {
        heading: 'Lutein and Zeaxanthin: the retina\'s natural filters',
        body: 'These two carotenoids accumulate in the macula (the retina\'s highest visual acuity zone) forming the "macular pigment." They act as blue light filters and antioxidants, protecting photoreceptors from oxidative damage. AREDS2 studies demonstrated that supplementation with 10 mg/day of lutein and 2 mg/day of zeaxanthin reduces the risk of age-related macular degeneration by 26%. The richest food sources are kale, spinach, and eggs.'
      },
      {
        heading: 'Omega-3: the foundation of the tear film',
        body: 'Omega-3 fatty acids (EPA and DHA) are structural components of the lipid layer of the tear film, which prevents tear evaporation. Omega-3 deficiencies are associated with higher prevalence of Dry Eye Syndrome. A 2019 meta-analysis (30 studies, 5,000 participants) confirmed that omega-3 supplementation significantly reduces dry eye symptoms. Sources: salmon, sardines, chia and flax seeds. If you don\'t consume fish regularly, consider an algae supplement (plant-based source of DHA).'
      },
      {
        heading: 'Vitamin A and beta-carotene: night vision',
        body: 'Vitamin A is the precursor of rhodopsin, the visual pigment of the rods responsible for vision in low-light conditions. Its deficiency is the world\'s leading cause of preventable blindness (WHO). In developed countries, severe deficiency is rare, but suboptimal levels can manifest as difficulty adapting to darkness (functional nyctalopia). Beef liver, dairy, and eggs provide direct vitamin A; carrots, sweet potatoes, and mangoes provide beta-carotene (the precursor the body converts).'
      },
      {
        heading: 'Vitamins C and E: first-line antioxidants',
        body: 'The retina has one of the most active metabolisms in the body, making it especially vulnerable to oxidative stress. Vitamins C and E are water- and fat-soluble antioxidants respectively, working in synergy to neutralize free radicals generated by light and oxygen exposure. The AREDS study (2001) showed that a combination of vitamin C (500 mg), E (400 IU), beta-carotene, and zinc reduced the risk of macular degeneration progression by 25%. Citrus fruits, kiwi, peppers, and nuts are good sources of both vitamins.'
      },
    ],
  },

  // ── 8. Cuándo ver al Especialista ────────────────────────────────────────────
  {
    id: 'cuando-especialista',
    category: 'sintomas',
    titleEs: '¿Cuándo ver al Oftalmólogo? Señales que no puedes ignorar',
    titleEn: 'When to See an Ophthalmologist? Signs you can\'t ignore',
    summaryEs: 'Muchas personas visitan al especialista solo cuando el daño ya está avanzado. Conoce las señales que justifican una consulta urgente y las revisiones preventivas.',
    summaryEn: 'Many people visit a specialist only when the damage is already advanced. Learn the signs that justify an urgent consultation and preventive check-ups.',
    readMinutes: 4,
    accentFrom: 'from-pink-500',
    accentTo: 'to-rose-600',
    contentEs: [
      {
        heading: 'Motivos de consulta urgente (menos de 24 horas)',
        body: 'Visita urgencias oftalmológicas si presentas: pérdida súbita de visión en uno o ambos ojos, visión de "telón negro" o "sombra", destellos de luz no relacionados con migraña, aparición repentina de muchos cuerpos flotantes nuevos, ojo rojo intenso con dolor, visión doble de inicio agudo, o trauma ocular. Ninguno de estos síntomas debe esperar una cita programada; el retraso en el diagnóstico puede significar pérdida visual permanente.'
      },
      {
        heading: 'Señales que ameritan cita en menos de una semana',
        body: 'Agenda pronto si tienes: visión borrosa que persiste más de 24 horas y no mejora, halos alrededor de las luces (especialmente de noche), dolor ocular sordo o sensación de presión que no cede, párpado caído (ptosis) de inicio reciente, o cambio en la percepción del color. Estos síntomas pueden indicar glaucoma incipiente, cataratas en progresión, o problemas del nervio óptico que son tratables si se detectan a tiempo.'
      },
      {
        heading: 'Revisiones preventivas recomendadas',
        body: 'La frecuencia de revisiones varía según la edad y los factores de riesgo. Para adultos sanos de 18–40 años: revisión cada 2 años si no usan corrección óptica, o anualmente si la usan. De 40–65 años: anualmente o más frecuente si hay antecedentes de diabetes, hipertensión, glaucoma familiar, o uso intensivo de pantallas. Mayores de 65: cada 1–2 años o con mayor frecuencia si hay patología. Estas guías son de la AAO; el especialista puede ajustarlas según tu caso particular.'
      },
      {
        heading: 'El factor del trabajo en pantalla',
        body: 'Si trabajas más de 6 horas diarias frente a pantallas, te recomendamos revisar tu refracción al menos una vez al año, incluso si no sientes molestias. Muchos adultos tienen pequeñas necesidades de corrección (astigmatismos leves, inicio de presbicia) que no causan síntomas flagrantes pero sí generan fatiga visual acumulada. Una corrección óptica adecuada puede eliminar cefaleas crónicas y mejorar tu rendimiento sin necesidad de ningún otro tratamiento.'
      },
    ],
    contentEn: [
      {
        heading: 'Reasons for urgent consultation (within 24 hours)',
        body: 'Visit an eye emergency room if you experience: sudden vision loss in one or both eyes, vision of a "black curtain" or "shadow," light flashes unrelated to migraine, sudden appearance of many new floaters, intense red eye with pain, acute-onset double vision, or eye trauma. None of these symptoms should wait for a scheduled appointment; delay in diagnosis can mean permanent vision loss.'
      },
      {
        heading: 'Signs warranting an appointment within one week',
        body: 'Schedule soon if you have: blurred vision that persists more than 24 hours and doesn\'t improve, halos around lights (especially at night), dull eye pain or pressure sensation that doesn\'t subside, recently-onset drooping eyelid (ptosis), or change in color perception. These symptoms may indicate incipient glaucoma, progressing cataracts, or optic nerve problems that are treatable if detected early.'
      },
      {
        heading: 'Recommended preventive check-ups',
        body: 'The frequency of check-ups varies by age and risk factors. For healthy adults 18–40 years old: every 2 years if not using optical correction, or annually if they do. Ages 40–65: annually or more frequently with history of diabetes, hypertension, family glaucoma, or intensive screen use. Over 65: every 1–2 years or more frequently with pathology. These are AAO guidelines; the specialist may adjust them for your particular case.'
      },
      {
        heading: 'The screen work factor',
        body: 'If you work more than 6 hours daily in front of screens, we recommend checking your refraction at least once a year, even if you feel no discomfort. Many adults have small correction needs (mild astigmatism, onset of presbyopia) that don\'t cause obvious symptoms but do generate accumulated eye fatigue. Proper optical correction can eliminate chronic headaches and improve performance without any other treatment needed.'
      },
    ],
  },

  // ── 9. Impacto del Trabajo Remoto ────────────────────────────────────────────
  {
    id: 'impacto-trabajo-remoto',
    category: 'ciencia',
    titleEs: 'Trabajo Remoto y Salud Visual: el nuevo desafío post-pandemia',
    titleEn: 'Remote Work and Eye Health: the new post-pandemic challenge',
    summaryEs: 'El trabajo desde casa aumentó el tiempo promedio frente a pantallas en un 40–60%. Entender estos cambios es clave para proteger tu vista a largo plazo.',
    summaryEn: 'Working from home increased average screen time by 40–60%. Understanding these changes is key to protecting your vision long-term.',
    readMinutes: 5,
    accentFrom: 'from-slate-600',
    accentTo: 'to-indigo-600',
    contentEs: [
      {
        heading: 'Los datos que cambiaron todo',
        body: 'Un estudio de la University of California (2022) encontró que el tiempo promedio de uso de pantallas durante el trabajo remoto aumentó de 6.5 a 10.3 horas diarias entre 2019 y 2021. La pandemia de COVID-19 colapsó la barrera entre tiempo laboral y personal: reuniones virtuales, correo, entretenimiento y socialización ocurren en el mismo dispositivo. El resultado es una exposición digital sin precedentes para la que nuestro sistema visual no estaba diseñado evolutivamente.'
      },
      {
        heading: 'El problema del entorno doméstico',
        body: 'Las oficinas profesionales cuentan con ergonomía planificada: iluminación controlada, sillas ajustables, monitores en posición adecuada. Los entornos domésticos rara vez cumplen estos estándares. Laptops en la cama o el sofá, cocinas brillantes con ventanas frente al monitor, video llamadas desde el teléfono sostenido a 20 cm de la cara: son patrones de uso que generan niveles de fatiga visual imposibles de alcanzar en una oficina convencional. La falta de límites físicos también elimina los "micro-descansos" que antes ocurrían naturalmente al moverse entre reuniones.'
      },
      {
        heading: 'El fenómeno del "Zoom fatigue"',
        body: 'Las videollamadas generan una carga cognitiva y visual especial: el esfuerzo de mantener contacto visual con un punto fijo de la pantalla (la cámara), procesar múltiples caras simultáneamente, y verse a uno mismo en tiempo real activa regiones cerebrales adicionales que no se activan en conversaciones presenciales. Estudios de Stanford publicados en 2021 acuñaron el término "Zoom fatigue" y documentaron su impacto en la agudeza visual sostenida, la concentración y el estado de ánimo. Las pausas de 5–10 minutos entre llamadas y desactivar la auto-vista son las intervenciones más efectivas.'
      },
      {
        heading: 'Estrategias específicas para el trabajo remoto',
        body: 'Establece rituales de inicio y cierre de jornada que impliquen salir de la habitación de trabajo: esto simula los desplazamientos perdidos y da al sistema visual (y al cerebro) una señal clara de transición. Invierte en un monitor externo si usas laptop: el tamaño de pantalla, la posición ajustable y la mejor resolución marcan una diferencia medible en la fatiga diaria. Programa bloques de tiempo sin pantalla (lectura en papel, llamadas de audio) con la misma disciplina que las reuniones. Y adopta Therapheye como herramienta de monitoreo activo de tu exposición digital.'
      },
    ],
    contentEn: [
      {
        heading: 'The data that changed everything',
        body: 'A University of California study (2022) found that average screen time during remote work increased from 6.5 to 10.3 hours daily between 2019 and 2021. The COVID-19 pandemic collapsed the boundary between work and personal time: virtual meetings, email, entertainment, and socialization happen on the same device. The result is unprecedented digital exposure that our visual system was not evolutionarily designed for.'
      },
      {
        heading: 'The problem with the home environment',
        body: 'Professional offices have planned ergonomics: controlled lighting, adjustable chairs, monitors in proper position. Home environments rarely meet these standards. Laptops in bed or on the couch, bright kitchens with windows facing the monitor, video calls from a phone held 20 cm from the face: these are usage patterns that generate levels of eye fatigue impossible to reach in a conventional office. The lack of physical boundaries also eliminates the "micro-breaks" that previously occurred naturally when moving between meetings.'
      },
      {
        heading: 'The "Zoom fatigue" phenomenon',
        body: 'Video calls generate a special cognitive and visual load: the effort of maintaining eye contact with a fixed point on the screen (the camera), processing multiple faces simultaneously, and seeing oneself in real-time activates additional brain regions not activated in in-person conversations. Stanford studies published in 2021 coined the term "Zoom fatigue" and documented its impact on sustained visual acuity, concentration, and mood. 5–10 minute breaks between calls and disabling the self-view are the most effective interventions.'
      },
      {
        heading: 'Specific strategies for remote work',
        body: 'Establish start and end-of-day rituals that involve leaving the work room: this simulates the lost commute and gives the visual system (and brain) a clear transition signal. Invest in an external monitor if using a laptop: screen size, adjustable position, and better resolution make a measurable difference in daily fatigue. Schedule screen-free time blocks (paper reading, audio calls) with the same discipline as meetings. And adopt Therapheye as an active monitoring tool for your digital exposure.'
      },
    ],
  },

  // ── 10. Glaucoma ─────────────────────────────────────────────────────────────
  {
    id: 'glaucoma-epidemiologia',
    category: 'ciencia',
    titleEs: 'Glaucoma: la epidemia silenciosa que afectará a 111 millones en 2040',
    titleEn: 'Glaucoma: the silent epidemic that will affect 111 million by 2040',
    summaryEs: 'Un metaanálisis bayesiano de 50 estudios poblacionales (Tham et al. 2014) proyecta 111,8 millones de afectados para 2040. El ensayo OHTS demostró que el tratamiento precoz reduce el riesgo en un 60%.',
    summaryEn: 'A Bayesian meta-analysis of 50 population studies (Tham et al. 2014) projects 111.8 million affected by 2040. The OHTS trial showed early treatment reduces risk by 60%.',
    readMinutes: 6,
    accentFrom: 'from-violet-600',
    accentTo: 'to-purple-800',
    contentEs: [
      {
        heading: '64 millones hoy, 111 millones en 2040',
        body: 'Tham et al. (Ophthalmology, 2014) realizaron una revisión sistemática y metaanálisis bayesiano de 50 estudios poblacionales —3.770 casos de GPAA entre 140.496 examinados y 786 de GPAC entre 112.398— proyectando la carga global en adultos de 40–80 años. La prevalencia global estimada es del 3,54% (IC credible 95%: 2,09–5,82). En términos absolutos: 64,3 millones afectados en 2013, 76,0 millones en 2020 y 111,8 millones proyectados para 2040. La carga crecerá desproporcionadamente en Asia y África.'
      },
      {
        heading: 'GPAA y GPAC: dos enfermedades, dos geografías',
        body: 'El glaucoma primario de ángulo abierto (GPAA) alcanza su mayor prevalencia en África (4,20%), impulsado por la alta susceptibilidad en poblaciones de ancestría africana (OR vs. europea: 2,80). El glaucoma primario de ángulo cerrado (GPAC) es más prevalente en Asia (1,09%). Para el GPAA, los hombres tienen mayor riesgo que las mujeres (OR 1,36) y los entornos urbanos presentan mayor prevalencia que los rurales (OR 1,58). Estos patrones geográficos orientan el diseño de tamizajes y estrategias de salud pública a nivel global.'
      },
      {
        heading: 'El OHTS: el ensayo que validó el tratamiento precoz',
        body: 'Kass et al. (Arch Ophthalmol, 2002) aleatorizaron 1.636 participantes de 40–80 años con hipertensión ocular (PIO 24–32 mmHg) a medicación hipotensora tópica versus observación, con seguimiento semestral de 60 meses. La incidencia acumulada de GPAA fue 4,4% en el grupo medicado vs. 9,5% en el grupo de observación (HR 0,40; IC95% 0,27–0,59; p<0,0001). El beneficio se mantuvo tras ajustar por todos los factores de riesgo (HR ajustado 0,34). Los datos a 20 años confirmaron la eficacia duradera del tratamiento precoz.'
      },
      {
        heading: 'Los predictores clínicos que debes conocer',
        body: 'El estudio acompañante de Gordon et al. (dentro del OHTS) identificó los predictores basales de conversión a GPAA: edad avanzada, PIO basal más alta, córnea más delgada —el grosor corneal central (CCT) es ahora un parámetro estándar en la estratificación del riesgo—, cociente copa-disco vertical mayor, y desviación estándar del patrón (PSD) elevada en la perimetría. Este modelo predictivo sigue siendo la base de la práctica clínica actual para decidir cuándo iniciar tratamiento en pacientes con hipertensión ocular.'
      },
      {
        heading: 'Por qué la revisión periódica salva la visión',
        body: 'El glaucoma es asintomático hasta que el daño del nervio óptico es avanzado, momento en el que la pérdida de campo visual puede ser irreversible. Tham et al. destacaron que la carga creciente —especialmente en regiones de bajos recursos— exige estrategias de tamizaje proactivo, no reactivo. Si tienes factores de riesgo (PIO elevada, antecedentes familiares, córnea delgada, ascendencia africana o asiática, o edad >50), la detección precoz es la única intervención que puede prevenir la ceguera: el tratamiento nunca recupera la visión perdida, pero sí detiene la progresión.'
      },
    ],
    contentEn: [
      {
        heading: '64 million today, 111 million by 2040',
        body: 'Tham et al. (Ophthalmology, 2014) performed a systematic review and Bayesian meta-analysis of 50 population studies — 3,770 POAG cases among 140,496 examined and 786 PACG cases among 112,398 — projecting the global burden in adults aged 40–80. The estimated global prevalence is 3.54% (95% credible interval: 2.09–5.82). In absolute terms: 64.3 million affected in 2013, 76.0 million in 2020, and 111.8 million projected for 2040. The burden will grow disproportionately in Asia and Africa.'
      },
      {
        heading: 'POAG and PACG: two diseases, two geographies',
        body: 'Primary open-angle glaucoma (POAG) reaches its highest prevalence in Africa (4.20%), driven by high susceptibility in populations of African ancestry (OR vs. European: 2.80). Primary angle-closure glaucoma (PACG) is most prevalent in Asia (1.09%). For POAG, men have higher risk than women (OR 1.36) and urban settings show higher prevalence than rural (OR 1.58). These geographic patterns guide the design of screening and public health strategies globally.'
      },
      {
        heading: 'OHTS: the trial that validated early treatment',
        body: 'Kass et al. (Arch Ophthalmol, 2002) randomized 1,636 participants aged 40–80 with ocular hypertension (IOP 24–32 mmHg) to topical hypotensive medication versus observation, with six-monthly follow-up over 60 months. Cumulative POAG incidence was 4.4% in the treated group vs. 9.5% in the observation group (HR 0.40; 95% CI 0.27–0.59; p<0.0001). The benefit was maintained after adjusting for all risk factors (adjusted HR 0.34). Twenty-year data confirmed the lasting efficacy of early treatment.'
      },
      {
        heading: 'Clinical predictors you should know',
        body: 'The companion Gordon et al. study (within OHTS) identified baseline predictors of conversion to POAG: older age, higher baseline IOP, thinner cornea — central corneal thickness (CCT) is now a standard parameter in risk stratification —, larger vertical cup-to-disc ratio, and higher pattern standard deviation (PSD) on perimetry. This predictive model remains the basis of current clinical practice for deciding when to initiate treatment in patients with ocular hypertension.'
      },
      {
        heading: 'Why periodic check-ups save vision',
        body: 'Glaucoma is asymptomatic until optic nerve damage is advanced, by which time visual field loss may be irreversible. Tham et al. highlighted that the growing burden — especially in low-resource regions — demands proactive rather than reactive screening strategies. If you have risk factors (elevated IOP, family history, thin cornea, African or Asian ancestry, or age >50), early detection is the only intervention that can prevent blindness: treatment never recovers lost vision, but it stops progression.'
      },
    ],
  },

  // ── 11. Miopía y Tiempo Exterior ──────────────────────────────────────────────
  {
    id: 'miopia-tiempo-exterior',
    category: 'habitos',
    titleEs: 'Miopía y Tiempo al Aire Libre: la intervención que recorta su incidencia a la mitad',
    titleEn: 'Myopia and Outdoor Time: the intervention that halves its incidence',
    summaryEs: 'He et al. (JAMA, 2015) y Wu et al. (Ophthalmology, 2013) demostraron que 40–80 minutos más al día al exterior reducen la incidencia de miopía entre un 23% y un 50% en niños escolares.',
    summaryEn: 'He et al. (JAMA, 2015) and Wu et al. (Ophthalmology, 2013) showed that 40–80 extra minutes outdoors per day reduce myopia incidence by 23–50% in school-age children.',
    readMinutes: 5,
    accentFrom: 'from-green-500',
    accentTo: 'to-emerald-700',
    contentEs: [
      {
        heading: 'La epidemia de miopía: un problema creciente y prevenible',
        body: 'La miopía es una de las condiciones refractivas más prevalentes del mundo y su incidencia ha aumentado aceleradamente en las últimas décadas, especialmente en poblaciones de Asia oriental donde puede afectar al 80–90% de los jóvenes urbanos. Más allá del inconveniente visual, la miopía elevada es un factor de riesgo independiente para desprendimiento de retina, glaucoma, cataratas y degeneración macular. La identificación de intervenciones simples, baratas y escalables para reducir su incidencia es una prioridad de salud pública global.'
      },
      {
        heading: 'El ensayo de Guangzhou (He et al. 2015, JAMA)',
        body: 'He et al. aleatorizaron 12 escuelas primarias de Guangzhou (6 intervención, n=952; 6 control, n=951) con seguimiento de 3 años (2010–2013). La intervención fue tan simple como añadir una clase adicional de 40 minutos al aire libre cada día, más promoción parental de actividad exterior. Resultado: incidencia acumulada de miopía a 3 años del 30,4% en el grupo intervención vs. 39,5% en el control (diferencia −9,1%; IC95% −14,1 a −4,1). El OR ajustado por miopía parental fue 0,73 (IC95% 0,57–0,92; p=0,01). Fue el primer ensayo clínico aleatorizado a gran escala que demostró que aumentar el tiempo al exterior reduce la incidencia de miopía en niños de alto riesgo.'
      },
      {
        heading: 'El Programa ROC en Taiwán (Wu et al. 2013, Ophthalmology)',
        body: 'Wu et al. implementaron el programa Recess Outside the Classroom (ROC) en dos escuelas suburbanas de Taiwán con 571 niños de 7–11 años. La intervención promovió actividad exterior durante los recreos (~80 minutos adicionales/día). La nueva incidencia de miopía a 1 año fue del 8,41% en el grupo ROC vs. 17,65% en el control — una reducción aproximada del 50%. El efecto fue especialmente marcado en niños no miopes al inicio. Este estudio fue el fundamento del programa nacional taiwanés "Tian-Tian 120" (120 minutos diarios al aire libre), que ha revertido la tendencia creciente de miopía en escolares taiwaneses.'
      },
      {
        heading: 'Por qué el exterior protege: la ciencia detrás',
        body: 'La luz solar de alta intensidad estimula la liberación de dopamina en la retina, un neurotransmisor que inhibe el alargamiento axial del ojo — el mecanismo central del desarrollo de la miopía. Además, el exterior obliga al sistema visual a trabajar con distancias largas y variables, reduciendo la carga de acomodación sostenida que impone la lectura y las pantallas. Ninguno de estos mecanismos opera de la misma forma bajo luz artificial, incluso con lámparas de alta intensidad: la calidad espectral y la intensidad de la luz solar no son reemplazables fácilmente en interiores.'
      },
      {
        heading: 'Implicaciones prácticas para niños y adultos',
        body: 'Para niños en edad escolar, la evidencia es clara: 40–80 minutos diarios adicionales al exterior — ya sean recreos, deportes o cualquier actividad — reducen significativamente la probabilidad de desarrollar miopía. Para adultos ya miopes, el tiempo exterior no revertirá la condición, pero puede frenar su progresión y reduce el riesgo de patologías asociadas. En el contexto del trabajo digital, alternar pantallas con salidas al exterior —aunque sean de 10–15 minutos— es la intervención más asequible y con mayor respaldo científico para la salud visual a largo plazo.'
      },
    ],
    contentEn: [
      {
        heading: 'The myopia epidemic: a growing and preventable problem',
        body: 'Myopia is one of the world\'s most prevalent refractive conditions, and its incidence has grown sharply in recent decades, especially in East Asian urban populations where it can affect 80–90% of young people. Beyond visual inconvenience, high myopia is an independent risk factor for retinal detachment, glaucoma, cataracts, and macular degeneration. Identifying simple, affordable, and scalable interventions to reduce its incidence is a global public health priority.'
      },
      {
        heading: 'The Guangzhou trial (He et al. 2015, JAMA)',
        body: 'He et al. randomized 12 primary schools in Guangzhou (6 intervention, n=952; 6 control, n=951) with 3-year follow-up (2010–2013). The intervention was as simple as adding one additional 40-minute outdoor class each day, plus parental promotion of outdoor activity. Result: cumulative 3-year myopia incidence of 30.4% in the intervention group vs. 39.5% in the control (difference −9.1%; 95%CI −14.1 to −4.1). The OR adjusted for parental myopia was 0.73 (95%CI 0.57–0.92; p=0.01). It was the first large-scale randomized clinical trial to demonstrate that increasing outdoor time reduces myopia incidence in high-risk children.'
      },
      {
        heading: 'The ROC Program in Taiwan (Wu et al. 2013, Ophthalmology)',
        body: 'Wu et al. implemented the Recess Outside the Classroom (ROC) program in two suburban Taiwanese schools with 571 children aged 7–11. The intervention promoted outdoor activity during recesses (~80 additional minutes/day). New myopia incidence at 1 year was 8.41% in the ROC group vs. 17.65% in the control — approximately a 50% reduction. The effect was especially marked in non-myopic children at baseline. This study was the foundation of Taiwan\'s national "Tian-Tian 120" program (120 daily minutes outdoors), which has reversed the rising trend of myopia in Taiwanese schoolchildren.'
      },
      {
        heading: 'Why the outdoors protects: the science behind it',
        body: 'High-intensity sunlight stimulates the release of dopamine in the retina, a neurotransmitter that inhibits axial elongation of the eye — the central mechanism in myopia development. Additionally, the outdoors forces the visual system to work with long and variable distances, reducing the sustained accommodation load imposed by reading and screens. Neither mechanism operates the same way under artificial light, even high-intensity lamps: the spectral quality and intensity of sunlight are not easily replicated indoors.'
      },
      {
        heading: 'Practical implications for children and adults',
        body: 'For school-age children, the evidence is clear: 40–80 additional daily minutes outdoors — whether recesses, sports, or any activity — significantly reduce the probability of developing myopia. For adults already with myopia, outdoor time will not reverse the condition, but can slow its progression and reduces the risk of associated pathologies. In the context of digital work, alternating screens with outdoor breaks — even 10–15 minutes — is the most affordable and scientifically supported intervention for long-term visual health.'
      },
    ],
  },

  // ── 12. Ojo Seco DEWS II ─────────────────────────────────────────────────────
  {
    id: 'ojo-seco-dews',
    category: 'ciencia',
    titleEs: 'Ojo Seco: el TFOS DEWS II y lo que la ciencia dice sobre el 5–50% de la población',
    titleEn: 'Dry Eye: TFOS DEWS II and what science says about 5–50% of the population',
    summaryEs: 'Stapleton et al. (2017) establecieron que el ojo seco afecta al 5–50% de la población mundial. Jones et al. (2017) propusieron el algoritmo terapéutico escalonado que guía el tratamiento actual.',
    summaryEn: 'Stapleton et al. (2017) established dry eye affects 5–50% of the world population. Jones et al. (2017) proposed the stepwise therapeutic algorithm guiding current treatment.',
    readMinutes: 6,
    accentFrom: 'from-sky-500',
    accentTo: 'to-blue-700',
    contentEs: [
      {
        heading: '5–50%: por qué el rango es tan amplio',
        body: 'Stapleton et al. (Ocul Surf, 2017) publicaron el informe de epidemiología del segundo Dry Eye Workshop de TFOS (DEWS II), un metaanálisis de datos globales publicados. La prevalencia del ojo seco varía del 5% al 50% según el criterio diagnóstico utilizado: si solo se consideran síntomas subjetivos, la prevalencia es menor; si se incluyen también signos objetivos (tasa de parpadeo, osmolaridad lagrimal, tinción corneal), puede llegar al 75% en ciertas cohortes. Un metaanálisis bayesiano posterior (2021) acotó la estimación global al 11,59% sintomático y al 29,5% aplicando los criterios diagnósticos DEWS II completos.'
      },
      {
        heading: '¿Quién tiene mayor riesgo?',
        body: 'Stapleton et al. identificaron como factores de riesgo no modificables: la edad (incremento marcado a partir de los 50 años), el sexo femenino (las diferencias se hacen significativas con la edad, relacionadas con cambios hormonales) y la etnia asiática (factor de riesgo consistente en múltiples estudios). Los factores modificables incluyen el uso intensivo de pantallas (que reduce el parpadeo completo), las lentes de contacto, ciertos medicamentos sistémicos (antihistamínicos, antidepresivos, diuréticos) y el ambiente seco o con corrientes de aire. El estudio señaló la escasez de datos en el hemisferio sur y en poblaciones jóvenes, donde la exposición digital creciente es una preocupación emergente.'
      },
      {
        heading: 'El impacto económico: equiparable a la angina inestable',
        body: 'El DEWS II destacó que el impacto económico del ojo seco es sustancial y está dominado por la pérdida de productividad, no por los costes directos de tratamiento. En casos severos, el impacto en la calidad de vida —medido con instrumentos como el SF-36 y el NEI-VFQ— es comparable al de enfermedades como la angina inestable o la EPOC. Este dato contextualiza la importancia de abordar el ojo seco no como una molestia menor sino como una condición crónica que afecta el rendimiento laboral, el bienestar y la capacidad de usar dispositivos digitales de forma sostenida.'
      },
      {
        heading: 'El algoritmo terapéutico DEWS II (Jones et al. 2017)',
        body: 'Jones et al. (Ocul Surf, 2017) publicaron el informe de manejo del DEWS II, revisando el armamentario terapéutico disponible y proponiendo un algoritmo escalonado por severidad y subtipo. El paso 1 incluye lubricantes, modificaciones del entorno y del estilo de vida, y pausas ante pantallas. El paso 2 incorpora antiinflamatorios tópicos (ciclosporina, corticoides de corta duración) y tratamiento de la disfunción de glándulas de Meibomio. Los pasos 3 y 4 contemplan oclusión de puntos lagrimales, suero autólogo y abordajes quirúrgicos. Los autores reconocen que muchas terapias carecen de evidencia de nivel 1, y que la estrategia debe individualizarse según el subtipo (acuodeficiente vs. evaporativo/MGD).'
      },
      {
        heading: 'La convergencia con el entorno digital: DEWS III en el horizonte',
        body: 'El TFOS Lifestyle Report (2023) integró la evidencia acumulada sobre cómo el entorno digital afecta la superficie ocular: la reducción del parpadeo ante pantallas, el parpadeo incompleto que deja la córnea expuesta, y la mayor exposición corneal por la posición elevada de la mirada ante el monitor contribuyen directamente al ojo seco evaporativo. Esta es la frontera emergente que ya integran los reportes más recientes y que anticipa los contenidos del DEWS III. El ojo seco digital ya no es solo una condición clínica: es el resultado previsible de un estilo de vida moderno, y su manejo requiere tanto tratamiento médico como cambios de comportamiento ante pantallas.'
      },
    ],
    contentEn: [
      {
        heading: '5–50%: why the range is so wide',
        body: 'Stapleton et al. (Ocul Surf, 2017) published the epidemiology report for the second TFOS Dry Eye Workshop (DEWS II), a meta-analysis of global published data. Dry eye prevalence ranges from 5% to 50% depending on the diagnostic criterion used: considering only subjective symptoms yields lower prevalence; including objective signs (blink rate, tear osmolarity, corneal staining) can reach 75% in certain cohorts. A subsequent Bayesian meta-analysis (2021) narrowed the global estimate to 11.59% symptomatic and 29.5% applying full DEWS II diagnostic criteria.'
      },
      {
        heading: 'Who is at highest risk?',
        body: 'Stapleton et al. identified non-modifiable risk factors: age (marked increase after age 50), female sex (differences become significant with age, related to hormonal changes), and Asian ethnicity (a consistent risk factor across multiple studies). Modifiable factors include intensive screen use (which reduces complete blinking), contact lenses, certain systemic medications (antihistamines, antidepressants, diuretics), and dry or drafty environments. The study noted a shortage of data in the Southern Hemisphere and in young populations, where growing digital exposure is an emerging concern.'
      },
      {
        heading: 'Economic impact: comparable to unstable angina',
        body: 'DEWS II highlighted that the economic impact of dry eye is substantial and dominated by productivity loss, not direct treatment costs. In severe cases, the quality-of-life impact — measured with instruments such as the SF-36 and NEI-VFQ — is comparable to conditions like unstable angina or COPD. This contextualizes the importance of addressing dry eye not as a minor nuisance but as a chronic condition that affects work performance, well-being, and the ability to use digital devices sustainably.'
      },
      {
        heading: 'The DEWS II therapeutic algorithm (Jones et al. 2017)',
        body: 'Jones et al. (Ocul Surf, 2017) published the DEWS II management report, reviewing the therapeutic armamentarium and proposing a stepwise algorithm by severity and subtype. Step 1 includes lubricants, environmental and lifestyle modifications, and screen breaks. Step 2 incorporates topical anti-inflammatories (cyclosporine, short-term corticosteroids) and Meibomian gland dysfunction treatment. Steps 3 and 4 include punctal occlusion, autologous serum, and surgical approaches. The authors acknowledge many therapies lack Level 1 evidence, and the strategy should be individualized by subtype (aqueous-deficient vs. evaporative/MGD).'
      },
      {
        heading: 'Convergence with the digital environment: DEWS III on the horizon',
        body: 'The TFOS Lifestyle Report (2023) integrated accumulated evidence on how the digital environment affects the ocular surface: reduced blinking in front of screens, incomplete blinking that leaves the cornea exposed, and greater corneal exposure due to the elevated gaze position at the monitor all directly contribute to evaporative dry eye. This is the emerging frontier already integrated in the most recent reports and anticipated in DEWS III content. Digital dry eye is no longer just a clinical condition: it is the predictable result of a modern lifestyle, and its management requires both medical treatment and behavioral changes around screen use.'
      },
    ],
  },

  // ── 13. Por qué Therapheye ───────────────────────────────────────────────────
  {
    id: 'por-que-therapheye',
    category: 'therapheye',
    titleEs: 'Por qué existe Therapheye: ciencia aplicada a tu salud visual',
    titleEn: 'Why Therapheye exists: science applied to your eye health',
    summaryEs: 'Therapheye nació de una premisa simple: la fatiga visual digital es prevenible. Conoce el modelo científico detrás de la plataforma y cómo cada función protege tu vista.',
    summaryEn: 'Therapheye was born from a simple premise: digital eye strain is preventable. Learn the scientific model behind the platform and how each feature protects your vision.',
    readMinutes: 5,
    accentFrom: 'from-indigo-500',
    accentTo: 'to-violet-600',
    contentEs: [
      {
        heading: 'El problema que queríamos resolver',
        body: 'Más de 1.800 millones de personas en el mundo trabajan o estudian frente a pantallas más de 6 horas al día. La fatiga visual digital es su compañera más frecuente, pero solo el 12% de ellas toma alguna medida preventiva activa. La mayoría espera a sentir dolor para actuar —y para entonces, el ciclo de daño acumulado ya lleva meses. Therapheye existe para invertir ese paradigma: pasar de la reacción a la prevención con datos personalizados.'
      },
      {
        heading: 'El modelo de evaluación continua',
        body: 'La metodología de Therapheye combina tres fuentes de datos: el cuestionario de síntomas (que captura la percepción subjetiva del usuario), la prueba de agudeza visual Snellen adaptada (que mide un indicador objetivo del estado ocular), y el monitoreo de tiempo en pantalla (que cuantifica la exposición). Estos tres vectores se integran en un diagnóstico que no depende de un solo indicador, sino de la tendencia a lo largo del tiempo. Un puntaje aislado tiene poco valor; la curva de los últimos 30 días es lo que revela el patrón real.'
      },
      {
        heading: 'La prescripción de ejercicios como tratamiento',
        body: 'Therapheye no se limita a medir: prescribe. Basándose en el nivel de fatiga detectado, el cuestionario sugiere ejercicios específicos con la duración apropiada. Los ejercicios de palming, enfoque cercano-lejano, movimientos oculares y la regla 20-20-20 tienen respaldo en literatura científica revisada por pares. El historial de ejercicios completados alimenta el algoritmo de recomendaciones para que las sugerencias se vuelvan cada vez más personalizadas.'
      },
      {
        heading: 'El rol de la monitorización continua',
        body: 'La extensión de Chrome y el widget de temporizador de Therapheye permiten rastrear el tiempo real de exposición a pantallas durante la jornada laboral. Esta información es el contexto que da sentido a los demás datos: un puntaje de fatiga moderada tiene implicaciones muy distintas si ocurre tras 3 horas de pantalla o tras 10. El objetivo no es generar culpa sino dar al usuario el conocimiento necesario para tomar decisiones informadas: cuándo pausar, cuándo hacer un ejercicio, cuándo reducir la exposición.'
      },
    ],
    contentEn: [
      {
        heading: 'The problem we wanted to solve',
        body: 'More than 1.8 billion people worldwide work or study in front of screens for more than 6 hours a day. Digital eye fatigue is their most frequent companion, but only 12% of them take any active preventive measure. Most wait to feel pain before acting — and by then, the accumulated damage cycle has been running for months. Therapheye exists to reverse that paradigm: moving from reaction to prevention with personalized data.'
      },
      {
        heading: 'The continuous evaluation model',
        body: 'Therapheye\'s methodology combines three data sources: the symptom questionnaire (which captures the user\'s subjective perception), the adapted Snellen visual acuity test (which measures an objective indicator of ocular status), and screen time monitoring (which quantifies exposure). These three vectors integrate into a diagnosis that doesn\'t depend on a single indicator, but on the trend over time. An isolated score has little value; the curve of the last 30 days is what reveals the true pattern.'
      },
      {
        heading: 'Exercise prescription as treatment',
        body: 'Therapheye doesn\'t just measure: it prescribes. Based on the detected fatigue level, the questionnaire suggests specific exercises with appropriate duration. Palming, near-far focus, eye movement exercises, and the 20-20-20 rule have support in peer-reviewed scientific literature. The history of completed exercises feeds the recommendation algorithm so that suggestions become increasingly personalized.'
      },
      {
        heading: 'The role of continuous monitoring',
        body: 'The Therapheye Chrome extension and timer widget allow tracking real screen exposure time during the workday. This information is the context that gives meaning to the other data: a moderate fatigue score has very different implications if it occurs after 3 hours of screen time versus 10. The goal is not to generate guilt but to give the user the knowledge needed to make informed decisions: when to pause, when to exercise, when to reduce exposure.'
      },
    ],
  },
];
