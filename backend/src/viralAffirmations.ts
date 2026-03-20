/**
 * BANCO DE AFIRMACIONES VIRALES
 * Extraídas de los videos más virales de Agua o Tequila y Hablemos Al Chile.
 * {yo} = jugador en turno, {otro} = otro jugador involucrado
 */

export interface ViralAffirmation {
  text: string;
  level: 'suave' | 'picante' | 'extrema' | 'all';
}

export const VIRAL_AFFIRMATIONS: Record<string, ViralAffirmation[]> = {
  'novios_hetero': [
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
  'novios_gay': [
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
  'novias_lesbianas': [
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
  'mejores_amigos_hombres': [
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
  'mejores_amigas_mujeres': [
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
  'amigos_mixto': [
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
  'amigos_generico': [
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
  'hermanos': [
    { text: '{yo} cree que sus papás quieren más a {otro}', level: 'picante' },
    { text: '{yo} es más guapo/a que {otro}', level: 'all' },
    { text: '{yo} es más inteligente que {otro}', level: 'all' },
    { text: '{yo} es el/la favorito/a de mamá', level: 'picante' },
    { text: '{yo} le ha robado algo a {otro} sin que se dé cuenta', level: 'picante' },
    { text: '{yo} se ha sentido en la sombra de {otro}', level: 'suave' },
  ],
  'ex_pareja': [
    { text: '{yo} todavía stalkea a {otro} en redes', level: 'picante' },
    { text: '{yo} no ha superado a {otro} aunque diga que sí', level: 'picante' },
    { text: '{yo} compara a todas sus parejas con {otro}', level: 'picante' },
    { text: '{yo} volvería con {otro} si se lo pidiera', level: 'extrema' },
    { text: '{yo} fue más tóxico/a en la relación que {otro}', level: 'picante' },
  ],
  'rivalidad': [
    { text: '{yo} secretamente admira algo de {otro}', level: 'suave' },
    { text: '{yo} ha hablado mal de {otro} esta semana', level: 'picante' },
    { text: 'Si {yo} y {otro} se agarran a golpes, {yo} ganaría', level: 'all' },
    { text: '{yo} es más exitoso/a que {otro}', level: 'picante' },
    { text: '{yo} tiene celos de algo que {otro} tiene', level: 'picante' },
  ],
  'se_gustan': [
    { text: '{yo} ha imaginado cómo sería despertar junto a {otro}', level: 'picante' },
    { text: '{yo} se arregla más cuando sabe que va a ver a {otro}', level: 'suave' },
    { text: '{yo} ha stalkeado las fotos de {otro} más de lo que admite', level: 'picante' },
    { text: '{yo} se ha puesto celoso/a por algo relacionado con {otro}', level: 'picante' },
    { text: 'Si {otro} le pidiera ser novios hoy a {yo}, diría que sí', level: 'extrema' },
  ],
  'companeros_trabajo': [
    { text: '{yo} ha hablado mal de {otro} con otros compañeros', level: 'picante' },
    { text: '{yo} gana más que {otro}', level: 'picante' },
    { text: '{yo} es mejor en su trabajo que {otro}', level: 'all' },
    { text: '{yo} se ha inventado una excusa para no ir a un evento de {otro}', level: 'suave' },
  ],
};

export function getViralCategory(relationType: string, gender1: string, gender2: string): string {
  switch (relationType) {
    case 'novios':
      if (gender1 === 'hombre' && gender2 === 'hombre') return 'novios_gay';
      if (gender1 === 'mujer' && gender2 === 'mujer') return 'novias_lesbianas';
      return 'novios_hetero';
    case 'mejores_amigos':
      if (gender1 === 'hombre' && gender2 === 'hombre') return 'mejores_amigos_hombres';
      if (gender1 === 'mujer' && gender2 === 'mujer') return 'mejores_amigas_mujeres';
      return 'amigos_mixto';
    case 'amigos':
      if (gender1 === 'hombre' && gender2 === 'hombre') return 'mejores_amigos_hombres';
      if (gender1 === 'mujer' && gender2 === 'mujer') return 'mejores_amigas_mujeres';
      return 'amigos_mixto';
    case 'ex_pareja': return 'ex_pareja';
    case 'hermanos': case 'familia': return 'hermanos';
    case 'se_gustan': return 'se_gustan';
    case 'rivalidad': return 'rivalidad';
    case 'compañeros_trabajo': case 'companeros_trabajo': return 'companeros_trabajo';
    default: return 'amigos_generico';
  }
}

export function getViralAffirmationsForPair(
  relationType: string, playerName: string, otherName: string,
  gender1: string, gender2: string, level: string
): string[] {
  const category = getViralCategory(relationType, gender1, gender2);
  const affs = VIRAL_AFFIRMATIONS[category] || VIRAL_AFFIRMATIONS['amigos_generico'];
  return affs
    .filter(a => a.level === 'all' || a.level === level)
    .map(a => a.text.replace(/\{yo\}/g, playerName).replace(/\{otro\}/g, otherName));
}
