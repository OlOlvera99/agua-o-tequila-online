/**
 * BANCO DE AFIRMACIONES VIRALES
 * Extraídas de los videos más virales de Agua o Tequila y Hablemos Al Chile.
 * {yo} = jugador en turno, {otro} = otro jugador involucrado
 *
 * Cada key del VIRAL_AFFIRMATIONS corresponde 1:1 a un RelationType de types.ts.
 * Categorías marcadas como TODO están vacías o con placeholders mínimos —
 * se llenan con las afirmaciones ya curadas en sesiones de desarrollo / grabaciones.
 */

import type { RelationType } from './types';
import scenePromptsData from './scenePrompts.json';

export interface ViralAffirmation {
  text: string;
  level: 'suave' | 'picante' | 'extrema' | 'all';
}

// ═══════════ SCENE PROMPTS (para generación de imágenes) ═══════════
// Auto-generados con Sonnet 4.5 a partir de cada afirmación.
// Ver /aot-image-test/batch_generate_scene_prompts.py para regenerarlos.
type ScenePromptEntry = { text: string; level: string; scenePrompt: string | null };
const SCENE_PROMPTS = scenePromptsData as Record<string, ScenePromptEntry[]>;

/**
 * Config visible al usuario para cada tipo de relación.
 * - label: lo que se muestra en el dropdown del host
 * - roles: si es jerárquica, los roles que cada jugador debe elegir
 * - playerCount: típicamente 2 (algunos pueden ser >2 en el futuro)
 */
export const RELATION_CONFIG: Record<RelationType, {
  label: string;
  group: string;
  roles?: [string, string];
  playerCount?: number;
  ready: boolean; // true = pool curado; false = aún sin afirmaciones suficientes
}> = {
  // Parejas románticas
  novios_hetero:      { label: 'Pareja (hombre y mujer)', group: 'Parejas', ready: true },
  novios_gay:         { label: 'Pareja (dos hombres)',    group: 'Parejas', ready: true },
  novias_lesbianas:   { label: 'Pareja (dos mujeres)',    group: 'Parejas', ready: true },
  ex_pareja:          { label: 'Ex-pareja',               group: 'Parejas', ready: true },
  se_gustan:          { label: 'Se gustan / hay tensión', group: 'Parejas', ready: true },
  // Amigos
  mejores_amigos_hh:  { label: 'Mejores amigos (H-H)',    group: 'Amistad', ready: true },
  mejores_amigas_mm:  { label: 'Mejores amigas (M-M)',    group: 'Amistad', ready: true },
  amigos_hm:          { label: 'Amigo y amiga (H-M)',     group: 'Amistad', ready: true },
  amigos_generico:    { label: 'Amigos (grupo)',          group: 'Amistad', ready: true },
  rivalidad:          { label: 'Rivalidad',               group: 'Amistad', ready: true },
  // Hermanos
  hermanos_hh:        { label: 'Hermanos (H-H)',          group: 'Familia', ready: true },
  hermanos_mm:        { label: 'Hermanas (M-M)',          group: 'Familia', ready: true },
  hermanos_hm:        { label: 'Hermano y hermana',       group: 'Familia', ready: true },
  // Padres/hijos
  madre_hija:         { label: 'Madre e hija',            group: 'Familia', roles: ['madre','hija'],     ready: false },
  madre_hijo:         { label: 'Madre e hijo',            group: 'Familia', roles: ['madre','hijo'],     ready: false },
  padre_hijo:         { label: 'Padre e hijo',            group: 'Familia', roles: ['padre','hijo'],     ready: false },
  padre_hija:         { label: 'Padre e hija',            group: 'Familia', roles: ['padre','hija'],     ready: false },
  // Familia política
  suegra_nuera:       { label: 'Suegra y nuera',          group: 'Familia', roles: ['suegra','nuera'],   ready: false },
  suegro_yerno:       { label: 'Suegro y yerno',          group: 'Familia', roles: ['suegro','yerno'],   ready: false },
  // Roomies
  roomies_hh:         { label: 'Roomies (H-H)',           group: 'Convivencia', ready: false },
  roomies_mm:         { label: 'Roomies (M-M)',           group: 'Convivencia', ready: false },
  roomies_hm:         { label: 'Roomies (H-M)',           group: 'Convivencia', ready: false },
  // Laboral / formación
  jefe_empleado:      { label: 'Jefe y empleado',         group: 'Trabajo', roles: ['jefe','empleado'], ready: false },
  profesor_exalumno:  { label: 'Profesor y ex-alumno',    group: 'Trabajo', roles: ['profesor','ex-alumno'], ready: false },
  companeros_trabajo: { label: 'Compañeros de trabajo',   group: 'Trabajo', ready: true },
};

export const VIRAL_AFFIRMATIONS: Record<RelationType, ViralAffirmation[]> = {
  // ═══════════ PAREJAS ═══════════
  novios_hetero: [
    { text: '{yo} es más tóxico/a que {otro}', level: 'all' },
    { text: 'Los papás de {yo} son mejores suegros que los de {otro}', level: 'all' },
    { text: '{yo} ha perdido amistades por culpa de {otro}', level: 'picante' },
    { text: '{yo} se esfuerza más en la relación que {otro}', level: 'all' },
    { text: '{yo} ha sido la mejor pareja sexual de {otro}', level: 'extrema' },
    { text: '{yo} alguna vez se ha sentido celoso/a por un amigo/a de {otro}', level: 'picante' },
    { text: '{yo} es el/la guapo/a de la relación', level: 'all' },
    { text: '{yo} es más inteligente que {otro}', level: 'all' },
    { text: '{yo} estaría dispuesto/a a renunciar a sus sueños por los de {otro}', level: 'suave' },
    { text: 'Gracias a {otro}, {yo} es una mejor persona', level: 'suave' },
    { text: '{otro} es tacaño/a según {yo}', level: 'picante' },
    { text: 'Si {yo} y {otro} cortaran, seguirían siendo amigos/as', level: 'picante' },
    { text: 'Si {otro} se hace trans, {yo} seguiría con él/ella', level: 'extrema' },
    { text: '{yo} es más probable a ser infiel que {otro}', level: 'extrema' },
    { text: '{yo} es el/la cariñoso/a de la relación', level: 'suave' },
    { text: '{yo} da mejores regalos que {otro}', level: 'suave' },
    { text: 'A {yo} le gustaría tener una familia con {otro}', level: 'suave' },
    { text: 'Si {otro} le pidiera matrimonio hoy a {yo}, diría que sí', level: 'picante' },
  ],
  novios_gay: [
    { text: '{yo} es más tóxico que {otro}', level: 'all' },
    { text: 'Los papás de {yo} son mejores suegros que los de {otro}', level: 'all' },
    { text: '{yo} ha perdido amistades por culpa de {otro}', level: 'picante' },
    { text: '{yo} se esfuerza más en la relación que {otro}', level: 'all' },
    { text: '{yo} ha sido la mejor pareja sexual de {otro}', level: 'extrema' },
    { text: '{yo} alguna vez se ha sentido celoso por un amigo de {otro}', level: 'picante' },
    { text: '{yo} es el guapo de la relación', level: 'all' },
    { text: '{yo} la tiene más grande que el ex de {otro}', level: 'extrema' },
    { text: 'Si {yo} y {otro} cortaran, seguirían siendo amigos', level: 'picante' },
    { text: 'Si {otro} se hace trans, {yo} seguiría con él', level: 'extrema' },
    { text: '{yo} es más probable a ser infiel que {otro}', level: 'extrema' },
    { text: 'Si {otro} le pidiera matrimonio hoy a {yo}, diría que sí', level: 'picante' },
  ],
  novias_lesbianas: [
    { text: '{yo} es más tóxica que {otro}', level: 'all' },
    { text: 'Los papás de {yo} son mejores suegros que los de {otro}', level: 'all' },
    { text: '{yo} se esfuerza más en la relación que {otro}', level: 'all' },
    { text: '{yo} ha sido la mejor pareja sexual de {otro}', level: 'extrema' },
    { text: '{yo} alguna vez se ha sentido celosa por una amiga de {otro}', level: 'picante' },
    { text: '{yo} es la bonita de la relación', level: 'all' },
    { text: '{yo} ha perdido amistades por culpa de {otro}', level: 'picante' },
    { text: '{yo} es más probable a ser infiel que {otro}', level: 'extrema' },
    { text: 'Si {otro} le pidiera matrimonio hoy a {yo}, diría que sí', level: 'picante' },
  ],
  ex_pareja: [
    { text: '{yo} todavía stalkea a {otro} en redes', level: 'picante' },
    { text: '{yo} no ha superado a {otro} aunque diga que sí', level: 'picante' },
    { text: '{yo} compara a todas sus parejas con {otro}', level: 'picante' },
    { text: '{yo} volvería con {otro} si se lo pidiera', level: 'extrema' },
    { text: '{yo} fue más tóxico/a en la relación que {otro}', level: 'picante' },
  ],
  se_gustan: [
    { text: '{yo} ha imaginado cómo sería despertar junto a {otro}', level: 'picante' },
    { text: '{yo} se arregla más cuando sabe que va a ver a {otro}', level: 'suave' },
    { text: '{yo} ha stalkeado las fotos de {otro} más de lo que admite', level: 'picante' },
    { text: '{yo} se ha puesto celoso/a por algo relacionado con {otro}', level: 'picante' },
    { text: 'Si {otro} le pidiera ser novios hoy a {yo}, diría que sí', level: 'extrema' },
  ],

  // ═══════════ AMIGOS ═══════════
  mejores_amigos_hh: [
    { text: '{yo} es más probable a ser funado que {otro}', level: 'extrema' },
    { text: '{yo} es más probable a andar con una trans que {otro}', level: 'extrema' },
    { text: '{yo} gasta más en pendejadas que {otro}', level: 'all' },
    { text: 'Si {otro} pusiera un negocio, {yo} invertiría en él', level: 'suave' },
    { text: 'Es más probable que le pongan el cuerno a {yo} que a {otro}', level: 'picante' },
    { text: 'Entre {yo} y {otro} pueden matar a un oso bebé', level: 'picante' },
    { text: 'Si {yo} y {otro} fueran pareja, {yo} sería el pasivo', level: 'extrema' },
    { text: '{yo} va a terminar más pelón que {otro}', level: 'all' },
    { text: 'Si {yo} llega a morir, le gustaría que {otro} criara a sus hijos', level: 'suave' },
    { text: '{yo} es más probable a andar con alguien de OnlyFans que {otro}', level: 'extrema' },
    { text: '{yo} es más probable a ser chapulín que {otro}', level: 'picante' },
    { text: 'La hija de {yo} va a ser más facilota que la de {otro}', level: 'extrema' },
    { text: 'Si {yo} y {otro} se agarran a golpes, {yo} ganaría', level: 'all' },
    { text: 'Si {yo} viera a {otro} siendo infiel a su novia, le diría', level: 'picante' },
    { text: 'Si {yo} estuviera en una isla desierta, sobreviviría', level: 'suave' },
    { text: 'Si nadie se entera, {yo} le daría un beso a {otro}', level: 'extrema' },
    { text: 'Si {yo} tuviera que matar a su perro para salvar a {otro}, lo haría', level: 'picante' },
    { text: '{yo} es más probable a ser estéril que {otro}', level: 'extrema' },
  ],
  mejores_amigas_mm: [
    { text: '{otro} tiene más probabilidades de divorciarse que {yo}', level: 'picante' },
    { text: 'El papá de {yo} es más exitoso que el de {otro}', level: 'all' },
    { text: 'Alguna vez a {yo} le ha atraído el novio de {otro}', level: 'extrema' },
    { text: '{yo} va a ser más exitosa que {otro} profesionalmente', level: 'picante' },
    { text: '{yo} le ha tirado mierda a {otro} a sus espaldas', level: 'picante' },
    { text: 'Si no fueran amigas, a {yo} le gustaría que su hermano anduviera con {otro}', level: 'picante' },
    { text: 'Si {yo} estuviera en un avión y el piloto queda inconsciente, podría aterrizar el avión', level: 'suave' },
    { text: 'Si {yo} fuera lesbiana, andaría con {otro}', level: 'extrema' },
    { text: '{yo} es más probable a matar por dinero que {otro}', level: 'extrema' },
    { text: 'El papá de {yo} es más sexy que el de {otro}', level: 'picante' },
    { text: '{yo} es más probable a ser infiel que {otro}', level: 'extrema' },
    { text: '{yo} tiene gustos más culeros que {otro}', level: 'all' },
    { text: '{yo} se esfuerza más en mantener la amistad que {otro}', level: 'picante' },
    { text: '{yo} es más guapa que {otro}', level: 'all' },
    { text: '{otro} va a tener hijos más pendejos que los de {yo}', level: 'extrema' },
  ],
  amigos_hm: [
    { text: '{yo} tiene gustos más culeros que {otro}', level: 'all' },
    { text: '{yo} es más probable a ser gay que {otro}', level: 'extrema' },
    { text: 'Si la novia/o de {yo} se lo pide, dejaría de hablar con {otro}', level: 'picante' },
    { text: '{yo} va a ganar más dinero que {otro}', level: 'all' },
    { text: 'Si {otro} se hace trans, seguirían siendo amigos', level: 'extrema' },
    { text: '{yo} se ha masturbado pensando en {otro}', level: 'extrema' },
    { text: 'Si la mamá de {yo} se entera que son novios, se pondría feliz', level: 'picante' },
    { text: '{yo} le ha tirado mierda a {otro} con otras personas', level: 'picante' },
    { text: 'Algún novio/a de {otro} se ha puesto celoso/a de {yo}', level: 'picante' },
    { text: 'Algún amigo/a de {yo} le ha tirado el pedo a {otro}', level: 'picante' },
    { text: 'A {yo} le ha caído mal alguna novia/o de {otro}', level: 'picante' },
    { text: '{yo} es mejor wingman que {otro}', level: 'all' },
    { text: '{yo} extraña al ex de {otro}', level: 'picante' },
    { text: 'A {yo} le gustaría un novio/a como {otro}', level: 'picante' },
    { text: '{yo} cree que existe la amistad entre hombres y mujeres', level: 'suave' },
  ],
  amigos_generico: [
    { text: '{yo} gasta más en pendejadas que {otro}', level: 'all' },
    { text: 'Si {yo} y {otro} se agarran a golpes, {yo} ganaría', level: 'all' },
    { text: '{yo} es más inteligente que {otro}', level: 'all' },
    { text: '{yo} tiene gustos más culeros que {otro}', level: 'all' },
    { text: '{yo} le ha tirado mierda a {otro} a sus espaldas', level: 'picante' },
    { text: '{yo} se esfuerza más en la amistad que {otro}', level: 'picante' },
    { text: 'Si {yo} fuera del sexo opuesto, andaría con {otro}', level: 'extrema' },
    { text: 'Si {yo} viera a {otro} siendo infiel, le diría a su pareja', level: 'picante' },
    { text: '{yo} es más guapo/a que {otro}', level: 'all' },
    { text: '{yo} va a ser más exitoso/a que {otro}', level: 'picante' },
    { text: 'Si nadie se entera, {yo} le daría un beso a {otro}', level: 'extrema' },
  ],
  rivalidad: [
    { text: '{yo} secretamente admira algo de {otro}', level: 'suave' },
    { text: '{yo} ha hablado mal de {otro} esta semana', level: 'picante' },
    { text: 'Si {yo} y {otro} se agarran a golpes, {yo} ganaría', level: 'all' },
    { text: '{yo} es más exitoso/a que {otro}', level: 'picante' },
    { text: '{yo} tiene celos de algo que {otro} tiene', level: 'picante' },
  ],

  // ═══════════ HERMANOS ═══════════
  // TODO: separar el pool genérico actual en H-H, M-M, H-M con afirmaciones específicas.
  // Ricardo tiene curadas: hermanos hombres + hermanas mujeres en grabaciones pasadas.
  // El de hermano-hermana se está curando ahora en hermanos-hm.html.
  hermanos_hh: [
    { text: '{yo} cree que sus papás quieren más a {otro}', level: 'picante' },
    { text: '{yo} es más guapo que {otro}', level: 'all' },
    { text: '{yo} es más inteligente que {otro}', level: 'all' },
    { text: '{yo} es el favorito de mamá', level: 'picante' },
    { text: '{yo} le ha robado algo a {otro} sin que se dé cuenta', level: 'picante' },
    { text: '{yo} se ha sentido en la sombra de {otro}', level: 'suave' },
  ],
  hermanos_mm: [
    { text: '{yo} cree que sus papás quieren más a {otro}', level: 'picante' },
    { text: '{yo} es más guapa que {otro}', level: 'all' },
    { text: '{yo} es más inteligente que {otro}', level: 'all' },
    { text: '{yo} es la favorita de mamá', level: 'picante' },
    { text: '{yo} le ha robado algo a {otro} sin que se dé cuenta', level: 'picante' },
    { text: '{yo} se ha sentido en la sombra de {otro}', level: 'suave' },
  ],
  hermanos_hm: [
    { text: '{yo} cree que sus papás quieren más a {otro}', level: 'picante' },
    { text: '{yo} es más guapo/a que {otro}', level: 'all' },
    { text: '{yo} es más inteligente que {otro}', level: 'all' },
    { text: '{yo} es el/la favorito/a de mamá', level: 'picante' },
    { text: '{yo} le ha robado algo a {otro} sin que se dé cuenta', level: 'picante' },
    { text: '{yo} se ha sentido en la sombra de {otro}', level: 'suave' },
  ],

  // ═══════════ PADRES / HIJOS ═══════════
  // TODO: Ricardo tiene padre-hija y madre-hijo curadas. Pegar aquí.
  madre_hija: [],
  madre_hijo: [],
  padre_hijo: [],
  padre_hija: [],

  // ═══════════ FAMILIA POLÍTICA ═══════════
  // TODO: Ricardo tiene suegro-yerno curada. Suegra-nuera se está curando ahora.
  suegra_nuera: [],
  suegro_yerno: [],

  // ═══════════ ROOMIES ═══════════
  // TODO: pendiente curar.
  roomies_hh: [],
  roomies_mm: [],
  roomies_hm: [],

  // ═══════════ TRABAJO / FORMACIÓN ═══════════
  jefe_empleado: [],
  profesor_exalumno: [],
  companeros_trabajo: [
    { text: '{yo} ha hablado mal de {otro} con otros compañeros', level: 'picante' },
    { text: '{yo} gana más que {otro}', level: 'picante' },
    { text: '{yo} es mejor en su trabajo que {otro}', level: 'all' },
    { text: '{yo} se ha inventado una excusa para no ir a un evento de {otro}', level: 'suave' },
  ],
};

/**
 * Devuelve el pool filtrado por nivel para un RelationType dado.
 * Si la categoría está vacía, cae a amigos_generico.
 */
export function getPoolFor(relationType: RelationType, level: 'suave' | 'picante' | 'extrema'): ViralAffirmation[] {
  const pool = VIRAL_AFFIRMATIONS[relationType] || [];
  const filtered = pool.filter(a => a.level === 'all' || a.level === level);
  if (filtered.length === 0) {
    return VIRAL_AFFIRMATIONS.amigos_generico.filter(a => a.level === 'all' || a.level === level);
  }
  return filtered;
}

/**
 * Reemplaza placeholders {yo} y {otro} con nombres reales.
 */
export function fillTemplate(text: string, yoName: string, otroName: string): string {
  return text.replace(/\{yo\}/g, yoName).replace(/\{otro\}/g, otroName);
}

// ═══════════ SCENE PROMPTS HELPER (para generación de imágenes con Gemini) ═══════════

export interface PlayerIdentity {
  name: string;
  gender: 'hombre' | 'mujer' | 'otro';
  role?: string;
}

function describeSubject(p: PlayerIdentity, position: 1 | 2): string {
  const posWord = position === 1 ? 'FIRST' : 'SECOND';
  const genderWord = p.gender === 'hombre' ? 'man' : p.gender === 'mujer' ? 'woman' : 'person';
  const pronoun = p.gender === 'hombre' ? 'his' : p.gender === 'mujer' ? 'her' : 'their';
  const roleHint = p.role ? ` (role in this scene: ${p.role})` : '';
  return `The ${posWord} attached image is the reference photo of ${p.name} (${genderWord})${roleHint}. Preserve ${pronoun} exact likeness with FORENSIC accuracy: face geometry (jawline, nose bridge, eye spacing, brow position, lip shape), hair color and texture, skin tone, age, ethnicity. Keep real imperfections (pores, asymmetries, hair flyaways). Do NOT smooth, polish, or idealize.`;
}

/**
 * Devuelve un prompt cinematográfico hiperrealista listo para Gemini 3 Pro Image,
 * adaptado con la identidad real de los jugadores y la cláusula anti-distortion.
 *
 * - Inyecta un IDENTITY LOCK al principio (antes del prompt base), porque el batch
 *   auto-generado a veces describe la escena antes de la identidad, lo que pierde fidelidad.
 * - Reemplaza [SUBJECT_A]/[SUBJECT_B] del prompt base con los nombres reales.
 * - Añade explícitamente que la expresión NO debe deformar la geometría facial
 *   (esto resuelve casos de horror/extreme expression que generaban caras genéricas).
 *
 * Devuelve null si la afirmación no tiene scenePrompt curado en este pool.
 */
export function getScenePromptFor(
  relationType: RelationType,
  affirmationText: string,
  playerA: PlayerIdentity,
  playerB?: PlayerIdentity,
): string | null {
  const pool = SCENE_PROMPTS[relationType];
  if (!pool) return null;

  const entry = pool.find(e => e.text === affirmationText);
  if (!entry || !entry.scenePrompt) return null;

  const subjectA = describeSubject(playerA, 1);
  const subjectB = playerB ? describeSubject(playerB, 2) : '';

  const identityLock = `IDENTITY LOCK — READ THIS BEFORE THE SCENE BELOW:

${subjectA}${subjectB ? '\n\n' + subjectB : ''}

CRITICAL RULE — IDENTITY OVERRIDES EXPRESSION:
Even if the scene below describes extreme emotions (horror, shock, ecstasy, anger, drunkenness, etc.), body language, or specific facial expressions, you MUST NOT deform the face geometry to match generic stock-photo templates. Do NOT widen eyes to cartoonish proportions, do NOT stretch mouths past natural limits, do NOT raise eyebrows so high they leave their natural arch, do NOT slim or fatten faces to fit emotional archetypes. Preserve the real face proportions, eye spacing, brow position, jawline, cheek volume, and skin texture from the reference photo(s) exactly. Expression intensity must NEVER override identity preservation. The viewer must INSTANTLY recognize ${playerA.name}${playerB ? ' and ' + playerB.name : ''} as the people in the reference photos.

──────────────── SCENE ────────────────

`;

  let basePrompt = entry.scenePrompt
    .replace(/\[SUBJECT_A\]/g, playerA.name)
    .replace(/\[SUBJECT_B\]/g, playerB?.name || '[SUBJECT_B]');

  return identityLock + basePrompt;
}

