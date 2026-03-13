import type {
  Player, GameSettings, PlayerProfile, HostSecrets,
  GeneratedAffirmation, RoundHistory, AffirmationType
} from './types';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

interface AffirmationContext {
  players: { name: string; profile: PlayerProfile }[];
  hostSecrets: HostSecrets;
  settings: GameSettings;
  history: RoundHistory[];
  currentPlayerName: string;
}

export class ClaudeService {
  private apiKey: string | null;

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY || null;
  }

  isAvailable(): boolean {
    return this.apiKey !== null;
  }

  /**
   * Genera un lote de afirmaciones adaptativas.
   * Primer lote: basado en perfiles y relaciones.
   * Lotes siguientes: calibrados con el historial de rondas.
   */
  async generateBatch(ctx: AffirmationContext, count: number = 8): Promise<GeneratedAffirmation[]> {
    if (!this.apiKey) return [];

    const prompt = this.buildPrompt(ctx, count);

    try {
      const response = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const data = await response.json() as any;
      const text = data.content?.[0]?.text || '';
      return this.parseResponse(text);
    } catch (err) {
      console.error('❌ Error generando afirmaciones con Claude:', err);
      return [];
    }
  }

  private buildPrompt(ctx: AffirmationContext, count: number): string {
    const { players, hostSecrets, settings, history, currentPlayerName } = ctx;

    // ═══════════ PERFILES Y RELACIONES ═══════════
    const playerProfiles = players.map(p => {
      const rel = p.profile.relationships
        .map(r => `  - ${r.targetName}: ${r.type}${r.comment ? ` (${r.comment})` : ''}`)
        .join('\n');

      const secret = hostSecrets[p.name] || '';

      return `
JUGADOR: ${p.name}
  Género: ${p.profile.gender} | Orientación: ${p.profile.orientation}
  Tags: ${p.profile.tags.join(', ')}
  Bio: ${p.profile.bio || 'N/A'}
  Relaciones:
${rel}
${secret ? `  🔒 Info secreta del host: ${secret}` : ''}`;
    }).join('\n');

    // ═══════════ HISTORIAL ADAPTATIVO ═══════════
    let historySection = '';
    if (history.length > 0) {
      const blindSpots = history.filter(h => h.blindSpotDetected);
      const recentHistory = history.slice(-5);

      historySection = `
## HISTORIAL DE RONDAS RECIENTES (usa esto para calibrar)
${recentHistory.map(h => `
  Ronda ${h.round}: "${h.affirmation}"
  → ${h.playerName} dijo: ${h.truth ? 'VERDAD' : 'MENTIRA'}
  → Grupo acertó: ${Math.round(h.groupAccuracy * 100)}%
  → ${h.blindSpotDetected ? '⚠️ PUNTO CIEGO DETECTADO: el grupo no conoce bien a ' + h.playerName + ' en este tema' : 'El grupo lo conoce bien'}
`).join('')}

${blindSpots.length > 0 ? `
## PUNTOS CIEGOS DETECTADOS (EXPLOTAR ESTOS)
El grupo ha fallado en conocer a estos jugadores en estos temas:
${blindSpots.map(h => `- ${h.playerName}: "${h.affirmation}" (solo ${Math.round(h.groupAccuracy * 100)}% acertó)`).join('\n')}
GENERA MÁS PREGUNTAS EN ESTAS ÁREAS para estos jugadores.
` : ''}`;
    }

    // ═══════════ FÓRMULAS GANADORAS ═══════════
    const formulas = `
## FÓRMULAS DE AFIRMACIONES EXITOSAS (úsalas como inspiración)

1. ROMANCE HIPOTÉTICO: "Si fuera [orientación], andaría contigo" — entre personas donde hay tensión o amistad cercana
2. COMPARACIÓN DIRECTA: "Soy más [atributo] que tú" — entre personas competitivas o hermanos
3. HONESTIDAD INCÓMODA: "Me he sentido avergonzado de ti" / "Te he tirado mierda a tus espaldas"
4. LEALTAD VS PAREJA: "Si mi novia me lo pide, dejaría de hablar contigo"
5. HIPOTÉTICO DE IDENTIDAD: "Si te haces trans, seguiremos siendo amigos"
6. SECRETOS: "Te he mentido sobre algo importante" / "Te he robado dinero"`;

    // ═══════════ PROMPT PRINCIPAL ═══════════
    return `Eres el motor de un juego de fiesta llamado "Agua o Tequila". Genera ${count} afirmaciones en primera persona para el jugador en turno.

## REGLAS DEL JUEGO
- El jugador en turno recibe una afirmación en primera persona
- Confirma en SECRETO si es verdad o mentira sobre él/ella
- Los demás adivinan si es verdad o mentira
- Quien se equivoca, toma shot

## JUGADOR EN TURNO: ${currentPlayerName}

## NIVEL: ${settings.level}
${settings.level === 'suave' ? '- Afirmaciones divertidas, ligeras, sin temas sexuales' : ''}
${settings.level === 'picante' ? '- Afirmaciones incómodas, coqueteo, secretos, pero sin ser explícito' : ''}
${settings.level === 'extrema' ? '- Afirmaciones extremas, sexuales, tabú. Empujar límites sin vulgaridad explícita' : ''}

## PERFILES DE JUGADORES
${playerProfiles}

${historySection}

${formulas}

## TIPOS DE AFIRMACIÓN (genera un mix de ambos)
- GENERAL: Sobre el jugador en turno, sin involucrar a otro jugador específico
  Ejemplo: "${currentPlayerName} alguna vez se ha limpiado con algo que no sea papel de baño"
- INTERPERSONAL: Involucra al jugador en turno + otro jugador específico, usando las relaciones y la info que tienes
  Ejemplo: "${currentPlayerName} alguna vez se le ha hecho atractiva [nombre de otro jugador según relaciones]"

## REGLAS DE GENERACIÓN
1. Usa la información de perfiles, relaciones y secretos para hacer afirmaciones ESPECÍFICAS y personalizadas
2. Las interpersonales deben usar relaciones REALES entre jugadores (si son ex, si hay tensión, si son mejores amigos, etc.)
3. Respeta la orientación sexual al generar preguntas románticas
4. Español informal mexicano/latinoamericano
5. NO repitas temas del historial
6. Las afirmaciones deben ser DIFÍCILES de adivinar — busca cosas que el grupo probablemente no sepa
7. Mix: aproximadamente 40% general, 60% interpersonal
8. CADA afirmación debe empezar con el nombre del jugador en turno en tercera persona

## FORMATO DE RESPUESTA (JSON estricto, nada más)
{"affirmations": [
  {"text": "afirmación aquí", "type": "general", "targetPlayer": "${currentPlayerName}"},
  {"text": "afirmación aquí", "type": "interpersonal", "targetPlayer": "${currentPlayerName}", "involvedPlayer": "NombreOtro"}
]}`;
  }

  private parseResponse(text: string): GeneratedAffirmation[] {
    try {
      // Limpiar markdown si viene envuelto
      const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const data = JSON.parse(clean);

      if (!data.affirmations || !Array.isArray(data.affirmations)) return [];

      return data.affirmations
        .filter((a: any) => a.text && a.type && a.targetPlayer)
        .map((a: any) => ({
          text: a.text,
          type: a.type as AffirmationType,
          targetPlayer: a.targetPlayer,
          involvedPlayer: a.involvedPlayer || undefined,
        }));
    } catch (err) {
      console.error('❌ Error parseando respuesta de Claude:', err);
      return [];
    }
  }

  /**
   * Genera catalizadores inteligentes a partir de TODO el material del cuestionario.
   * Usa IA para interpretar texto libre y crear afirmaciones que provoquen conversación.
   * Se llama UNA VEZ al iniciar el juego con toda la info disponible.
   */
  async generateCatalystBatch(
    players: { name: string; profile: PlayerProfile }[],
    hostSecrets: HostSecrets,
    level: 'suave' | 'picante' | 'extrema'
  ): Promise<GeneratedAffirmation[]> {
    if (!this.apiKey) return [];

    const prompt = this.buildCatalystPrompt(players, hostSecrets, level);

    try {
      console.log('🤖 Generando catalizadores con Claude IA...');
      const response = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const data = await response.json() as any;
      const text = data.content?.[0]?.text || '';
      const affs = this.parseResponse(text);
      console.log(`🤖 Claude generó ${affs.length} catalizadores inteligentes`);
      return affs.map(a => ({ ...a, priority: 110 })); // Máxima prioridad
    } catch (err) {
      console.error('❌ Error generando catalizadores con Claude:', err);
      return [];
    }
  }

  private buildCatalystPrompt(
    players: { name: string; profile: PlayerProfile }[],
    hostSecrets: HostSecrets,
    level: string
  ): string {
    const playerNames = players.map(p => p.name);

    // Compilar TODA la info disponible por jugador
    const playerData = players.map(p => {
      const rels = p.profile.relationships
        .map(r => `  - Con ${r.targetName}: ${r.type}${r.comment ? ` → "${r.comment}"` : ''}`)
        .join('\n');

      const secret = hostSecrets[p.name] || '';

      return `
👤 ${p.name} (${p.profile.gender}, ${p.profile.orientation})
  Tags: ${p.profile.tags.join(', ') || 'ninguno'}
  Bio: "${p.profile.bio || 'N/A'}"
  Relaciones:
${rels || '  (sin relaciones)'}
${secret ? `  🔒 CHISME DEL HOST: "${secret}"` : '  (sin chisme del host)'}`;
    }).join('\n');

    const numPerPlayer = Math.max(4, Math.ceil(30 / players.length));

    return `Eres el motor de un juego de fiesta llamado "Agua o Tequila".

## TU MISIÓN
Analiza la información que el anfitrión y los participantes escribieron sobre cada jugador. Usa esa información como COMBUSTIBLE para crear afirmaciones que PROVOQUEN CONVERSACIÓN sobre esos temas, sin revelar directamente el chisme.

## EJEMPLO DE LO QUE QUIERO
Si el host escribió: "Jorge tomó mucho alcohol por estrés del trabajo"
BIEN: "Jorge es más probable que Regina a terminar borracho esta noche"
BIEN: "Jorge ha usado el alcohol como escape emocional"
BIEN: "Jorge no admitiría públicamente que a veces toma de más"
MAL: "Jorge ha tomado mucho alcohol por estrés" ← esto es copy-paste, NO lo hagas

Si el host escribió: "Ricardo le debe 200K a Jorge porque sus papás se lo pidieron"
BIEN: "Jorge desconfía de la familia de Ricardo"
BIEN: "Ricardo ha evitado hablar de dinero con Jorge"
BIEN: "Ricardo se ha sentido culpable por algo relacionado con Jorge"
MAL: "Ricardo le debe dinero a Jorge" ← demasiado literal

La idea es que las afirmaciones CATALICEN una conversación al respecto entre los jugadores.

## DATOS DE LOS JUGADORES
${playerData}

## NIVEL: ${level}
${level === 'suave' ? 'Divertidas y ligeras, sin temas sexuales explícitos' : ''}
${level === 'picante' ? 'Incómodas, provocadoras, secretos, coqueteo' : ''}
${level === 'extrema' ? 'Extremas, tabú, empujar límites sin vulgaridad explícita' : ''}

## REGLAS
1. Genera ${numPerPlayer} afirmaciones POR JUGADOR (${numPerPlayer * players.length} total)
2. PRIORIZA el material escrito (chisme del host, comentarios de relación, bio) — cada afirmación debe estar INSPIRADA en algo que alguien escribió
3. Si un jugador tiene mucho material, genera más afirmaciones basadas en ese material
4. Si un jugador tiene poco material, usa los tags y tipos de relación
5. Las afirmaciones son en TERCERA PERSONA: "Jorge ha..." / "Ricardo siente..."
6. Las INTERPERSONALES usan nombres reales de otros jugadores presentes
7. Respeta orientación sexual para preguntas románticas
8. Español informal mexicano
9. Mezcla: ~40% generales, ~60% interpersonales
10. NUNCA repitas literalmente lo que escribieron — TRANSFORMA la info en algo que provoque conversación

## FORMATO (JSON estricto, nada más)
{"affirmations": [
  {"text": "Jorge ha usado el alcohol como escape emocional", "type": "general", "targetPlayer": "Jorge"},
  {"text": "Ricardo ha evitado hablar de dinero con Jorge", "type": "interpersonal", "targetPlayer": "Ricardo", "involvedPlayer": "Jorge"}
]}`;
  }
}
