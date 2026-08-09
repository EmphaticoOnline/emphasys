// Sonidos de "mensaje nuevo" para el chat de la Lead Page. Sintetizados con
// Web Audio API (osciladores cortos) en vez de archivos de audio: no depende
// de ningún servicio externo ni de assets binarios que mantener.

export type NotificationTone = 'discreto' | 'clasico' | 'campana' | 'pop' | 'alerta';

export const DEFAULT_NOTIFICATION_TONE: NotificationTone = 'discreto';

export const NOTIFICATION_TONE_OPTIONS: ReadonlyArray<{ value: NotificationTone; label: string }> = [
  { value: 'discreto', label: 'Discreto' },
  { value: 'clasico', label: 'Clásico' },
  { value: 'campana', label: 'Campana' },
  { value: 'pop', label: 'Pop' },
  { value: 'alerta', label: 'Alerta' },
];

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContextClass();
  }
  return sharedAudioContext;
}

type ToneSegment = {
  type?: OscillatorType;
  frequency: number;
  // Si se da, la frecuencia hace un barrido exponencial de `frequency` a
  // `endFrequency` a lo largo del segmento (usado por el tono "pop").
  endFrequency?: number;
  peakGain?: number;
};

// Primitiva compartida por todos los tonos: un oscilador con envolvente corta
// (ataque rápido, decaimiento suave) para que siempre suene como una
// notificación breve, nunca como un pitido sostenido.
function playSegment(ctx: AudioContext, startAt: number, durationSeconds: number, segment: ToneSegment) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = segment.type ?? 'sine';
  oscillator.frequency.setValueAtTime(segment.frequency, startAt);
  if (segment.endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(segment.endFrequency, startAt + durationSeconds);
  }

  const peakGain = segment.peakGain ?? 0.12;
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(peakGain, startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSeconds);

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start(startAt);
  oscillator.stop(startAt + durationSeconds);
}

// "Discreto": el sonido original de esta feature (dos notas ascendentes en
// seno), sin cambios, para no alterar el comportamiento por defecto de
// usuarios que ya lo conocían.
function playDiscreto(ctx: AudioContext) {
  const now = ctx.currentTime;
  playSegment(ctx, now, 0.12, { frequency: 880 });
  playSegment(ctx, now + 0.09, 0.14, { frequency: 1175 });
}

// "Clásico": dos notas descendentes (estilo timbre de puerta), más cálido y
// ligeramente más largo que el discreto, pero igual de corto en general.
function playClasico(ctx: AudioContext) {
  const now = ctx.currentTime;
  playSegment(ctx, now, 0.16, { frequency: 1046.5 }); // C6
  playSegment(ctx, now + 0.13, 0.22, { frequency: 784 }); // G5
}

// "Campana": fundamental + un sobretono más agudo y tenue sonando a la vez,
// con una cola de decaimiento un poco más larga — simula el timbre de una
// campana sin necesitar una muestra de audio real.
function playCampana(ctx: AudioContext) {
  const now = ctx.currentTime;
  playSegment(ctx, now, 0.38, { frequency: 659.25, peakGain: 0.11 }); // E5
  playSegment(ctx, now, 0.22, { frequency: 1583, peakGain: 0.045 }); // sobretono
}

// "Pop": un único blip percusivo con barrido de frecuencia descendente muy
// corto — el más breve de los cinco, pensado para llamar la atención sin
// sostenerse en el tiempo.
function playPop(ctx: AudioContext) {
  const now = ctx.currentTime;
  playSegment(ctx, now, 0.1, { frequency: 650, endFrequency: 180, peakGain: 0.14 });
}

// "Alerta": doble beep corto en la misma nota (onda triangular, un poco más
// presente que el seno) — el único patrón repetido, pero breve y sin
// llegar a ser estridente ni molesto para un entorno de trabajo.
function playAlerta(ctx: AudioContext) {
  const now = ctx.currentTime;
  playSegment(ctx, now, 0.08, { type: 'triangle', frequency: 987.77, peakGain: 0.13 }); // B5
  playSegment(ctx, now + 0.14, 0.08, { type: 'triangle', frequency: 987.77, peakGain: 0.13 });
}

const TONE_PLAYERS: Record<NotificationTone, (ctx: AudioContext) => void> = {
  discreto: playDiscreto,
  clasico: playClasico,
  campana: playCampana,
  pop: playPop,
  alerta: playAlerta,
};

// Desbloquea (crea + resume) el AudioContext compartido. Debe llamarse
// SINCRÓNICAMENTE dentro del handler de un gesto real del usuario (clic,
// touch, tecla) — los navegadores, especialmente Safari, solo garantizan que
// resume() haga la transición a 'running' cuando se invoca así, no cuando se
// llama después desde un callback en segundo plano (p. ej. el polling). Ver
// LeadsPage.tsx: se invoca una sola vez, en la primera interacción del
// usuario con la página.
export function unlockAudioContext(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    void ctx.resume().catch((error) => {
      console.warn('[notificationSound] No se pudo desbloquear el AudioContext en la interacción inicial', error);
    });
  }
}

export async function playNotificationSound(tone: NotificationTone = DEFAULT_NOTIFICATION_TONE): Promise<void> {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Si sigue suspendido (p. ej. todavía no hubo ninguna interacción real
    // del usuario en la página, o unlockAudioContext no llegó a resolver a
    // tiempo), se intenta reanudar aquí también, esperando el resultado
    // antes de decidir si programar el tono: si el contexto sigue
    // suspendido en ese instante, el sonido se omite en vez de perderse en
    // silencio a medio programar.
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (error) {
        console.warn('[notificationSound] resume() del AudioContext falló', error);
      }
    }

    if (ctx.state !== 'running') {
      console.warn('[notificationSound] AudioContext no está "running", se omite el sonido', { state: ctx.state });
      return;
    }

    const player = TONE_PLAYERS[tone] ?? TONE_PLAYERS[DEFAULT_NOTIFICATION_TONE];
    player(ctx);
  } catch (error) {
    console.warn('No se pudo reproducir el sonido de notificación', error);
  }
}
