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
}
