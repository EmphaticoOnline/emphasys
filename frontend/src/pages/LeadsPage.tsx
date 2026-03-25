import React from 'react';
import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import PersonIcon from '@mui/icons-material/Person';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SendIcon from '@mui/icons-material/Send';
import ReplyIcon from '@mui/icons-material/Reply';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DescriptionIcon from '@mui/icons-material/Description';
import { apiFetch } from '../api/apiClient';

type Priority = 'Alta' | 'Media' | 'Baja';
type NextAction = 'Responder' | 'Llamar' | 'Enviar cotización' | 'Agendar demo' | 'Cerrar';
type EtapaOportunidad =
  | 'nuevo'
  | 'contactado'
  | 'interesado'
  | 'cotizado'
  | 'negociacion'
  | 'ganado'
  | 'perdido';

type ConversationSummary = {
  id: string;
  contactoId: string | null;
  telefono: string | null;
  ultimoMensaje: string | null;
  ultimoMensajeEn: string | null;
  nombre?: string | null;
  etapa_oportunidad?: EtapaOportunidad | null;
};

type ConversationMessage = {
  id: string;
  telefono: string | null;
  tipo_mensaje: 'entrante' | 'saliente';
  canal: string | null;
  contenido: string | null;
  fecha_envio: string | null;
  creado_en?: string | null;
  status: string | null;
};

type Lead = {
  id: string;
  name: string;
  phone: string;
  lastMessage: string;
  lastMessageTimeMinutesAgo: number;
  idleMinutes: number;
  awaitingResponse: boolean;
  conversation: Array<{ id: string; from: 'lead' | 'me'; text: string; minutesAgo: number; sentAt: string | null }>;
  contactoId: string | null;
  ultimoMensajeEn: string | null;
  priority: Priority;
  nextAction: NextAction;
  owner: string;
  hot: boolean;
  etapa_oportunidad: EtapaOportunidad;
};

type LeadConPrioridad = Lead & { computedPriority: Priority; seguimientoPendiente: boolean };
type QuickFilter = 'todos' | 'seguimiento' | 'alta' | 'activos';
const leadSelectMenuProps = {
  PaperProps: {
    sx: {
      '& .MuiMenuItem-root': {
        fontSize: '0.85rem',
      },
    },
  },
};

const nextActionOptions: NextAction[] = ['Responder', 'Llamar', 'Enviar cotización', 'Agendar demo', 'Cerrar'];
const priorityOptions: Priority[] = ['Alta', 'Media', 'Baja'];
const etapaOptions: EtapaOportunidad[] = ['nuevo', 'contactado', 'interesado', 'cotizado', 'negociacion', 'ganado', 'perdido'];
const REFRESH_INTERVAL_MS = 5000;
const etapaChipColor: Record<EtapaOportunidad, 'default' | 'info' | 'primary' | 'warning' | 'secondary' | 'success' | 'error'> = {
  nuevo: 'default',
  contactado: 'info',
  interesado: 'primary',
  cotizado: 'warning',
  negociacion: 'secondary',
  ganado: 'success',
  perdido: 'error',
};

const getIdleSeverity = (min: number): { color: 'default' | 'warning' | 'error'; showIcon: boolean } => {
  if (min > 180) return { color: 'error', showIcon: true };
  if (min >= 60) return { color: 'warning', showIcon: false };
  return { color: 'default', showIcon: false };
};

function formatMinutesAgo(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function minutesSince(dateString: string | null): number {
  if (!dateString) return 0;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 0;
  const diffMs = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diffMs / 60000));
}

function deriveNextAction(hasUnrepliedIncoming: boolean): NextAction {
  return hasUnrepliedIncoming ? 'Responder' : 'Responder';
}

function calcularPrioridad(lead: Lead): Priority {
  const etapa = lead.etapa_oportunidad ?? 'nuevo';
  const last = lead.conversation[lead.conversation.length - 1];
  const minutos = minutesSince(last?.sentAt ?? lead.ultimoMensajeEn);

  // Regla A: etapas cerradas → baja
  if (etapa === 'ganado' || etapa === 'perdido') {
    console.log('[prioridad] calc', { id: lead.id, etapa, lastFrom: last?.from, minutos, prioridad: 'Baja', motivo: 'etapa cerrada' });
    return 'Baja';
  }

  let prioridad: Priority = 'Media';

  // Regla B: último mensaje entrante → alta
  if (last?.from === 'lead') {
    prioridad = 'Alta';
  } else {
    // Regla C: último mensaje saliente → depende de etapa
    switch (etapa) {
      case 'nuevo':
      case 'interesado':
      case 'cotizado':
      case 'negociacion':
        prioridad = 'Alta';
        break;
      case 'contactado':
        prioridad = 'Media';
        break;
      default:
        prioridad = 'Media';
        break;
    }
  }

  // Regla D: ajuste por tiempo sin respuesta
  if (minutos > 72 * 60) {
    prioridad = 'Alta';
  } else if (minutos > 24 * 60) {
    prioridad = prioridad === 'Alta' ? 'Alta' : 'Media';
  }

  console.log('[prioridad] calc', {
    id: lead.id,
    etapa,
    lastFrom: last?.from,
    minutos,
    prioridad,
  });

  return prioridad;
}

function esSeguimientoPendiente(lead: Lead): boolean {
  const etapa = lead.etapa_oportunidad ?? 'nuevo';
  if (etapa === 'ganado' || etapa === 'perdido') return false;

  const last = lead.conversation[lead.conversation.length - 1];
  const lastFrom = last?.from;
  if (lastFrom !== 'lead') return false;

  const minutos = minutesSince(last?.sentAt ?? lead.ultimoMensajeEn);
  const limites: Record<EtapaOportunidad, number> = {
    nuevo: 15,
    contactado: 60,
    interesado: 120,
    cotizado: 360,
    negociacion: 360,
    ganado: Infinity,
    perdido: Infinity,
  };

  const limite = limites[etapa] ?? 120;
  return minutos > limite;
}

const prioridadRank: Record<Priority, number> = { Alta: 2, Media: 1, Baja: 0 };

const getLastTimestampMs = (lead: Lead): number => {
  const last = lead.conversation[lead.conversation.length - 1];
  const ts = last?.sentAt ?? lead.ultimoMensajeEn;
  const d = ts ? new Date(ts).getTime() : 0;
  return Number.isNaN(d) ? 0 : d;
};

const ordenarLeads = (a: LeadConPrioridad, b: LeadConPrioridad): number => {
  // 1) seguimiento pendiente primero
  if (a.seguimientoPendiente !== b.seguimientoPendiente) {
    return a.seguimientoPendiente ? -1 : 1;
  }

  // 2) prioridad alta > media > baja
  const prioDiff = prioridadRank[b.computedPriority] - prioridadRank[a.computedPriority];
  if (prioDiff !== 0) return prioDiff;

  // 3) más reciente primero
  return getLastTimestampMs(b) - getLastTimestampMs(a);
};

function aplicarPrioridad(lead: Lead): Lead {
  const computedPriority = calcularPrioridad(lead);
  return {
    ...lead,
    priority: computedPriority,
    hot: computedPriority === 'Alta',
  };
}

const getLatestTimestamp = (messages: ConversationMessage[]): string | null => {
  const last = messages[messages.length - 1];
  return last?.fecha_envio ?? last?.creado_en ?? null;
};

type ConversationView = Lead['conversation'][number];

const mapMessages = (messages: ConversationMessage[]): ConversationView[] => messages.map((msg) => {
  const sentAt = msg.fecha_envio || msg.creado_en || null;
  return {
    id: msg.id,
    from: msg.tipo_mensaje === 'entrante' ? 'lead' : 'me',
    text: msg.contenido || '',
    minutesAgo: minutesSince(sentAt),
    sentAt,
  } as ConversationView;
});

export default function LeadsPage() {
  const [conversations, setConversations] = React.useState<ConversationSummary[]>([]);
  const [leads, setLeads] = React.useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = React.useState<string>('');
  const [isLoadingConversations, setIsLoadingConversations] = React.useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = React.useState(false);
  const [quickReply, setQuickReply] = React.useState('');
  const [isSuggesting, setIsSuggesting] = React.useState(false);
  const [isTesting, setIsTesting] = React.useState(false);
  const [isSending, setIsSending] = React.useState(false);
  const [sendSuccess, setSendSuccess] = React.useState(false);
  const [testResults, setTestResults] = React.useState<Array<{ titulo: string; mensaje: string }>>([]);
  const [etapaMenu, setEtapaMenu] = React.useState<{ leadId: string; anchorEl: HTMLElement | null } | null>(null);
  const [leadFilter, setLeadFilter] = React.useState<QuickFilter>('todos');
  const quickReplyRef = React.useRef<HTMLInputElement | null>(null);
  const conversationEndRef = React.useRef<HTMLDivElement | null>(null);
  const conversationScrollRef = React.useRef<HTMLDivElement | null>(null);
  const lastConversationsFetchRef = React.useRef<string | null>(null);
  const [isAtBottom, setIsAtBottom] = React.useState(true);

  const leadsConPrioridad = React.useMemo<LeadConPrioridad[]>(() => {
    const enriched = leads.map((lead) => {
      const computedPriority = calcularPrioridad(lead);
      const seguimientoPendiente = esSeguimientoPendiente(lead);
      return {
        ...lead,
        priority: computedPriority,
        hot: computedPriority === 'Alta',
        computedPriority,
        seguimientoPendiente,
      };
    });

    const pendientes = enriched.filter((l) => l.seguimientoPendiente).map((l) => ({ id: l.id, etapa: l.etapa_oportunidad, minutos: l.idleMinutes }));
    console.log('[seguimiento pendiente] leads', pendientes);

    return enriched;
  }, [leads]);

  const leadsFiltradosOrdenados = React.useMemo<LeadConPrioridad[]>(() => {
    const filtered = leadsConPrioridad.filter((lead) => {
      switch (leadFilter) {
        case 'seguimiento':
          return lead.seguimientoPendiente;
        case 'alta':
          return lead.computedPriority === 'Alta';
        case 'activos':
          return lead.etapa_oportunidad !== 'ganado' && lead.etapa_oportunidad !== 'perdido';
        case 'todos':
        default:
          return true;
      }
    });

    const sorted = [...filtered].sort(ordenarLeads);
    console.log('[leads filtrados/ordenados]', { filtro: leadFilter, total: sorted.length, ids: sorted.map((l) => l.id) });
    return sorted;
  }, [leadFilter, leadsConPrioridad]);

  const selectedLead = leadsConPrioridad.find((l) => l.id === selectedLeadId) ?? leadsConPrioridad[0];
  const selectedLeadPriority = selectedLead?.computedPriority ?? 'Media';

  const buildLeadFromConversation = React.useCallback((conv: ConversationSummary): Lead => {
    const idle = minutesSince(conv.ultimoMensajeEn);
    const baseLead: Lead = {
      id: conv.id,
      name: conv.nombre?.trim() || conv.telefono || 'WhatsApp',
      phone: conv.telefono || '',
      lastMessage: conv.ultimoMensaje || '',
      lastMessageTimeMinutesAgo: idle,
      idleMinutes: idle,
      awaitingResponse: true,
      conversation: [],
      contactoId: conv.contactoId,
      ultimoMensajeEn: conv.ultimoMensajeEn,
      priority: 'Media',
      nextAction: deriveNextAction(true),
      owner: 'WhatsApp',
      hot: false,
      etapa_oportunidad: conv.etapa_oportunidad ?? 'nuevo',
    };
    return aplicarPrioridad(baseLead);
  }, []);

  const loadConversations = React.useCallback(async (opts?: { incremental?: boolean }) => {
    const incremental = opts?.incremental ?? false;
    if (!incremental) {
      setIsLoadingConversations(true);
    }

    try {
      const sinceParam = incremental && lastConversationsFetchRef.current
        ? `?since=${encodeURIComponent(lastConversationsFetchRef.current)}`
        : '';

      const response = await apiFetch(`/api/whatsapp/conversaciones${sinceParam}`);
      if (!response.ok) {
        throw new Error('Error al obtener conversaciones');
      }
      const data: ConversationSummary[] = await response.json();

      const nowIso = new Date().toISOString();
      lastConversationsFetchRef.current = nowIso;

      if (!incremental) {
        setConversations(data);
      } else if (data.length) {
        setConversations((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));
          const merged = [...prev];
          data.forEach((c) => {
            const idx = merged.findIndex((m) => m.id === c.id);
            if (idx >= 0) {
              merged[idx] = { ...merged[idx], ...c };
            } else {
              merged.unshift(c);
            }
          });
          return merged;
        });
      }

      setLeads((prev) => {
        if (!prev.length) {
          return data.map(buildLeadFromConversation);
        }

        const map = new Map(prev.map((l) => [l.id, l] as const));

        data.forEach((conv) => {
          const existing = map.get(conv.id);
          const idle = minutesSince(conv.ultimoMensajeEn);

          if (existing) {
            const updatedLead = {
              ...existing,
              name: conv.nombre?.trim() || conv.telefono || existing.name,
              phone: conv.telefono || existing.phone,
              lastMessage: conv.ultimoMensaje ?? existing.lastMessage,
              lastMessageTimeMinutesAgo: idle,
              idleMinutes: idle,
              ultimoMensajeEn: conv.ultimoMensajeEn,
              etapa_oportunidad: conv.etapa_oportunidad ?? existing.etapa_oportunidad,
            };
            map.set(conv.id, aplicarPrioridad(updatedLead));
          } else {
            map.set(conv.id, buildLeadFromConversation(conv));
          }
        });

        const mergedLeads = Array.from(map.values());

        const firstId = mergedLeads[0]?.id;
        if (!selectedLeadId && firstId) {
          setSelectedLeadId((prev) => prev || firstId);
        }

        return mergedLeads;
      });
    } catch (error) {
      console.error('Error cargando conversaciones:', error);
      if (!incremental) {
        alert('No se pudieron cargar las conversaciones de WhatsApp');
      }
    } finally {
      if (!incremental) {
        setIsLoadingConversations(false);
      }
    }
  }, [buildLeadFromConversation, selectedLeadId]);

  const loadMessages = React.useCallback(async (
    conversationId: string,
    opts?: { since?: string | null; append?: boolean; silent?: boolean }
  ) => {
    if (!conversationId) return;

    const append = opts?.append ?? false;
    const silent = opts?.silent ?? false;
    const since = opts?.since;

    if (!silent) {
      setIsLoadingMessages(true);
    }

    try {
      const sinceParam = since ? `?since=${encodeURIComponent(since)}` : '';
      const response = await apiFetch(`/api/whatsapp/conversacion/${conversationId}${sinceParam}`);
      if (!response.ok) {
        throw new Error('Error al obtener mensajes');
      }
      const data: ConversationMessage[] = await response.json();

      if (append && data.length === 0) {
        return;
      }

      const lastMsg = data[data.length - 1];
      const lastSentAt = lastMsg?.fecha_envio ?? lastMsg?.creado_en ?? null;
      const idleMinutes = minutesSince(lastSentAt);
      const awaitingResponse = lastMsg?.tipo_mensaje === 'entrante';
      const nextAction = deriveNextAction(awaitingResponse);
      const lastMessageText = lastMsg?.contenido || '';

      setLeads((prev) => prev.map((l) => {
        if (l.id !== conversationId) return l;

        const existingIds = new Set(l.conversation.map((m) => m.id));
        const mappedNew = mapMessages(data).filter((m) => !existingIds.has(m.id));
        const mergedConversation = append
          ? [...l.conversation, ...mappedNew]
          : mapMessages(data);

        const updatedLead: Lead = {
          ...l,
          lastMessage: lastMsg ? lastMessageText : l.lastMessage,
          lastMessageTimeMinutesAgo: lastMsg ? idleMinutes : l.lastMessageTimeMinutesAgo,
          idleMinutes: lastMsg ? idleMinutes : l.idleMinutes,
          nextAction: lastMsg ? nextAction : l.nextAction,
          awaitingResponse: lastMsg ? awaitingResponse : l.awaitingResponse,
          ultimoMensajeEn: lastSentAt ?? l.ultimoMensajeEn,
          conversation: mergedConversation,
        };

        return aplicarPrioridad(updatedLead);
      }));

      setConversations((prev) => prev.map((c) => (c.id === conversationId && lastSentAt
        ? { ...c, ultimoMensaje: lastMessageText, ultimoMensajeEn: lastSentAt }
        : c)));
    } catch (error) {
      console.error('Error cargando mensajes:', error);
      if (!silent) {
        alert('No se pudieron cargar los mensajes de la conversación');
      }
    } finally {
      if (!silent) {
        setIsLoadingMessages(false);
      }
    }
  }, []);

  const focusReplyInput = () => {
    requestAnimationFrame(() => quickReplyRef.current?.focus());
  };

  const handleReplyAction = (leadId: string) => {
    setSelectedLeadId(leadId);
    focusReplyInput();
  };

  const getLastSentAtForLead = React.useCallback((leadId: string): string | null => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return null;
    const last = lead.conversation[lead.conversation.length - 1];
    return last?.sentAt ?? lead.ultimoMensajeEn ?? null;
  }, [leads]);

  const refreshIdleTimers = React.useCallback(() => {
    setLeads((prev) => prev.map((l) => {
      const idle = minutesSince(l.ultimoMensajeEn);
      const updatedLead = {
        ...l,
        idleMinutes: idle,
        lastMessageTimeMinutesAgo: idle,
      };
      return aplicarPrioridad(updatedLead);
    }));
  }, []);

  React.useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  React.useEffect(() => {
    if (selectedLeadId) {
      loadMessages(selectedLeadId);
    }
  }, [loadMessages, selectedLeadId]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      loadConversations({ incremental: true });

      if (selectedLeadId) {
        const since = getLastSentAtForLead(selectedLeadId);
        loadMessages(selectedLeadId, { since, append: true, silent: true });
      }

      refreshIdleTimers();
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [getLastSentAtForLead, loadConversations, loadMessages, refreshIdleTimers, selectedLeadId]);

  const scrollToBottomIfNeeded = React.useCallback(() => {
    if (isAtBottom && conversationEndRef.current) {
      conversationEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [isAtBottom]);

  React.useEffect(() => {
    const el = conversationScrollRef.current;
    if (!el) return undefined;

    const handleScroll = () => {
      const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setIsAtBottom(distanceToBottom <= 48);
    };

    handleScroll();
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [selectedLeadId]);

  React.useEffect(() => {
    scrollToBottomIfNeeded();
  }, [scrollToBottomIfNeeded, selectedLeadId, selectedLead?.conversation.length]);

  const updateLead = (id: string, updates: Partial<Lead>) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)));
  };

  const handleOpenEtapaMenu = (leadId: string, anchorEl: HTMLElement) => {
    const lead = leads.find((l) => l.id === leadId);
    console.log('[etapa] abrir menú', { leadId, etapa: lead?.etapa_oportunidad, lead });
    setEtapaMenu({ leadId, anchorEl });
  };

  const handleCloseEtapaMenu = () => setEtapaMenu(null);

  const handleSelectEtapa = async (etapa: EtapaOportunidad) => {
    if (!etapaMenu?.leadId) return;
    const leadId = etapaMenu.leadId;
    const prev = leads.find((l) => l.id === leadId)?.etapa_oportunidad;
    console.log('[etapa] seleccionar', { leadId, etapaNueva: etapa, etapaPrev: prev });
    updateLead(leadId, { etapa_oportunidad: etapa });
    handleCloseEtapaMenu();

    try {
      const response = await apiFetch(`/api/whatsapp/conversaciones/${leadId}/etapa`, {
        method: 'PATCH',
        body: JSON.stringify({ etapa_oportunidad: etapa }),
      });
      const data = await response.json();
      console.log('[etapa] respuesta PATCH', { status: response.status, data });
      if (!response.ok) {
        throw new Error('PATCH etapa no OK');
      }
      // Actualiza con el valor real devuelto por backend
      updateLead(leadId, { etapa_oportunidad: data?.etapa_oportunidad ?? etapa });
    } catch (error) {
      console.error('Error actualizando etapa_oportunidad:', error);
      if (prev) {
        updateLead(leadId, { etapa_oportunidad: prev });
      }
    }
  };

  const handleSuggestMessage = async () => {
    if (!selectedLead) return;
    setIsSuggesting(true);
    try {
      const tiempoSinRespuesta = formatMinutesAgo(selectedLead.idleMinutes);
      const tipoLead = selectedLead.idleMinutes > 180
        ? 'Urgente'
        : selectedLead.idleMinutes >= 60
          ? 'Seguimiento'
          : 'Nuevo';

      const response = await apiFetch('/api/leads/sugerir-mensaje', {
        method: 'POST',
        body: JSON.stringify({
          nombre: selectedLead.name,
          ultimoMensaje: selectedLead.lastMessage,
          siguienteAccion: selectedLead.nextAction,
          tiempoSinRespuesta,
          prioridad: selectedLeadPriority,
          tipoLead,
          canal: 'WhatsApp',
        }),
      });

      if (!response.ok) {
        throw new Error('Error en la solicitud');
      }

      const data = await response.json();

      if (!data?.mensaje) {
        throw new Error('Respuesta inválida');
      }

      setQuickReply(data.mensaje);
      focusReplyInput();
    } catch (error) {
      console.error('Error al sugerir mensaje:', error);
      alert('No se pudo sugerir el mensaje. Intenta de nuevo.');
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleSendWhatsapp = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!selectedLead) return;
    if (!quickReply.trim()) {
      focusReplyInput();
      return;
    }

    setIsSending(true);
    try {
      const lastSentAtBeforeSend = getLastSentAtForLead(selectedLead.id);
      const response = await apiFetch('/api/whatsapp/enviar-mensaje', {
        method: 'POST',
        body: JSON.stringify({
          telefono: selectedLead.phone,
          mensaje: quickReply.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Error en la solicitud');
      }

      const messageText = quickReply.trim();
  const nowIso = new Date().toISOString();

      setQuickReply('');
      setSendSuccess(true);
      setTimeout(() => setSendSuccess(false), 2000);

      setLeads((prev) => prev.map((l) => {
        if (l.id !== selectedLead.id) return l;

        const updatedLead: Lead = {
          ...l,
          lastMessage: messageText,
          lastMessageTimeMinutesAgo: 0,
          idleMinutes: 0,
          nextAction: 'Responder',
          awaitingResponse: false,
          conversation: [
            ...l.conversation,
            {
              id: `temp-${Date.now()}`,
              from: 'me',
              text: messageText,
              minutesAgo: 0,
              sentAt: nowIso,
            },
          ],
        };

        return aplicarPrioridad(updatedLead);
      }));

      setIsAtBottom(true);
      await loadMessages(selectedLead.id, { since: lastSentAtBeforeSend, append: true, silent: true });
      await loadConversations({ incremental: true });
    } catch (error) {
      console.error('Error al enviar por WhatsApp:', error);
      alert('No se pudo enviar por WhatsApp.');
    } finally {
      setIsSending(false);
    }
  };

  const handleTestScenarios = async () => {
    setIsTesting(true);
    const escenarios = [
      {
        titulo: 'Urgente - ¿Cuánto cuesta?',
        payload: {
          nombre: 'Ana Cliente',
          ultimoMensaje: '¿Cuánto cuesta?',
          tiempoSinRespuesta: '2h',
          prioridad: 'Alta',
          tipoLead: 'Urgente',
          canal: 'WhatsApp',
          siguienteAccion: 'Responder',
        },
      },
      {
        titulo: 'Frío - Luego te aviso',
        payload: {
          nombre: 'Carlos',
          ultimoMensaje: 'Luego te aviso',
          tiempoSinRespuesta: '1d',
          prioridad: 'Baja',
          tipoLead: 'Seguimiento',
          canal: 'WhatsApp',
          siguienteAccion: 'Responder',
        },
      },
      {
        titulo: 'Molesto - No me han respondido',
        payload: {
          nombre: 'Lucía',
          ultimoMensaje: 'No me han respondido',
          tiempoSinRespuesta: '3h 20m',
          prioridad: 'Alta',
          tipoLead: 'Urgente',
          canal: 'WhatsApp',
          siguienteAccion: 'Responder',
        },
      },
      {
        titulo: 'Seguimiento - Gracias por la demo',
        payload: {
          nombre: 'Mario',
          ultimoMensaje: 'Gracias por la demo',
          tiempoSinRespuesta: '5h',
          prioridad: 'Media',
          tipoLead: 'Seguimiento',
          canal: 'WhatsApp',
          siguienteAccion: 'Agendar demo',
        },
      },
      {
        titulo: 'Nuevo - Hola, quiero info',
        payload: {
          nombre: 'Paula',
          ultimoMensaje: 'Hola, quiero info',
          tiempoSinRespuesta: '30m',
          prioridad: 'Media',
          tipoLead: 'Nuevo',
          canal: 'WhatsApp',
          siguienteAccion: 'Responder',
        },
      },
    ];

    const resultados: Array<{ titulo: string; mensaje: string }> = [];

    try {
      for (const escenario of escenarios) {
        const response = await apiFetch('/api/leads/sugerir-mensaje', {
          method: 'POST',
          body: JSON.stringify(escenario.payload),
        });

        if (!response.ok) {
          throw new Error(`Error en escenario: ${escenario.titulo}`);
        }

        const data = await response.json();
        const mensaje = data?.mensaje ?? '[sin respuesta]';
        resultados.push({ titulo: escenario.titulo, mensaje });
        console.log(`[Scenario] ${escenario.titulo}:`, mensaje);
      }

      setTestResults(resultados);
    } catch (error) {
      console.error('Error en pruebas de escenarios:', error);
      alert('No se pudieron probar los escenarios.');
    } finally {
      setIsTesting(false);
    }
  };

  const urgentLeads = leadsFiltradosOrdenados.filter((l) => l.idleMinutes > 180);
  const followUpLeads = leadsFiltradosOrdenados.filter((l) => l.idleMinutes >= 60 && l.idleMinutes <= 180);
  const newLeads = leadsFiltradosOrdenados.filter((l) => l.idleMinutes < 60);

  const attentionNow = leadsFiltradosOrdenados.filter((l) => l.awaitingResponse || l.idleMinutes >= 60);
  const otherLeads = leadsFiltradosOrdenados.filter((l) => !attentionNow.includes(l));

  const renderLeadCard = (lead: LeadConPrioridad) => {
    const { computedPriority } = lead;
    console.log('[render lead]', { id: lead.id, etapa: lead.etapa_oportunidad, priority: computedPriority, lead });

    return (
    <ListItem disablePadding key={lead.id} sx={{ mb: 1 }}>
      <ListItemButton
        selected={lead.id === selectedLead?.id}
        onClick={() => setSelectedLeadId(lead.id)}
        sx={{
          alignItems: 'flex-start',
          borderRadius: 1.5,
          border: '1px solid',
          borderColor: getIdleSeverity(lead.idleMinutes).color === 'error'
            ? 'error.main'
            : lead.id === selectedLead?.id
              ? 'primary.main'
              : getIdleSeverity(lead.idleMinutes).color === 'warning'
                ? 'warning.light'
                : 'grey.200',
          borderLeftWidth: getIdleSeverity(lead.idleMinutes).color === 'error' ? 4 : 1,
          backgroundColor: getIdleSeverity(lead.idleMinutes).color === 'error'
            ? 'error.light + 16'
            : getIdleSeverity(lead.idleMinutes).color === 'warning'
              ? 'warning.light + 12'
              : lead.id === selectedLead?.id
                ? 'primary.main + 08'
                : 'background.paper',
          py: 1.25,
        }}
      >
        <Stack spacing={0.75} sx={{ width: '100%' }}>
          <Button
            variant="contained"
            color="primary"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleReplyAction(lead.id);
            }}
            sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 800 }}
          >
            {lead.nextAction}
          </Button>

          <Stack direction="row" alignItems="center" spacing={1} justifyContent="space-between">
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="subtitle1" fontWeight={700} noWrap>
                {lead.name?.trim() || `WhatsApp ${lead.phone}`}
              </Typography>
              {lead.etapa_oportunidad && (
                <Chip
                  size="small"
                  label={lead.etapa_oportunidad}
                  color={etapaChipColor[lead.etapa_oportunidad]}
                  sx={{ textTransform: 'capitalize' }}
                  onClick={(e) => handleOpenEtapaMenu(lead.id, e.currentTarget)}
                  clickable
                />
              )}
              {lead.seguimientoPendiente && (
                <Chip
                  size="small"
                  label="Seguimiento pendiente"
                  color="warning"
                  variant="filled"
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                />
              )}
            </Stack>
            {lead.hot && <WhatshotIcon color="error" fontSize="small" titleAccess="Lead caliente" />}
          </Stack>

          <Typography variant="body2" color="text.primary" noWrap>
            {lead.lastMessage}
          </Typography>

              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                {(() => {
                  const idle = getIdleSeverity(lead.idleMinutes);
                  const isCritical = idle.color === 'error';
                  const chipIcon = idle.showIcon
                    ? <WarningAmberIcon fontSize="small" />
                    : idle.color === 'warning'
                      ? <AccessTimeIcon fontSize="small" />
                      : idle.color === 'default'
                        ? <AccessTimeIcon fontSize="small" />
                        : null;
                  const chipProps = {
                    size: 'small' as const,
                    label: `Sin respuesta: ${formatMinutesAgo(lead.idleMinutes)}`,
                    color: idle.color,
                    sx: {
                      fontWeight: idle.color !== 'default' ? 700 : 500,
                      px: 1,
                      '& .MuiChip-icon': {
                        color: isCritical ? 'common.white' : undefined,
                        opacity: isCritical ? 0.9 : undefined,
                        textShadow: isCritical ? '0 0 1px rgba(0,0,0,0.35)' : undefined,
                        ...(idle.color === 'default' ? { color: 'text.disabled' } : {}),
                      },
                    },
                  };

                  return chipIcon ? (
                    <Chip {...chipProps} icon={chipIcon} />
                  ) : (
                    <Chip {...chipProps} />
                  );
                })()}
              </Stack>

          <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary' }} flexWrap="wrap">
            <AccessTimeIcon fontSize="small" />
            <Typography variant="body2">{formatMinutesAgo(lead.lastMessageTimeMinutesAgo)} atrás</Typography>
            <Typography variant="body2" color="text.disabled">
              · {lead.owner}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="flex-start" flexWrap="wrap" useFlexGap>
            <TextField
              select
              size="small"
              label="Acción recomendada"
              value={lead.nextAction}
              onChange={(e) => updateLead(lead.id, { nextAction: e.target.value as NextAction })}
              SelectProps={{ MenuProps: leadSelectMenuProps }}
              sx={{
                flex: '1 1 200px',
                minWidth: 0,
                '& .MuiInputBase-input': { fontWeight: 700, fontSize: '0.85rem' },
                '& .MuiInputLabel-root': { fontWeight: 700 },
              }}
            >
              {nextActionOptions.map((a) => (
                <MenuItem key={a} value={a}>
                  {a}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Prioridad"
              value={computedPriority}
              onChange={(e) => updateLead(lead.id, { priority: e.target.value as Priority })}
              SelectProps={{ MenuProps: leadSelectMenuProps }}
              sx={{
                flex: '0 1 140px',
                minWidth: 0,
                '& .MuiInputBase-input': { color: 'text.secondary', fontSize: '0.85rem' },
                '& .MuiInputLabel-root': { color: 'text.secondary', fontSize: '0.85rem' },
              }}
            >
              {priorityOptions.map((p) => (
                <MenuItem key={p} value={p}>
                  {p}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </Stack>
      </ListItemButton>
    </ListItem>
  ); };

  const etapaMenuLead = etapaMenu ? leads.find((l) => l.id === etapaMenu.leadId) : null;

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Menu
        anchorEl={etapaMenu?.anchorEl ?? null}
        open={Boolean(etapaMenu)}
        onClose={handleCloseEtapaMenu}
        MenuListProps={{ dense: true }}
      >
        {etapaOptions.map((etapa) => (
          <MenuItem
            key={etapa}
            selected={etapaMenuLead?.etapa_oportunidad === etapa}
            onClick={() => handleSelectEtapa(etapa)}
            sx={{ textTransform: 'capitalize' }}
          >
            {etapa}
          </MenuItem>
        ))}
      </Menu>

      <Stack direction="row" alignItems="center" spacing={2}>
        <Typography variant="h5" fontWeight={700}>
          Leads
        </Typography>
        <Chip label="MVP operativo" color="primary" variant="outlined" />
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Chip label={`Urgentes: ${urgentLeads.length}`} color={urgentLeads.length ? 'error' : 'default'} variant={urgentLeads.length ? 'filled' : 'outlined'} />
        <Chip label={`En seguimiento: ${followUpLeads.length}`} color={followUpLeads.length ? 'warning' : 'default'} variant={followUpLeads.length ? 'filled' : 'outlined'} />
        <Chip label={`Nuevos: ${newLeads.length}`} color={newLeads.length ? 'primary' : 'default'} variant={newLeads.length ? 'filled' : 'outlined'} />
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1.1fr 1.1fr' },
          gap: 2,
          minHeight: '70vh',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: 72,
            }}
          >
            <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={700}>
                Lista de leads
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                Agrupados por urgencia. Ajusta prioridad y siguiente acción en línea.
              </Typography>
            </Stack>
            <Chip label={`${leadsFiltradosOrdenados.length} visibles`} size="small" sx={{ ml: 1.5, flexShrink: 0 }} />
          </Box>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {(
              [
                { key: 'todos', label: 'Todos' },
                { key: 'seguimiento', label: 'Seguimiento pendiente' },
                { key: 'alta', label: 'Alta prioridad' },
                { key: 'activos', label: 'Activos' },
              ] as const
            ).map((opt) => (
              <Chip
                key={opt.key}
                label={opt.label}
                color={leadFilter === opt.key ? 'primary' : 'default'}
                variant={leadFilter === opt.key ? 'filled' : 'outlined'}
                onClick={() => setLeadFilter(opt.key)}
                sx={{ fontWeight: 700 }}
              />
            ))}
          </Stack>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="h6" fontWeight={700}>
              Leads abiertos
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary' }}>
              <AccessTimeIcon fontSize="small" />
              <Typography variant="body2">Requieren atención: {attentionNow.length}</Typography>
              <Typography variant="body2" color="text.disabled">· Visibles: {leadsFiltradosOrdenados.length}</Typography>
            </Stack>
          </Box>

          {/* Columna central: lista de leads */}
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, minHeight: 0, flex: 1 }}>
            <Stack spacing={1.5} sx={{ overflow: 'auto', pr: 0.5 }}>
              <Stack spacing={0.5}>
                <List disablePadding>
                  {attentionNow.length > 0 ? attentionNow.map(renderLeadCard) : (
                    <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
                      Sin leads urgentes.
                    </Typography>
                  )}
                </List>
              </Stack>

              <Divider />

              <Stack spacing={0.5}>
                <List disablePadding>
                  {otherLeads.length > 0 ? otherLeads.map(renderLeadCard) : (
                    <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
                      No hay más leads en cola.
                    </Typography>
                  )}
                </List>
              </Stack>
            </Stack>
          </Paper>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: 72,
            }}
          >
            <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={700}>
                Detalle del lead
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                Seguimiento, contexto y acciones del lead seleccionado.
              </Typography>
            </Stack>
            <Chip label="Seleccionado" size="small" variant="outlined" sx={{ ml: 1.5, flexShrink: 0 }} />
          </Box>

          {/* Columna derecha: detalle del lead */}
          {selectedLead ? (
            <>
            <Stack direction="row" alignItems="center" spacing={1} justifyContent="space-between">
              <Box>
                <Typography variant="h6" fontWeight={700}>
                  {selectedLead.name}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary' }}>
                  <PersonIcon fontSize="small" />
                  <Typography variant="body2">{selectedLead.owner}</Typography>
                  {selectedLead.seguimientoPendiente && (
                    <Chip
                      size="small"
                      label="Seguimiento pendiente"
                      color="warning"
                      variant="filled"
                      sx={{ fontWeight: 700 }}
                    />
                  )}
                  {(() => {
                    const idle = getIdleSeverity(selectedLead.idleMinutes);
                    return (
                      <Stack direction="row" spacing={0.5} alignItems="center" color={idle.color === 'error' ? 'error.main' : idle.color === 'warning' ? 'warning.main' : 'text.disabled'}>
                        {idle.showIcon && <WarningAmberIcon fontSize="small" />}
                        <Typography variant="body2" fontWeight={idle.color === 'default' ? 400 : 700}>
                          · Sin respuesta {formatMinutesAgo(selectedLead.idleMinutes)}
                        </Typography>
                      </Stack>
                    );
                  })()}
                </Stack>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                {selectedLead.hot && <WhatshotIcon color="error" fontSize="small" titleAccess="Lead caliente" />}
              </Stack>
            </Stack>

            <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, minHeight: 0, flex: 1 }}>
              <Paper variant="outlined" sx={{ p: 1.5, backgroundColor: '#f8fafc' }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'flex-start' }} flexWrap="wrap" useFlexGap>
                  <TextField
                    select
                    size="small"
                    label="Acción recomendada"
                    value={selectedLead.nextAction}
                    onChange={(e) => updateLead(selectedLead.id, { nextAction: e.target.value as NextAction })}
                    color="primary"
                    SelectProps={{ MenuProps: leadSelectMenuProps }}
                    sx={{
                      flex: '1 1 240px',
                      minWidth: 0,
                      '& .MuiInputBase-input': { fontWeight: 700, fontSize: '0.85rem' },
                      '& .MuiInputLabel-root': { fontWeight: 700, fontSize: '0.85rem' },
                    }}
                  >
                    {nextActionOptions.map((a) => (
                      <MenuItem key={a} value={a}>
                        {a}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    size="small"
                    label="Prioridad"
                    value={selectedLeadPriority}
                    onChange={(e) => updateLead(selectedLead.id, { priority: e.target.value as Priority })}
                    SelectProps={{ MenuProps: leadSelectMenuProps }}
                    sx={{
                      flex: '0 1 140px',
                      minWidth: 0,
                      '& .MuiInputBase-input': { color: 'text.secondary', fontSize: '0.85rem' },
                      '& .MuiInputLabel-root': { color: 'text.secondary', fontSize: '0.85rem' },
                    }}
                  >
                    {priorityOptions.map((p) => (
                      <MenuItem key={p} value={p}>
                        {p}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<ReplyIcon />}
                      onClick={() => handleSendWhatsapp()}
                      disabled={isSending}
                      sx={{ textTransform: 'none', px: 1.5, whiteSpace: 'nowrap' }}
                    >
                      {isSending ? 'Enviando…' : sendSuccess ? 'Enviado ✓' : 'Escribir en el chat'}
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AutoAwesomeIcon />}
                      onClick={handleSuggestMessage}
                      disabled={isSuggesting}
                      sx={{ textTransform: 'none', px: 1.5, whiteSpace: 'nowrap' }}
                    >
                      {isSuggesting ? 'Generando…' : '✨ Sugerir mensaje'}
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleTestScenarios}
                      disabled={isTesting}
                      sx={{ textTransform: 'none', px: 1.5, whiteSpace: 'nowrap' }}
                    >
                      {isTesting ? 'Probando…' : 'Probar escenarios'}
                    </Button>
                    <Button variant="outlined" size="small" startIcon={<DescriptionIcon />}>Enviar plantilla</Button>
                    <Button variant="outlined" size="small" startIcon={<CheckCircleIcon />}>Marcar cotizado</Button>
                    <Button variant="outlined" size="small" color="error">Cerrar / Perdido</Button>
                  </Stack>
                </Stack>
              </Paper>

                {testResults.length > 0 && (
                  <Paper variant="outlined" sx={{ p: 1.25, backgroundColor: '#f9fafb' }}>
                    <Stack spacing={1}>
                      <Typography variant="subtitle2" color="text.secondary">Resultados de escenarios</Typography>
                      <Stack spacing={0.75}>
                        {testResults.map((r) => (
                          <Box key={r.titulo}>
                            <Typography variant="body2" fontWeight={700}>{r.titulo}</Typography>
                            <Typography variant="body2" color="text.secondary">{r.mensaje}</Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Stack>
                  </Paper>
                )}

              <Stack spacing={1}>
                <Typography variant="subtitle2" color="text.secondary">
                  Último mensaje
                </Typography>
                <Paper variant="outlined" sx={{ p: 1.25 }}>
                  <Typography variant="body1">{selectedLead.lastMessage}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Hace {formatMinutesAgo(selectedLead.lastMessageTimeMinutesAgo)}
                  </Typography>
                </Paper>
              </Stack>

              <Stack spacing={1}>
                <Typography variant="subtitle2" color="text.secondary">
                  Notas
                </Typography>
                <Paper variant="outlined" sx={{ p: 1.25, minHeight: 80 }}>
                  <Typography variant="body2" color="text.disabled">
                    Añade notas rápidas sobre el lead.
                  </Typography>
                </Paper>
              </Stack>

              <Stack spacing={1} sx={{ flex: 1, minHeight: 0 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Conversación
                </Typography>
                <Paper
                  variant="outlined"
                  ref={conversationScrollRef}
                  sx={{ p: 1.25, height: 280, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}
                >
                  {selectedLead.conversation.map((msg) => (
                    <Box
                      key={msg.id}
                      sx={{
                        display: 'flex',
                        justifyContent: msg.from === 'me' ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <Box
                        sx={{
                          maxWidth: '75%',
                          px: 1.25,
                          py: 0.75,
                          borderRadius: 1.5,
                          bgcolor: msg.from === 'me' ? 'primary.main' : 'grey.100',
                          color: msg.from === 'me' ? 'primary.contrastText' : 'text.primary',
                        }}
                      >
                        <Typography variant="body2">{msg.text}</Typography>
                        <Typography variant="caption" sx={{ opacity: 0.75 }}>
                          {formatMinutesAgo(msg.minutesAgo)}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                  <Box ref={conversationEndRef} />
                </Paper>
              </Stack>

              <Paper variant="outlined" sx={{ p: 1.25 }}>
                <Box component="form" onSubmit={handleSendWhatsapp}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Escribe una respuesta rápida"
                      value={quickReply}
                      onChange={(e) => setQuickReply(e.target.value)}
                      inputRef={quickReplyRef}
                    />
                    <IconButton
                      color="primary"
                      aria-label="Enviar"
                      type="submit"
                      disabled={isSending}
                    >
                      <SendIcon />
                    </IconButton>
                  </Stack>
                </Box>
              </Paper>
              </Paper>
              </>
            ) : (
              <Typography variant="body1">Selecciona un lead para ver el detalle.</Typography>
            )}
        </Box>
      </Box>
    </Box>
  );
}
