import type { Player, PlayerProfile, HostSecrets, AffirmationType, GeneratedAffirmation } from './types';

/**
 * MOTOR DE AFIRMACIONES CATALIZADORAS
 * 
 * NO repite el chisme literalmente. Usa la info como combustible para crear
 * afirmaciones que provocan conversación sobre el tema SIN revelarlo.
 * 
 * Ejemplo: "Jorge tomó mucho alcohol por estrés" 
 * → "Jorge es más probable que Regina a terminar borracho/a esta noche"
 * → "Jorge ha usado el alcohol como escape emocional"
 * 
 * Ejemplo: "Ricardo le debe 200K a Jorge"
 * → "Jorge desconfía de la familia de Ricardo"
 * → "Ricardo ha evitado el tema de dinero con Jorge"
 */
export function generatePersonalizedAffirmations(
  players: Player[],
  hostSecrets: HostSecrets,
  level: 'suave' | 'picante' | 'extrema'
): GeneratedAffirmation[] {
  const results: GeneratedAffirmation[] = [];
  const playerNames = players.map(p => p.name);

  // ═══════════ DEBUG: Mostrar qué datos recibimos ═══════════
  console.log(`🔍 PersonalizedEngine recibió:`);
  console.log(`   Jugadores: ${playerNames.join(', ')}`);
  console.log(`   Host secrets keys: ${JSON.stringify(Object.keys(hostSecrets))}`);
  for (const [name, secret] of Object.entries(hostSecrets)) {
    console.log(`   Secret "${name}": "${secret.substring(0, 80)}..."`);
  }
  for (const p of players) {
    console.log(`   ${p.name}: profile=${!!p.profile}, bio="${p.profile?.bio?.substring(0, 50) || 'N/A'}", tags=${p.profile?.tags?.join(',') || 'N/A'}, rels=${p.profile?.relationships?.length || 0}`);
    if (p.profile?.relationships) {
      for (const r of p.profile.relationships) {
        console.log(`      rel: ${r.targetName} (${r.type}) comment="${r.comment || ''}"`);
      }
    }
  }

  for (const player of players) {
    if (!player.profile) {
      console.log(`   ⚠️ ${player.name} NO tiene profile, saltando`);
      continue;
    }
    const profile = player.profile;
    const name = player.name;
    const others = playerNames.filter(n => n !== name);

    // ═══════════ PRIORIDAD 1: CHISME DEL HOST ═══════════
    const secret = hostSecrets[name];
    if (secret && secret.trim()) {
      console.log(`   🎯 Procesando secret de ${name}: "${secret.substring(0, 80)}"`);
      const catalysts = generateCatalysts(name, secret, others, profile, players, level);
      console.log(`   → Generó ${catalysts.length} catalizadores`);
      results.push(...catalysts.map(c => ({ ...c, priority: 100 })));
    } else {
      console.log(`   ❌ No hay secret para "${name}" (keys: ${Object.keys(hostSecrets).join(', ')})`);
    }

    // ═══════════ PRIORIDAD 2: COMENTARIOS DE RELACIONES ═══════════
    for (const rel of profile.relationships) {
      if (rel.comment && rel.comment.trim()) {
        const catalysts = generateCatalysts(name, rel.comment, [rel.targetName], profile, players, level);
        results.push(...catalysts.map(c => ({
          ...c,
          priority: 90,
          involvedPlayer: c.involvedPlayer || rel.targetName,
        })));
      }
    }

    // ═══════════ PRIORIDAD 3: BIO DEL JUGADOR ═══════════
    if (profile.bio && profile.bio.trim()) {
      const catalysts = generateCatalysts(name, profile.bio, others, profile, players, level);
      results.push(...catalysts.map(c => ({ ...c, priority: 75 })));
    }

    // ═══════════ PRIORIDAD 4: RELACIONES ESPECÍFICAS ═══════════
    for (const rel of profile.relationships) {
      const relAffs = generateFromRelationType(name, rel.targetName, rel.type, profile, players, level);
      results.push(...relAffs);
    }

    // ═══════════ PRIORIDAD 5: TAGS ═══════════
    const tagAffs = generateFromTags(name, profile, others, level);
    results.push(...tagAffs);
  }

  // También generar CRUZADAS: combinar info de diferentes jugadores
  const crossAffs = generateCrossAffirmations(players, hostSecrets, level);
  results.push(...crossAffs);

  // Ordenar por prioridad y mezclar dentro del mismo nivel
  results.sort((a, b) => {
    const pa = a.priority ?? 0;
    const pb = b.priority ?? 0;
    if (pb !== pa) return pb - pa;
    return Math.random() - 0.5;
  });

  // ═══════════ DEBUG RESUMEN ═══════════
  console.log(`🔍 RESUMEN PersonalizedEngine:`);
  console.log(`   Total: ${results.length} afirmaciones`);
  console.log(`   Prioridad 100 (secrets): ${results.filter(r => r.priority === 100).length}`);
  console.log(`   Prioridad 90 (rel comments): ${results.filter(r => r.priority === 90).length}`);
  console.log(`   Prioridad 75 (bio): ${results.filter(r => r.priority === 75).length}`);
  console.log(`   Prioridad 80-85 (rel type + cross): ${results.filter(r => (r.priority ?? 0) >= 80 && (r.priority ?? 0) < 90).length}`);
  if (results.length > 0) {
    console.log(`   Primeras 5:`);
    results.slice(0, 5).forEach(r => console.log(`     [${r.priority}] ${r.text}`));
  }

  return results;
}

// ═══════════════════════════════════════════════
// MOTOR DE CATALIZADORES
// ═══════════════════════════════════════════════

function generateCatalysts(
  name: string,
  text: string,
  contextNames: string[],
  profile: PlayerProfile,
  allPlayers: Player[],
  level: string
): GeneratedAffirmation[] {
  const affs: GeneratedAffirmation[] = [];
  const t = text.toLowerCase();

  // Detectar nombres mencionados en el texto
  const mentionedNames = contextNames.filter(n => t.includes(n.toLowerCase()));
  const randomOther = () => contextNames[Math.floor(Math.random() * contextNames.length)] || 'alguien';

  // ═══════════ DEBUG CATALYST ═══════════
  const themes: string[] = [];
  if (/dinero|deb[eo]|prest[aó]|pag[oó]|deuda|cobr|200|100.*mil|lana|varo|feria/.test(t)) themes.push('dinero');
  if (/alcohol|borracho|borracha|tomar|tomado|chup[aó]|peda|pedo|cerveza|tequila|vodka|beber|copa/.test(t)) themes.push('alcohol');
  if (/estr[eé]s|trabaj|presion|presión|agotad|burnout|chamba|jale|cansad|hart[oa]/.test(t)) themes.push('estrés');
  if (/peso|kilo|gordo|gorda|flaco|flaca|enflac|engord|dieta|cuerpo|gym|ejercicio|panz/.test(t)) themes.push('peso');
  if (/novi[oa]|pareja|relaci[oó]n|anda[rn]|besar|beso|amor|gust[aá]|crush|enamor|sal[ie]r/.test(t)) themes.push('relación');
  if (/ex[\s\-]|termin[aóo]|cortaron|ruptura|superar|olvidar|trona/.test(t)) themes.push('ex');
  if (/mentir|mentira|minti[oó]|secret|escondi|oculta|engañ|no sabe/.test(t)) themes.push('mentira');
  if (/celos|celoso|celosa|envidia|envidi/.test(t)) themes.push('celos');
  if (/pap[aá]|mam[aá]|familia|padres|hermano|hermana|hijo|hija/.test(t)) themes.push('familia');
  if (/pelea|pleito|discut|enojad|molest|bronca|problema/.test(t)) themes.push('pelea');
  if (/infiel|cuerno|engañ[oó]|puso el cuerno/.test(t)) themes.push('infidelidad');
  console.log(`   🧪 Catalyst para ${name}: text="${text.substring(0, 60)}" → temas=[${themes.join(',')}], mentioned=[${mentionedNames.join(',')}]`);

  // ═══════════ DINERO / DEUDA / PRÉSTAMO ═══════════
  if (/dinero|deb[eo]|prest[aó]|pag[oó]|deuda|cobr|200|100.*mil|lana|varo|feria/.test(t)) {
    for (const mentioned of mentionedNames) {
      affs.push(
        aff(`${name} ha evitado hablar de dinero con ${mentioned}`, 'interpersonal', name, mentioned),
        aff(`${mentioned} desconfía de la familia de ${name}`, 'interpersonal', mentioned, name),
        aff(`${name} siente que ${mentioned} le echa en cara cosas sin decirlo directamente`, 'interpersonal', name, mentioned),
        aff(`${name} ha sentido culpa por algo relacionado con ${mentioned}`, 'interpersonal', name, mentioned),
        aff(`${mentioned} ha pensado que ${name} no es tan responsable como aparenta`, 'interpersonal', mentioned, name),
      );
      if (level !== 'suave') {
        affs.push(
          aff(`${name} se ha sentido menos por un tema económico frente a ${mentioned}`, 'interpersonal', name, mentioned),
          aff(`${mentioned} ha perdido algo de respeto por ${name} por temas de dinero`, 'interpersonal', mentioned, name),
        );
      }
    }
    affs.push(
      aff(`${name} tiene una deuda que le quita el sueño`, 'general', name),
      aff(`${name} ha mentido sobre su situación económica`, 'general', name),
      aff(`${name} se ha sentido presionado/a por temas de dinero`, 'general', name),
    );
  }

  // ═══════════ ALCOHOL / BORRACHERA ═══════════
  if (/alcohol|borracho|borracha|tomar|tomado|chup[aó]|peda|pedo|cerveza|tequila|vodka|beber|copa/.test(t)) {
    const other = randomOther();
    affs.push(
      aff(`${name} es más probable que ${other} a terminar borracho/a esta noche`, 'interpersonal', name, other),
      aff(`${name} ha usado el alcohol como escape emocional`, 'general', name),
      aff(`${name} no admitiría que a veces toma de más`, 'general', name),
      aff(`${name} ha hecho algo borracho/a de lo que se arrepiente profundamente`, 'general', name),
    );
    if (level !== 'suave') {
      affs.push(
        aff(`${name} ha llegado a un punto con el alcohol que le preocupa`, 'general', name),
        aff(`Alguien de este grupo ha pensado que ${name} toma demasiado`, 'general', name),
      );
    }
  }

  // ═══════════ ESTRÉS / TRABAJO ═══════════
  if (/estr[eé]s|trabaj|presion|presión|agotad|burnout|chamba|jale|cansad|hart[oa]/.test(t)) {
    affs.push(
      aff(`${name} ha llorado por estrés y no lo admite`, 'general', name),
      aff(`${name} ha pensado en mandar todo al carajo`, 'general', name),
      aff(`${name} aparenta que todo está bien cuando por dentro está agotado/a`, 'general', name),
      aff(`${name} ha sentido envidia de alguien con una vida más relajada`, 'general', name),
    );
    for (const mentioned of mentionedNames) {
      affs.push(
        aff(`${name} siente que ${mentioned} no entiende la presión que carga`, 'interpersonal', name, mentioned),
      );
    }
  }

  // ═══════════ PESO / CUERPO / IMAGEN ═══════════
  if (/peso|kilo|gordo|gorda|flaco|flaca|enflac|engord|dieta|cuerpo|gym|ejercicio|panz/.test(t)) {
    affs.push(
      aff(`${name} se ha sentido inseguro/a con su cuerpo`, 'general', name),
      aff(`${name} ha comparado su cuerpo con el de alguien de este grupo`, 'general', name),
      aff(`${name} ha evitado fotos o situaciones por cómo se veía`, 'general', name),
    );
    if (level !== 'suave') {
      affs.push(
        aff(`${name} ha sentido que alguien de aquí lo/la ha juzgado por su físico`, 'general', name),
        aff(`${name} ha hecho algo extremo para verse diferente`, 'general', name),
      );
    }
  }

  // ═══════════ RELACIÓN / PAREJA / AMOR ═══════════
  if (/novi[oa]|pareja|relaci[oó]n|anda[rn]|besar|beso|amor|gust[aá]|crush|enamor|sal[ie]r/.test(t)) {
    for (const mentioned of mentionedNames) {
      affs.push(
        aff(`${name} piensa en ${mentioned} más de lo que admite`, 'interpersonal', name, mentioned),
        aff(`${name} se ha puesto celoso/a por algo relacionado con ${mentioned}`, 'interpersonal', name, mentioned),
        aff(`${name} ha fantaseado con una vida diferente junto a ${mentioned}`, 'interpersonal', name, mentioned),
      );
    }
    affs.push(
      aff(`${name} tiene sentimientos no resueltos por alguien`, 'general', name),
    );
  }

  // ═══════════ EX / RUPTURA ═══════════
  if (/ex[\s\-]|termin[aóo]|cortaron|ruptura|superar|olvidar|trona/.test(t)) {
    affs.push(
      aff(`${name} todavía stalkea a su ex en redes`, 'general', name),
      aff(`${name} no ha superado a su ex aunque diga que sí`, 'general', name),
    );
  }

  // ═══════════ MENTIRA / SECRETO ═══════════
  if (/mentir|mentira|minti[oó]|secret|escondi|oculta|engañ|no sabe/.test(t)) {
    affs.push(
      aff(`${name} le ha mentido a alguien de este grupo sobre algo serio`, 'general', name),
      aff(`${name} guarda un secreto que cambiaría cómo lo/la ven`, 'general', name),
    );
    for (const mentioned of mentionedNames) {
      affs.push(
        aff(`${name} le ha ocultado algo a ${mentioned} por miedo`, 'interpersonal', name, mentioned),
      );
    }
  }

  // ═══════════ CELOS / ENVIDIA ═══════════
  if (/celos|celoso|celosa|envidia|envidi/.test(t)) {
    for (const mentioned of mentionedNames) {
      affs.push(
        aff(`${name} ha deseado tener algo que tiene ${mentioned}`, 'interpersonal', name, mentioned),
        aff(`${name} se ha comparado con ${mentioned} y ha salido perdiendo`, 'interpersonal', name, mentioned),
      );
    }
    affs.push(
      aff(`${name} ha sentido celos de alguien aquí y no lo ha dicho`, 'general', name),
    );
  }

  // ═══════════ FAMILIA / PAPÁS ═══════════
  if (/pap[aá]|mam[aá]|familia|padres|hermano|hermana|hijo|hija/.test(t)) {
    affs.push(
      aff(`${name} ha sentido que su familia lo/la ha decepcionado`, 'general', name),
      aff(`${name} carga una responsabilidad familiar que pesa más de lo que aparenta`, 'general', name),
    );
    for (const mentioned of mentionedNames) {
      affs.push(
        aff(`La familia de ${name} tiene una opinión fuerte sobre ${mentioned}`, 'interpersonal', name, mentioned),
      );
    }
  }

  // ═══════════ PELEA / CONFLICTO ═══════════
  if (/pelea|pleito|discut|enojad|molest|bronca|problema/.test(t)) {
    for (const mentioned of mentionedNames) {
      affs.push(
        aff(`${name} le ha guardado rencor a ${mentioned} más tiempo del que admite`, 'interpersonal', name, mentioned),
        aff(`${name} ha pensado en confrontar a ${mentioned} pero no se atrevió`, 'interpersonal', name, mentioned),
      );
    }
  }

  // ═══════════ INFIDELIDAD ═══════════
  if (/infiel|cuerno|engañ[oó]|puso el cuerno/.test(t)) {
    if (level !== 'suave') {
      affs.push(
        aff(`${name} sabe de una infidelidad que no ha contado`, 'general', name),
        aff(`${name} ha perdonado algo que juró que nunca perdonaría`, 'general', name),
      );
    }
  }

  // ═══════════ CATCHALL ═══════════
  if (affs.length === 0 && text.trim().length > 10) {
    affs.push(
      aff(`${name} tiene un pasado que prefiere no tocar esta noche`, 'general', name),
    );
    for (const mentioned of mentionedNames) {
      affs.push(
        aff(`La relación entre ${name} y ${mentioned} tiene más historia de la que aparentan`, 'interpersonal', name, mentioned),
      );
    }
  }

  return affs;
}

// ═══════════ CRUZADAS: comparaciones entre jugadores ═══════════

function generateCrossAffirmations(
  players: Player[], hostSecrets: HostSecrets, level: string
): GeneratedAffirmation[] {
  const affs: GeneratedAffirmation[] = [];
  const names = players.map(p => p.name);

  const playerInfo: Record<string, string> = {};
  for (const p of players) {
    const parts: string[] = [];
    if (hostSecrets[p.name]) parts.push(hostSecrets[p.name]);
    if (p.profile?.bio) parts.push(p.profile.bio);
    for (const rel of p.profile?.relationships || []) {
      if (rel.comment) parts.push(rel.comment);
    }
    playerInfo[p.name] = parts.join(' ').toLowerCase();
  }

  const themes = [
    { regex: /alcohol|borracho|tomar|peda|cerveza|tequila/, template: (a: string, b: string) => `${a} aguanta más alcohol que ${b}` },
    { regex: /estr[eé]s|trabaj|presion|cansad/, template: (a: string, b: string) => `${a} está más estresado/a que ${b} pero lo disimula mejor` },
    { regex: /peso|gordo|flaco|dieta|gym/, template: (a: string, b: string) => `${a} se preocupa más por su apariencia que ${b}` },
    { regex: /celos|envidia/, template: (a: string, b: string) => `${a} siente más celos que ${b} pero no lo demuestra` },
    { regex: /menti|secret|oculta/, template: (a: string, b: string) => `${a} tiene más secretos que ${b}` },
  ];

  for (const theme of themes) {
    const matches = names.filter(n => theme.regex.test(playerInfo[n] || ''));
    if (matches.length >= 2) {
      for (let i = 0; i < matches.length; i++) {
        for (let j = i + 1; j < matches.length; j++) {
          affs.push({
            text: theme.template(matches[i], matches[j]),
            type: 'interpersonal',
            targetPlayer: matches[i],
            involvedPlayer: matches[j],
            priority: 85,
          });
        }
      }
    }
  }

  return affs;
}

// ═══════════ RELACIONES ═══════════

function generateFromRelationType(
  name: string, targetName: string, relType: string, profile: PlayerProfile,
  players: Player[], level: string
): GeneratedAffirmation[] {
  const affs: GeneratedAffirmation[] = [];
  const targetProfile = players.find(p => p.name === targetName)?.profile;

  switch (relType) {
    case 'se_gustan':
      affs.push(
        { ...aff(`${name} ha imaginado cómo sería despertar junto a ${targetName}`, 'interpersonal', name, targetName), priority: 80 },
        { ...aff(`${name} se arregla más cuando sabe que va a ver a ${targetName}`, 'interpersonal', name, targetName), priority: 80 },
      );
      break;
    case 'ex_pareja':
      affs.push(
        { ...aff(`${name} compara a todas sus parejas con ${targetName}`, 'interpersonal', name, targetName), priority: 80 },
        { ...aff(`${name} ha buscado excusas para hablar con ${targetName}`, 'interpersonal', name, targetName), priority: 75 },
      );
      if (level !== 'suave') {
        affs.push(
          { ...aff(`${name} volvería con ${targetName} si se lo pidiera`, 'interpersonal', name, targetName), priority: 80 },
        );
      }
      break;
    case 'novios':
      affs.push(
        { ...aff(`${name} se ha imaginado su vida sin ${targetName}`, 'interpersonal', name, targetName), priority: 70 },
        { ...aff(`${name} tiene algo que no le ha dicho a ${targetName} por miedo a perderlo/a`, 'interpersonal', name, targetName), priority: 75 },
      );
      break;
    case 'mejores_amigos':
      affs.push(
        { ...aff(`${name} ha sentido que ${targetName} lo/la reemplazó como mejor amigo/a`, 'interpersonal', name, targetName), priority: 65 },
      );
      if (isCompatibleOrientation(profile, targetProfile)) {
        affs.push(
          { ...aff(`${name} se le ha hecho atractivo/a ${targetName} al menos una vez`, 'interpersonal', name, targetName), priority: 70 },
        );
      }
      break;
    case 'hermanos':
      affs.push(
        { ...aff(`${name} cree que sus papás quieren más a ${targetName}`, 'interpersonal', name, targetName), priority: 70 },
        { ...aff(`${name} se ha sentido en la sombra de ${targetName}`, 'interpersonal', name, targetName), priority: 70 },
      );
      break;
    case 'rivalidad':
      affs.push(
        { ...aff(`${name} secretamente admira algo de ${targetName}`, 'interpersonal', name, targetName), priority: 70 },
        { ...aff(`${name} ha hablado mal de ${targetName} esta semana`, 'interpersonal', name, targetName), priority: 75 },
      );
      break;
    case 'amigos':
      if (isCompatibleOrientation(profile, targetProfile)) {
        affs.push(
          { ...aff(`${name} se le ha hecho guapo/a ${targetName}`, 'interpersonal', name, targetName), priority: 60 },
        );
      }
      affs.push(
        { ...aff(`${name} ha pensado que la amistad con ${targetName} no es tan profunda como parece`, 'interpersonal', name, targetName), priority: 55 },
      );
      break;
    case 'compañeros_trabajo':
      affs.push(
        { ...aff(`${name} ha hablado mal de ${targetName} con otros compañeros`, 'interpersonal', name, targetName), priority: 65 },
      );
      break;
  }

  return affs;
}

// ═══════════ TAGS ═══════════

function generateFromTags(
  name: string, profile: PlayerProfile, others: string[], level: string
): GeneratedAffirmation[] {
  const affs: GeneratedAffirmation[] = [];
  const tags = profile.tags;
  const randomOther = () => others[Math.floor(Math.random() * others.length)] || 'alguien';

  if (tags.includes('coqueto')) {
    affs.push(
      { ...aff(`${name} ha coqueteado con alguien de este grupo y nadie se dio cuenta`, 'general', name), priority: 50 },
      { ...aff(`${name} coquetea más con ${randomOther()} de lo que admite`, 'interpersonal', name, randomOther()), priority: 50 },
    );
  }
  if (tags.includes('tímido')) {
    affs.push({ ...aff(`${name} tiene opiniones fuertes que nunca dice por pena`, 'general', name), priority: 45 });
  }
  if (tags.includes('fiestero')) {
    affs.push({ ...aff(`${name} ha hecho algo en una fiesta de lo que se arrepiente`, 'general', name), priority: 50 });
  }
  if (tags.includes('intenso')) {
    affs.push({ ...aff(`${name} ha mandado más de 10 mensajes seguidos sin recibir respuesta`, 'general', name), priority: 45 });
  }
  if (tags.includes('dramático')) {
    affs.push({ ...aff(`${name} ha exagerado una historia para verse como la víctima`, 'general', name), priority: 45 });
  }
  if (tags.includes('competitivo')) {
    affs.push({ ...aff(`${name} no soporta perder contra ${randomOther()}`, 'interpersonal', name, randomOther()), priority: 45 });
  }

  return affs;
}

// ═══════════ HELPERS ═══════════

function aff(text: string, type: AffirmationType, targetPlayer: string, involvedPlayer?: string): GeneratedAffirmation {
  return { text, type, targetPlayer, involvedPlayer, priority: 0 };
}

function isCompatibleOrientation(
  p1: PlayerProfile | undefined | null,
  p2: PlayerProfile | undefined | null
): boolean {
  if (!p1 || !p2) return true;
  if (p1.orientation === 'bisexual' || p2.orientation === 'bisexual') return true;
  if (p1.orientation === 'prefiero no decir' || p2.orientation === 'prefiero no decir') return true;
  if (p1.orientation === 'heterosexual' && p1.gender === p2.gender) return false;
  if (p2.orientation === 'heterosexual' && p1.gender === p2.gender) return false;
  if (p1.orientation === 'homosexual' && p1.gender !== p2.gender) return false;
  if (p2.orientation === 'homosexual' && p1.gender !== p2.gender) return false;
  return true;
}
