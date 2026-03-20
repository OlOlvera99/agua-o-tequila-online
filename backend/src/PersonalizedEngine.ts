import type { Player, PlayerProfile, HostSecrets, AffirmationType, GeneratedAffirmation } from './types';
import { getViralAffirmationsForPair } from './viralAffirmations';

/**
 * MOTOR DE AFIRMACIONES PERSONALIZADAS v3
 * 
 * Orden de prioridad:
 * 110 — Catalizadores IA (Claude interpreta texto libre) [generados en GameRoom]
 * 100 — Catalizadores regex de secretos del host
 *  95 — Afirmaciones virales por tipo de relación (probadas en video)
 *  90 — Catalizadores regex de comentarios de relación
 *  75 — Catalizadores regex de bio
 *  65-80 — Por tipo de relación (templates)
 *  45-50 — Por tags
 * 
 * FIX IMPORTANTE: Los secretos que el host escribe sobre un jugador generan
 * afirmaciones para el TURNO DE ESE JUGADOR (targetPlayer = ese jugador).
 * El host es un adivinador más, no tiene ventaja.
 */
export function generatePersonalizedAffirmations(
  players: Player[],
  hostSecrets: HostSecrets,
  level: 'suave' | 'picante' | 'extrema'
): GeneratedAffirmation[] {
  const results: GeneratedAffirmation[] = [];
  const playerNames = players.map(p => p.name);

  console.log(`🔍 PersonalizedEngine v3:`);
  console.log(`   Jugadores: ${playerNames.join(', ')}`);
  console.log(`   Secrets: ${JSON.stringify(Object.keys(hostSecrets))}`);

  for (const player of players) {
    if (!player.profile) continue;
    const profile = player.profile;
    const name = player.name;
    const others = playerNames.filter(n => n !== name);

    // ═══════════ PRIORIDAD 100: SECRETOS DEL HOST ═══════════
    // El host escribe sobre ESTE jugador → las afirmaciones son para el turno de ESTE jugador
    const secret = hostSecrets[name];
    if (secret && secret.trim()) {
      const catalysts = generateCatalysts(name, secret, others, profile, players, level);
      // targetPlayer = name (este jugador confirma verdad/mentira, el grupo adivina)
      results.push(...catalysts.map(c => ({ ...c, targetPlayer: name, priority: 100 })));
      console.log(`   🎯 Secret "${name}": ${catalysts.length} catalizadores`);
    }

    // ═══════════ PRIORIDAD 95: AFIRMACIONES VIRALES POR RELACIÓN ═══════════
    for (const rel of profile.relationships) {
      const otherPlayer = players.find(p => p.name === rel.targetName);
      const otherGender = otherPlayer?.profile?.gender || 'otro';

      const viralAffs = getViralAffirmationsForPair(
        rel.type, name, rel.targetName,
        profile.gender, otherGender, level
      );

      // Mezclar y tomar máximo 3 por par de jugadores para no saturar
      const shuffled = viralAffs.sort(() => Math.random() - 0.5).slice(0, 3);
      for (const text of shuffled) {
        results.push({
          text,
          type: 'interpersonal',
          targetPlayer: name,
          involvedPlayer: rel.targetName,
          priority: 95,
        });
      }
      if (shuffled.length > 0) {
        console.log(`   🎬 Viral ${name}↔${rel.targetName} (${rel.type}): ${shuffled.length} afirmaciones`);
      }
    }

    // ═══════════ PRIORIDAD 90: COMENTARIOS DE RELACIONES ═══════════
    for (const rel of profile.relationships) {
      if (rel.comment && rel.comment.trim()) {
        const catalysts = generateCatalysts(name, rel.comment, [rel.targetName], profile, players, level);
        results.push(...catalysts.map(c => ({
          ...c,
          targetPlayer: name,
          priority: 90,
          involvedPlayer: c.involvedPlayer || rel.targetName,
        })));
      }
    }

    // ═══════════ PRIORIDAD 75: BIO DEL JUGADOR ═══════════
    if (profile.bio && profile.bio.trim()) {
      const catalysts = generateCatalysts(name, profile.bio, others, profile, players, level);
      results.push(...catalysts.map(c => ({ ...c, targetPlayer: name, priority: 75 })));
    }

    // ═══════════ PRIORIDAD 45-50: TAGS ═══════════
    const tagAffs = generateFromTags(name, profile, others, level);
    results.push(...tagAffs);
  }

  // Cruzadas
  const crossAffs = generateCrossAffirmations(players, hostSecrets, level);
  results.push(...crossAffs);

  // Ordenar por prioridad
  results.sort((a, b) => {
    const pa = a.priority ?? 0;
    const pb = b.priority ?? 0;
    if (pb !== pa) return pb - pa;
    return Math.random() - 0.5;
  });

  console.log(`🔍 RESUMEN: ${results.length} total | p110:IA=${results.filter(r => r.priority === 110).length} | p100:secrets=${results.filter(r => r.priority === 100).length} | p95:viral=${results.filter(r => r.priority === 95).length} | p90:relComments=${results.filter(r => r.priority === 90).length} | p75:bio=${results.filter(r => r.priority === 75).length}`);
  if (results.length > 0) {
    console.log(`   Top 5:`);
    results.slice(0, 5).forEach(r => console.log(`     [${r.priority}] ${r.text}`));
  }

  return results;
}

// ═══════════ CATALIZADORES POR REGEX ═══════════

function generateCatalysts(
  name: string, text: string, contextNames: string[],
  profile: PlayerProfile, allPlayers: Player[], level: string
): GeneratedAffirmation[] {
  const affs: GeneratedAffirmation[] = [];
  const t = text.toLowerCase();
  const mentionedNames = contextNames.filter(n => t.includes(n.toLowerCase()));
  const randomOther = () => contextNames[Math.floor(Math.random() * contextNames.length)] || 'alguien';

  if (/dinero|deb[eo]|prest[aó]|pag[oó]|deuda|cobr|200|100.*mil|lana|varo|feria/.test(t)) {
    for (const m of mentionedNames) {
      affs.push(
        aff(`${name} ha evitado hablar de dinero con ${m}`, 'interpersonal', name, m),
        aff(`${m} desconfía de la familia de ${name}`, 'interpersonal', name, m),
        aff(`${name} ha sentido culpa por algo relacionado con ${m}`, 'interpersonal', name, m),
        aff(`${m} ha pensado que ${name} no es tan responsable como aparenta`, 'interpersonal', name, m),
      );
    }
    affs.push(aff(`${name} tiene una deuda que le quita el sueño`, 'general', name));
  }

  if (/alcohol|borracho|borracha|tomar|tomado|chup[aó]|peda|pedo|cerveza|tequila|vodka|beber|copa/.test(t)) {
    const other = randomOther();
    affs.push(
      aff(`${name} es más probable que ${other} a terminar borracho/a esta noche`, 'interpersonal', name, other),
      aff(`${name} ha usado el alcohol como escape emocional`, 'general', name),
      aff(`${name} no admitiría que a veces toma de más`, 'general', name),
    );
  }

  if (/estr[eé]s|trabaj|presion|presión|agotad|burnout|chamba|jale|cansad|hart[oa]/.test(t)) {
    affs.push(
      aff(`${name} ha llorado por estrés y no lo admite`, 'general', name),
      aff(`${name} aparenta que todo está bien cuando por dentro está agotado/a`, 'general', name),
    );
  }

  if (/peso|kilo|gordo|gorda|flaco|flaca|enflac|engord|dieta|cuerpo|gym|ejercicio|panz/.test(t)) {
    affs.push(
      aff(`${name} se ha sentido inseguro/a con su cuerpo`, 'general', name),
      aff(`${name} ha comparado su cuerpo con el de alguien de este grupo`, 'general', name),
    );
  }

  if (/novi[oa]|pareja|relaci[oó]n|anda[rn]|besar|beso|amor|gust[aá]|crush|enamor|sal[ie]r/.test(t)) {
    for (const m of mentionedNames) {
      affs.push(
        aff(`${name} piensa en ${m} más de lo que admite`, 'interpersonal', name, m),
        aff(`${name} se ha puesto celoso/a por algo relacionado con ${m}`, 'interpersonal', name, m),
      );
    }
  }

  if (/cuerno|infiel|engañ[oó]|puso el cuerno/.test(t)) {
    affs.push(
      aff(`${name} sabe de una infidelidad que no ha contado`, 'general', name),
      aff(`${name} ha perdonado algo que juró que nunca perdonaría`, 'general', name),
    );
    for (const m of mentionedNames) {
      affs.push(aff(`${name} sabe algo de ${m} que podría meterlo/a en problemas`, 'interpersonal', name, m));
    }
  }

  if (/mentir|mentira|minti[oó]|secret|escondi|oculta|no sabe/.test(t)) {
    affs.push(
      aff(`${name} le ha mentido a alguien de este grupo sobre algo serio`, 'general', name),
      aff(`${name} guarda un secreto que cambiaría cómo lo/la ven`, 'general', name),
    );
  }

  if (/pap[aá]|mam[aá]|familia|padres|hermano|hermana/.test(t)) {
    affs.push(
      aff(`${name} carga una responsabilidad familiar que pesa más de lo que aparenta`, 'general', name),
    );
    for (const m of mentionedNames) {
      affs.push(aff(`La familia de ${name} tiene una opinión fuerte sobre ${m}`, 'interpersonal', name, m));
    }
  }

  if (/pelea|pleito|discut|enojad|molest|bronca/.test(t)) {
    for (const m of mentionedNames) {
      affs.push(aff(`${name} le ha guardado rencor a ${m} más tiempo del que admite`, 'interpersonal', name, m));
    }
  }

  if (/celos|celoso|celosa|envidia/.test(t)) {
    for (const m of mentionedNames) {
      affs.push(aff(`${name} ha deseado tener algo que tiene ${m}`, 'interpersonal', name, m));
    }
  }

  // Catchall
  if (affs.length === 0 && text.trim().length > 10) {
    affs.push(aff(`${name} tiene un pasado que prefiere no tocar esta noche`, 'general', name));
    for (const m of mentionedNames) {
      affs.push(aff(`La relación entre ${name} y ${m} tiene más historia de la que aparentan`, 'interpersonal', name, m));
    }
  }

  return affs;
}

function generateCrossAffirmations(players: Player[], hostSecrets: HostSecrets, level: string): GeneratedAffirmation[] {
  const affs: GeneratedAffirmation[] = [];
  const names = players.map(p => p.name);
  const playerInfo: Record<string, string> = {};
  for (const p of players) {
    const parts: string[] = [];
    if (hostSecrets[p.name]) parts.push(hostSecrets[p.name]);
    if (p.profile?.bio) parts.push(p.profile.bio);
    playerInfo[p.name] = parts.join(' ').toLowerCase();
  }

  const themes = [
    { regex: /alcohol|borracho|tomar|peda/, template: (a: string, b: string) => `${a} aguanta más alcohol que ${b}` },
    { regex: /estr[eé]s|trabaj|cansad/, template: (a: string, b: string) => `${a} está más estresado/a que ${b} pero lo disimula mejor` },
    { regex: /peso|gordo|flaco|dieta/, template: (a: string, b: string) => `${a} se preocupa más por su apariencia que ${b}` },
  ];

  for (const theme of themes) {
    const matches = names.filter(n => theme.regex.test(playerInfo[n] || ''));
    if (matches.length >= 2) {
      affs.push({
        text: theme.template(matches[0], matches[1]),
        type: 'interpersonal', targetPlayer: matches[0], involvedPlayer: matches[1], priority: 85,
      });
    }
  }
  return affs;
}

function generateFromTags(name: string, profile: PlayerProfile, others: string[], level: string): GeneratedAffirmation[] {
  const affs: GeneratedAffirmation[] = [];
  const tags = profile.tags;
  const ro = () => others[Math.floor(Math.random() * others.length)] || 'alguien';

  if (tags.includes('coqueto')) affs.push({ ...aff(`${name} ha coqueteado con alguien de este grupo y nadie se dio cuenta`, 'general', name), priority: 50 });
  if (tags.includes('tímido')) affs.push({ ...aff(`${name} tiene opiniones fuertes que nunca dice por pena`, 'general', name), priority: 45 });
  if (tags.includes('fiestero')) affs.push({ ...aff(`${name} ha hecho algo en una fiesta de lo que se arrepiente`, 'general', name), priority: 50 });
  if (tags.includes('intenso')) affs.push({ ...aff(`${name} ha mandado más de 10 mensajes seguidos sin recibir respuesta`, 'general', name), priority: 45 });
  if (tags.includes('dramático')) affs.push({ ...aff(`${name} ha exagerado una historia para verse como la víctima`, 'general', name), priority: 45 });
  if (tags.includes('competitivo')) affs.push({ ...aff(`${name} no soporta perder contra ${ro()}`, 'interpersonal', name, ro()), priority: 45 });

  return affs;
}

function aff(text: string, type: AffirmationType, targetPlayer: string, involvedPlayer?: string): GeneratedAffirmation {
  return { text, type, targetPlayer, involvedPlayer, priority: 0 };
}
