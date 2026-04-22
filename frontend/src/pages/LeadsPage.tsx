import React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  Menu,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
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
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import { apiFetch } from '../api/apiClient';
import { useSession } from '../session/useSession';
import { fetchContactos } from '../services/contactosService';
import type { Contacto } from '../types/contactos.types';
import { actualizarContacto } from '../services/contactos.api';

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
  vendedor_id?: number | null;
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

type WhatsappEtiqueta = {
  id: number;
  nombre: string;
  color: string;
};

type LeadStatusType = 'attention' | 'waiting' | 'neutral' | 'active';

type Lead = {
  id: string;
  name: string;
  phone: string;
  lastMessage: string;
  lastMessageTimeMinutesAgo: number;
  idleMinutes: number;
  awaitingResponse: boolean;
  statusLabel: string;
  statusType: LeadStatusType;
  within24hWindow: boolean;
  windowExpiresInMinutes: number;
  canSendFreeMessage: boolean;
  requiresTemplate: boolean;
  conversation: Array<{ id: string; from: 'lead' | 'me'; text: string; minutesAgo: number; sentAt: string | null }>;
  contactoId: string | null;
  vendedor_id: number | null;
  ultimoMensajeEn: string | null;
  priority: Priority;
  nextAction: NextAction;
  owner: string;
  hot: boolean;
  etapa_oportunidad: EtapaOportunidad;
};

type LeadConPrioridad = Lead & { computedPriority: Priority; seguimientoPendiente: boolean };
type QuickFilter = 'todos' | 'seguimiento' | 'alta' | 'activos';
type LeadScope = 'mis' | 'todos';
type UserRole = { id: number; nombre: string; descripcion?: string | null };
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
  if (min < 1440) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  return `${d}d ${h}h`;
}

function formatMinutes(min: number): string {
  if (min < 60) return `${min}m`;
  if (min < 1440) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  return `${d}d ${h}h`;
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

function deriveLeadState(lead: Lead): {
  awaitingResponse: boolean;
  statusLabel: string;
  statusType: LeadStatusType;
  idleMinutes: number;
  priority: Priority;
  nextAction: NextAction;
  within24hWindow: boolean;
  windowExpiresInMinutes: number;
  canSendFreeMessage: boolean;
  requiresTemplate: boolean;
} {
  const lastMessage = lead.conversation[lead.conversation.length - 1];
  const lastFrom = lastMessage?.from ?? null;
  const idleMinutes = minutesSince(lastMessage?.sentAt ?? lead.ultimoMensajeEn);

  let awaitingResponse = lead.awaitingResponse;
  if (lastFrom === 'lead') {
    awaitingResponse = true;
  } else if (lastFrom === 'me') {
    awaitingResponse = false;
  }

  const statusLabel = awaitingResponse ? 'Sin responder' : 'Esperando cliente';
  const statusType: LeadStatusType = awaitingResponse ? 'attention' : 'waiting';
  const priority: Priority = awaitingResponse
    ? idleMinutes > 30
      ? 'Alta'
      : 'Media'
    : 'Baja';
  const nextAction = deriveNextAction(awaitingResponse);
  const within24hWindow = lastFrom === 'lead'
    ? idleMinutes <= 1440
    : lastFrom === 'me'
      ? true
      : idleMinutes <= 1440;
  const windowExpiresInMinutes = Math.max(0, 1440 - idleMinutes);
  const canSendFreeMessage = within24hWindow;
  const requiresTemplate = !within24hWindow;

  return {
    awaitingResponse,
    statusLabel,
    statusType,
    idleMinutes,
    priority,
    nextAction,
    within24hWindow,
    windowExpiresInMinutes,
    canSendFreeMessage,
    requiresTemplate,
  };
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

const buildLeadOwnerLabel = (
  lead: Lead,
  vendedoresMap: Record<number, Contacto>,
  currentVendedorId: number | null
): string => {
  const vendedorId = lead.vendedor_id ?? null;
  if (vendedorId && currentVendedorId && vendedorId === currentVendedorId) return 'Tú';
  if (vendedorId && vendedoresMap[vendedorId]) return vendedoresMap[vendedorId].nombre;
  return 'Sin asignar';
};

function applyDerivedLeadState(lead: Lead): Lead {
  const derived = deriveLeadState(lead);
  return {
    ...lead,
    ...derived,
    lastMessageTimeMinutesAgo: derived.idleMinutes,
    hot: derived.priority === 'Alta',
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
  const { session } = useSession();
  const [conversations, setConversations] = React.useState<ConversationSummary[]>([]);
  const [leads, setLeads] = React.useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = React.useState<string>('');
  const [isLoadingConversations, setIsLoadingConversations] = React.useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = React.useState(false);
  const [quickReply, setQuickReply] = React.useState('');
  const [isSuggesting, setIsSuggesting] = React.useState(false);
  const [isTesting, setIsTesting] = React.useState(false);
  const [isSending, setIsSending] = React.useState(false);
  const [isSendingTemplate, setIsSendingTemplate] = React.useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = React.useState(false);
  const [sendSuccess, setSendSuccess] = React.useState(false);
  const [testResults, setTestResults] = React.useState<Array<{ titulo: string; mensaje: string }>>([]);
  const [etapaMenu, setEtapaMenu] = React.useState<{ leadId: string; anchorEl: HTMLElement | null } | null>(null);
  const [availableTags, setAvailableTags] = React.useState<WhatsappEtiqueta[]>([]);
  const [conversationTags, setConversationTags] = React.useState<WhatsappEtiqueta[]>([]);
  const [tagsMenuAnchor, setTagsMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [isCreatingTag, setIsCreatingTag] = React.useState(false);
  const [newTagName, setNewTagName] = React.useState('');
  const [newTagColor, setNewTagColor] = React.useState('#25D366');
  const [leadFilter, setLeadFilter] = React.useState<QuickFilter>('todos');
  const [leadScope, setLeadScope] = React.useState<LeadScope>('todos');
  const [scopeTouched, setScopeTouched] = React.useState(false);
  const [isAdmin, setIsAdmin] = React.useState(Boolean(session.user?.es_superadmin));
  const [vendedorContactoId, setVendedorContactoId] = React.useState<number | null>(
    session.user?.vendedor_contacto_id ?? null
  );
  const [contactosById, setContactosById] = React.useState<Record<number, Contacto>>({});
  const [vendedoresById, setVendedoresById] = React.useState<Record<number, Contacto>>({});
  const contactosLoadedRef = React.useRef(false);
  const [isUpdatingOwner, setIsUpdatingOwner] = React.useState(false);
  const [vendedorFilterId, setVendedorFilterId] = React.useState<number | null>(null);
  const [isCompleteContactOpen, setIsCompleteContactOpen] = React.useState(false);
  const [completeContactForm, setCompleteContactForm] = React.useState({
    nombre: '',
    email: '',
    empresa: '',
    observaciones: '',
  });
  const [snackbar, setSnackbar] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' }
  );
  const quickReplyRef = React.useRef<HTMLInputElement | null>(null);
  const conversationEndRef = React.useRef<HTMLDivElement | null>(null);
  const conversationScrollRef = React.useRef<HTMLDivElement | null>(null);
  const lastConversationsFetchRef = React.useRef<string | null>(null);
  const isFilterTransitionRef = React.useRef(false);
  const lastConversationLengthRef = React.useRef(0);
  const lastSelectedLeadIdRef = React.useRef<string | null>(null);
  const [isAtBottom, setIsAtBottom] = React.useState(true);
  const renderCountRef = React.useRef(0);

  renderCountRef.current += 1;
  console.log('[LeadsPage] render', {
    count: renderCountRef.current,
    leads: leads.length,
    conversations: conversations.length,
    selectedLeadId,
  });

  React.useEffect(() => {
    if (!session.token || !session.empresaActivaId) return undefined;

    let active = true;

    const loadProfile = async () => {
      try {
        const response = await apiFetch('/auth/me');
        if (!response.ok) {
          throw new Error('No se pudo cargar el perfil');
        }

        const data = await response.json();
        if (!active) return;

        const roles = Array.isArray(data?.roles) ? data.roles : [];
        const roleNames = roles.map((r: UserRole) => String(r?.nombre ?? '').toLowerCase());
        const admin = Boolean(data?.user?.es_superadmin)
          || roleNames.includes('administrador')
          || roleNames.includes('admin');

        setIsAdmin(admin);
        setVendedorContactoId(data?.user?.vendedor_contacto_id ?? session.user?.vendedor_contacto_id ?? null);
      } catch (error) {
        console.error('[LeadsPage] Error cargando perfil:', error);
      }
    };

    void loadProfile();
    return () => {
      active = false;
    };
  }, [session.token, session.empresaActivaId, session.user?.vendedor_contacto_id]);

  React.useEffect(() => {
    if (scopeTouched) return;
    if (!isAdmin) {
      setLeadScope('mis');
      return;
    }
    if (vendedorContactoId) {
      setLeadScope('mis');
    } else {
      setLeadScope('todos');
    }
  }, [isAdmin, vendedorContactoId, scopeTouched]);

  React.useEffect(() => {
    if (!isAdmin) {
      setLeadScope('mis');
      return;
    }

    if (!vendedorContactoId && leadScope !== 'todos') {
      setLeadScope('todos');
    }
  }, [isAdmin, leadScope, vendedorContactoId]);

  React.useEffect(() => {
    if (leadScope === 'mis') {
      setVendedorFilterId(null);
    }
  }, [leadScope]);

  React.useEffect(() => {
    if (contactosLoadedRef.current) return;
    if (!session.token || !session.empresaActivaId) return;

    let active = true;

    const loadContactos = async () => {
      try {
        const contactos = await fetchContactos();
        if (!active) return;

        const byId: Record<number, Contacto> = {};
        const vendedores: Record<number, Contacto> = {};

        contactos.forEach((c) => {
          if (!Number.isFinite(c.id)) return;
          byId[c.id] = c;
          if ((c.tipo_contacto || '').toLowerCase() === 'vendedor') {
            vendedores[c.id] = c;
          }
        });

        setContactosById(byId);
        setVendedoresById(vendedores);
        contactosLoadedRef.current = true;
      } catch (error) {
        console.error('[LeadsPage] Error cargando contactos:', error);
      }
    };

    void loadContactos();

    return () => {
      active = false;
    };
  }, [session.token, session.empresaActivaId]);

  const leadsConPrioridad = React.useMemo<LeadConPrioridad[]>(() => {
    const enriched = leads.map((lead) => {
      const computedPriority = lead.priority;
      const seguimientoPendiente = esSeguimientoPendiente(lead);
      return {
        ...lead,
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

  React.useEffect(() => {
    console.log('[LeadsPage] leadsConPrioridad updated', {
      total: leadsConPrioridad.length,
      sample: leadsConPrioridad.slice(0, 3).map((l) => ({
        id: l.id,
        lastMessage: l.lastMessage,
        awaitingResponse: l.awaitingResponse,
        lastFrom: l.conversation[l.conversation.length - 1]?.from,
        idleMinutes: l.idleMinutes,
        computedPriority: l.computedPriority,
      })),
    });
  }, [leadsConPrioridad]);

  React.useEffect(() => {
    console.log('[LeadsPage] leadsFiltradosOrdenados updated', {
      total: leadsFiltradosOrdenados.length,
      ids: leadsFiltradosOrdenados.map((l) => l.id),
    });
  }, [leadsFiltradosOrdenados]);

  const selectedLead = leadsConPrioridad.find((l) => l.id === selectedLeadId) ?? leadsConPrioridad[0];
  const selectedLeadPriority = selectedLead?.computedPriority ?? 'Media';
  const selectedContactoId = selectedLead?.contactoId ? Number(selectedLead.contactoId) : null;
  const selectedContacto = selectedContactoId ? contactosById[selectedContactoId] : undefined;
  const selectedVendedorId = selectedLead?.vendedor_id ?? null;
  const vendorOptions = React.useMemo(
    () => Object.values(vendedoresById).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')),
    [vendedoresById]
  );
  const canSelectMis = Boolean(vendedorContactoId);
  const canToggleScope = isAdmin && canSelectMis;
  const showMisChip = !isAdmin || canSelectMis;
  const showTodosChip = isAdmin;

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
      statusLabel: 'Sin responder',
      statusType: 'attention',
  within24hWindow: true,
  windowExpiresInMinutes: 1440,
  canSendFreeMessage: true,
  requiresTemplate: false,
      conversation: [],
      contactoId: conv.contactoId,
      vendedor_id: conv.vendedor_id ?? null,
      ultimoMensajeEn: conv.ultimoMensajeEn,
      priority: 'Media',
      nextAction: deriveNextAction(true),
      owner: 'WhatsApp',
      hot: false,
      etapa_oportunidad: conv.etapa_oportunidad ?? 'nuevo',
    };
    return applyDerivedLeadState(baseLead);
  }, []);

  const loadConversations = React.useCallback(async (opts?: { incremental?: boolean }) => {
    const incremental = opts?.incremental ?? false;
    if (incremental && isFilterTransitionRef.current) {
      console.log('[LeadsPage] loadConversations skipped: filter transition in progress');
      return;
    }
    console.log('[LeadsPage] loadConversations start', { incremental });
    if (!incremental) {
      isFilterTransitionRef.current = true;
      setIsLoadingConversations(true);
    }

    try {
      const vendedorFiltro = !isAdmin
        ? vendedorContactoId
        : leadScope === 'mis'
          ? vendedorContactoId
          : vendedorFilterId;

      const params = new URLSearchParams();
      if (incremental && lastConversationsFetchRef.current) {
        params.set('since', lastConversationsFetchRef.current);
      }
      if (vendedorFiltro) {
        params.set('vendedor_id', String(vendedorFiltro));
      }

      const queryString = params.toString();
      const response = await apiFetch(`/api/whatsapp/conversaciones${queryString ? `?${queryString}` : ''}`);
      if (!response.ok) {
        throw new Error('Error al obtener conversaciones');
      }
      const data: ConversationSummary[] = await response.json();
      console.log('[LeadsPage] loadConversations response', {
        incremental,
        count: data.length,
        queryString,
        ids: data.map((c) => c.id),
      });

      const nowIso = new Date().toISOString();
      lastConversationsFetchRef.current = nowIso;

      if (!incremental) {
        setConversations(data);
      } else if (data.length) {
        setConversations((prev) => {
          console.log('[LeadsPage] setConversations merge', {
            prevCount: prev.length,
            incoming: data.length,
          });
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
        console.log('[LeadsPage] setLeads start', { prevCount: prev.length, incoming: data.length, incremental });
        if (!incremental) {
          const isSame = prev.length === data.length && prev.every((lead) => {
            const match = data.find((conv) => conv.id === lead.id);
            return match && lead.ultimoMensajeEn === match.ultimoMensajeEn;
          });

          if (isSame) {
            return prev;
          }

          const initialLeads = data.map(buildLeadFromConversation);
          console.log('[LeadsPage] setLeads replace', { count: initialLeads.length });
          const firstId = initialLeads[0]?.id;
          if (firstId) {
            setSelectedLeadId((current) => current || firstId);
          }
          return initialLeads;
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
              ultimoMensajeEn: conv.ultimoMensajeEn,
              vendedor_id: conv.vendedor_id ?? existing.vendedor_id,
              etapa_oportunidad: conv.etapa_oportunidad ?? existing.etapa_oportunidad,
            };
            map.set(conv.id, applyDerivedLeadState(updatedLead));
          } else {
            map.set(conv.id, buildLeadFromConversation(conv));
          }
        });

        const mergedLeads = Array.from(map.values());
        console.log('[LeadsPage] setLeads merged', {
          count: mergedLeads.length,
          ids: mergedLeads.map((l) => l.id),
        });

        const firstId = mergedLeads[0]?.id;
        if (!selectedLeadId && firstId) {
          setSelectedLeadId((current) => current || firstId);
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
        isFilterTransitionRef.current = false;
      }
    }
  }, [buildLeadFromConversation, isAdmin, leadScope, selectedLeadId, vendedorContactoId, vendedorFilterId]);

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
      console.log('[LeadsPage] loadMessages response', {
        conversationId,
        append,
        silent,
        count: data.length,
        sinceParam,
        lastTipo: data[data.length - 1]?.tipo_mensaje,
      });

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

  const recalculated = applyDerivedLeadState(updatedLead);
        console.log('[LeadsPage] setLeads from messages', {
          id: recalculated.id,
          awaitingResponse: recalculated.awaitingResponse,
          lastMessage: recalculated.lastMessage,
          lastFrom: recalculated.conversation[recalculated.conversation.length - 1]?.from,
          idleMinutes: recalculated.idleMinutes,
        });
        return recalculated;
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

  const loadAvailableTags = React.useCallback(async () => {
    try {
      const response = await apiFetch('/api/whatsapp/etiquetas');
      if (!response.ok) {
        throw new Error('Error al obtener etiquetas');
      }
      const data: WhatsappEtiqueta[] = await response.json();
      setAvailableTags(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error cargando etiquetas:', error);
    }
  }, []);

  const loadConversationTags = React.useCallback(async (conversationId: string) => {
    try {
      const response = await apiFetch(`/api/whatsapp/conversaciones/${conversationId}/etiquetas`);
      if (!response.ok) {
        throw new Error('Error al obtener etiquetas de conversación');
      }
      const data: WhatsappEtiqueta[] = await response.json();
      setConversationTags(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error cargando etiquetas de conversación:', error);
    }
  }, []);

  const toggleConversationTag = React.useCallback(async (tag: WhatsappEtiqueta) => {
    if (!selectedLeadId) return;
    const isAssigned = conversationTags.some((t) => t.id === tag.id);
    const prev = conversationTags;
    setConversationTags((prevState) => (
      isAssigned
        ? prevState.filter((t) => t.id !== tag.id)
        : [...prevState, tag]
    ));
    handleCloseTagsMenu();

    try {
      const response = await apiFetch(
        isAssigned
          ? `/api/whatsapp/conversaciones/${selectedLeadId}/etiquetas/${tag.id}`
          : `/api/whatsapp/conversaciones/${selectedLeadId}/etiquetas`,
        isAssigned
          ? { method: 'DELETE' }
          : {
            method: 'POST',
            body: JSON.stringify({ etiqueta_id: tag.id }),
          }
      );

      if (!response.ok) {
        throw new Error('Error al actualizar etiqueta');
      }
    } catch (error) {
      console.error('Error actualizando etiqueta:', error);
      setConversationTags(prev);
    }
  }, [conversationTags, selectedLeadId]);

  const getLastSentAtForLead = React.useCallback((leadId: string): string | null => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return null;
    const last = lead.conversation[lead.conversation.length - 1];
    return last?.sentAt ?? lead.ultimoMensajeEn ?? null;
  }, [leads]);

  const refreshIdleTimers = React.useCallback(() => {
    console.log('[LeadsPage] refreshIdleTimers');
    setLeads((prev) => prev.map((l) => {
      const updatedLead = {
        ...l,
      };
      return applyDerivedLeadState(updatedLead);
    }));
  }, []);

  React.useEffect(() => {
    console.log('[LeadsPage] useEffect(loadConversations) init');
    lastConversationsFetchRef.current = null;
    isFilterTransitionRef.current = true;
    setSelectedLeadId('');
    loadConversations();
  }, [leadScope, vendedorContactoId, vendedorFilterId]);

  React.useEffect(() => {
    if (!session.token || !session.empresaActivaId) return;
    loadAvailableTags();
  }, [loadAvailableTags, session.empresaActivaId, session.token]);

  React.useEffect(() => {
    if (!selectedLeadId) {
      setConversationTags([]);
      return;
    }
    loadConversationTags(selectedLeadId);
  }, [loadConversationTags, selectedLeadId]);

  React.useEffect(() => {
    if (selectedLeadId) {
      loadMessages(selectedLeadId);
    }
  }, [loadMessages, selectedLeadId]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      console.log('[LeadsPage] polling refresh: conversations/messages');
      if (!isFilterTransitionRef.current) {
        loadConversations({ incremental: leadScope !== 'todos' });
      }

      if (selectedLeadId) {
        const since = getLastSentAtForLead(selectedLeadId);
        loadMessages(selectedLeadId, { since, append: true, silent: true });
      }

      refreshIdleTimers();
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [getLastSentAtForLead, loadConversations, loadMessages, refreshIdleTimers, selectedLeadId]);

  const scrollToBottom = React.useCallback(() => {
    if (conversationEndRef.current) {
      conversationEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, []);

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
    const currentLeadId = selectedLeadId || null;
    const currentLength = selectedLead?.conversation.length ?? 0;
    const leadChanged = lastSelectedLeadIdRef.current !== currentLeadId;
    const hasNewMessage = !leadChanged && currentLength > lastConversationLengthRef.current;

    lastSelectedLeadIdRef.current = currentLeadId;
    lastConversationLengthRef.current = currentLength;

    if (isFilterTransitionRef.current) return;
    if (!isAtBottom) return;
    if (!hasNewMessage) return;

    scrollToBottom();
  }, [isAtBottom, scrollToBottom, selectedLeadId, selectedLead?.conversation.length]);

  const updateLead = (id: string, updates: Partial<Lead>) => {
    console.log('[LeadsPage] updateLead', { id, updates });
    setLeads((prev) => prev.map((l) => (l.id === id ? applyDerivedLeadState({ ...l, ...updates }) : l)));
  };

  const openCompleteContactDialog = () => {
    if (!selectedLead || !selectedContactoId) return;
    setCompleteContactForm({
      nombre: selectedContacto?.nombre || selectedLead.name || '',
      email: selectedContacto?.email || '',
      empresa: selectedContacto?.zona || '',
      observaciones: selectedContacto?.observaciones || '',
    });
    setIsCompleteContactOpen(true);
  };

  const closeCompleteContactDialog = () => {
    setIsCompleteContactOpen(false);
  };

  const handleSaveCompleteContact = async () => {
    if (!selectedContactoId) return;
    const payload: Partial<Contacto> = {
      nombre: completeContactForm.nombre.trim(),
      email: completeContactForm.email.trim() || null,
      zona: completeContactForm.empresa.trim() || null,
      observaciones: completeContactForm.observaciones.trim() || null,
    };

    try {
      const updated = await actualizarContacto(selectedContactoId, payload);
      setContactosById((prev) => ({
        ...prev,
        [selectedContactoId]: { ...(prev[selectedContactoId] ?? {}), ...updated },
      }));
      if (selectedLeadId) {
        const nextName = updated.nombre || payload.nombre || selectedLead?.name || '';
        updateLead(selectedLeadId, { name: nextName });
      }
      setSnackbar({ open: true, message: 'Contacto actualizado correctamente', severity: 'success' });
      setIsCompleteContactOpen(false);
    } catch (error: any) {
      console.error('Error actualizando contacto:', error);
      setSnackbar({ open: true, message: error?.message || 'No se pudo actualizar el contacto', severity: 'error' });
    }
  };

  const handleOwnerChange = async (nextValue: string) => {
    if (!selectedContactoId) return;
    const vendedorId = nextValue ? Number(nextValue) : null;

    setIsUpdatingOwner(true);
    try {
      const updated = await actualizarContacto(selectedContactoId, { vendedor_id: vendedorId } as Partial<Contacto>);
      setContactosById((prev) => ({
        ...prev,
        [selectedContactoId]: { ...(prev[selectedContactoId] ?? {}), ...updated },
      }));
      if (selectedLeadId) {
        updateLead(selectedLeadId, { vendedor_id: vendedorId });
      }
      setSnackbar({ open: true, message: 'Lead asignado correctamente', severity: 'success' });
    } catch (error: any) {
      console.error('Error asignando vendedor al lead:', error);
      setSnackbar({ open: true, message: error?.message || 'No se pudo asignar el lead', severity: 'error' });
    } finally {
      setIsUpdatingOwner(false);
    }
  };

  const handleOpenEtapaMenu = (leadId: string, anchorEl: HTMLElement) => {
    const lead = leads.find((l) => l.id === leadId);
    console.log('[etapa] abrir menú', { leadId, etapa: lead?.etapa_oportunidad, lead });
    setEtapaMenu({ leadId, anchorEl });
  };

  const handleCloseEtapaMenu = () => setEtapaMenu(null);

  const handleOpenTagsMenu = (event: React.MouseEvent<HTMLElement>) => {
    setTagsMenuAnchor(event.currentTarget);
  };

  const handleCloseTagsMenu = () => {
    setTagsMenuAnchor(null);
    setIsCreatingTag(false);
    setNewTagName('');
    setNewTagColor('#25D366');
  };

  const handleStartCreateTag = () => {
    setIsCreatingTag(true);
  };

  const handleCancelCreateTag = () => {
    setIsCreatingTag(false);
    setNewTagName('');
    setNewTagColor('#25D366');
  };

  const handleSaveNewTag = async () => {
    const nombre = newTagName.trim();
    const color = newTagColor.trim();
    const colorValido = /^#([0-9A-Fa-f]{6})$/.test(color);
    if (!nombre || !colorValido) {
      return;
    }

    try {
      const response = await apiFetch('/api/whatsapp/etiquetas', {
        method: 'POST',
        body: JSON.stringify({ nombre, color }),
      });

      if (!response.ok) {
        throw new Error('Error al crear etiqueta');
      }

      const created: WhatsappEtiqueta = await response.json();
      setAvailableTags((prev) => [created, ...prev]);
      setIsCreatingTag(false);
      setNewTagName('');
      setNewTagColor('#25D366');
      await toggleConversationTag(created);
    } catch (error) {
      console.error('Error creando etiqueta:', error);
    }
  };

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

      setQuickReply('');
      setSendSuccess(true);
      setTimeout(() => setSendSuccess(false), 2000);

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

  const handleSendTemplate = () => {
    if (!selectedLead) return;
    setIsTemplateDialogOpen(true);
  };

  const handleConfirmTemplateSend = async () => {
    if (!selectedLead) return;

    setIsSendingTemplate(true);
    try {
      const response = await apiFetch('/api/whatsapp/enviar-plantilla', {
        method: 'POST',
        body: JSON.stringify({
          telefono: selectedLead.phone,
          tipo: 'reactivacion',
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message || 'No se pudo enviar la plantilla');
      }

      const nowIso = new Date().toISOString();
      updateLead(selectedLead.id, {
        ultimoMensajeEn: nowIso,
        lastMessage: 'Plantilla de reactivación enviada',
      });
      setSnackbar({ open: true, message: 'Conversación reactivada', severity: 'success' });
      loadConversations({ incremental: true });
      setIsTemplateDialogOpen(false);
    } catch (error: any) {
      console.error('Error enviando plantilla:', error);
      setSnackbar({ open: true, message: error?.message || 'No se pudo enviar la plantilla', severity: 'error' });
    } finally {
      setIsSendingTemplate(false);
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
  console.log('[LeadsPage] list sections', {
    attentionNow: attentionNow.map((l) => l.id),
    otherLeads: otherLeads.map((l) => l.id),
  });

  const renderLeadCard = (lead: LeadConPrioridad) => {
    const { computedPriority } = lead;
  const ownerLabel = buildLeadOwnerLabel(lead, vendedoresById, vendedorContactoId);
    console.log('[render lead]', {
      id: lead.id,
      etapa: lead.etapa_oportunidad,
      priority: computedPriority,
      awaitingResponse: lead.awaitingResponse,
      lastMessage: lead.lastMessage,
      ultimoMensajeEn: lead.ultimoMensajeEn,
      conversationLastFrom: lead.conversation[lead.conversation.length - 1]?.from,
    });

    const idleSeverity = getIdleSeverity(lead.idleMinutes);
    const requiresAttention = lead.statusType === 'attention';
    return (
      <ListItem disablePadding key={lead.id}>
        <ListItemButton
          selected={lead.id === selectedLead?.id}
          onClick={() => setSelectedLeadId(lead.id)}
          sx={{
            alignItems: 'center',
            px: 1.5,
            py: 0.75,
            borderRadius: 0,
            borderLeft: '3px solid',
            borderLeftColor: requiresAttention
              ? 'error.main'
              : idleSeverity.color === 'warning'
                ? 'warning.main'
                : 'transparent',
            borderBottom: '1px solid',
            borderBottomColor: 'divider',
            backgroundColor: lead.id === selectedLead?.id
              ? 'primary.main + 08'
              : requiresAttention
                ? 'error.light + 12'
                : 'background.paper',
            '&:hover': {
              backgroundColor: lead.id === selectedLead?.id
                ? 'primary.main + 12'
                : requiresAttention
                  ? 'error.light + 16'
                  : 'action.hover',
            },
          }}
        >
          <Stack spacing={0.2} sx={{ width: '100%', minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={700} noWrap sx={{ flex: 1, minWidth: 0 }}>
                {lead.name?.trim() || `WhatsApp ${lead.phone}`}
              </Typography>
              {lead.etapa_oportunidad && (
                <Chip
                  size="small"
                  label={lead.etapa_oportunidad}
                  color={etapaChipColor[lead.etapa_oportunidad]}
                  sx={{ textTransform: 'capitalize', fontWeight: 600 }}
                  onClick={(e) => handleOpenEtapaMenu(lead.id, e.currentTarget)}
                  clickable
                />
              )}
            </Stack>

            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'text.secondary' }}>
              <PersonIcon fontSize="inherit" sx={{ fontSize: 14 }} />
              <Typography variant="caption">{ownerLabel}</Typography>
            </Stack>

            <Typography variant="body2" color="text.secondary" noWrap>
              {lead.lastMessage}
            </Typography>

            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: 'text.secondary' }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: requiresAttention ? 'error.main' : 'grey.400',
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  fontWeight: requiresAttention ? 700 : 500,
                  color: requiresAttention ? 'error.main' : 'text.secondary',
                }}
              >
                {lead.statusLabel}
              </Typography>
              <Typography variant="caption" color="text.disabled">·</Typography>
              <Typography variant="caption">{lead.owner}</Typography>
              <Typography variant="caption" color="text.disabled">·</Typography>
              <Typography variant="caption">
                {requiresAttention
                  ? `${formatMinutesAgo(lead.lastMessageTimeMinutesAgo)} sin responder`
                  : lead.statusLabel}
              </Typography>
              <Typography variant="caption" color="text.disabled">·</Typography>
              <Chip
                size="small"
                label={computedPriority}
                sx={{
                  height: 20,
                  fontWeight: 700,
                  border: '1px solid',
                  borderColor: computedPriority === 'Alta'
                    ? 'error.light'
                    : computedPriority === 'Media'
                      ? 'warning.light'
                      : 'grey.200',
                  color: computedPriority === 'Alta'
                    ? 'error.dark'
                    : computedPriority === 'Media'
                      ? '#7c5a00'
                      : 'grey.700',
                  bgcolor: computedPriority === 'Alta'
                    ? 'error.light + 14'
                    : computedPriority === 'Media'
                      ? 'warning.light + 16'
                      : 'grey.100',
                }}
              />
            </Stack>
          </Stack>
        </ListItemButton>
      </ListItem>
    );
  };

  const etapaMenuLead = etapaMenu ? leads.find((l) => l.id === etapaMenu.leadId) : null;

  return (
    <>
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

      <Menu
        anchorEl={tagsMenuAnchor}
        open={Boolean(tagsMenuAnchor)}
        onClose={handleCloseTagsMenu}
        MenuListProps={{ dense: true }}
      >
        {availableTags.length === 0 ? (
          <MenuItem disabled>Sin etiquetas disponibles</MenuItem>
        ) : availableTags.map((tag) => {
          const isAssigned = conversationTags.some((t) => t.id === tag.id);
          return (
            <MenuItem
              key={tag.id}
              selected={isAssigned}
              onClick={() => toggleConversationTag(tag)}
              sx={{ gap: 1 }}
            >
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: tag.color }} />
              <Typography variant="body2" fontWeight={600}>
                {tag.nombre}
              </Typography>
            </MenuItem>
          );
        })}
        {isCreatingTag ? (
          <Box sx={{ px: 2, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25, minWidth: 220 }}>
            <TextField
              size="small"
              label="Nombre"
              value={newTagName}
              onChange={(event) => setNewTagName(event.target.value)}
            />
            <TextField
              size="small"
              label="Color"
              type="color"
              value={newTagColor}
              onChange={(event) => setNewTagColor(event.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ maxWidth: 140 }}
            />
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button size="small" variant="text" onClick={handleCancelCreateTag}>
                Cancelar
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={handleSaveNewTag}
                disabled={!newTagName.trim() || !/^#([0-9A-Fa-f]{6})$/.test(newTagColor.trim())}
              >
                Guardar
              </Button>
            </Stack>
          </Box>
        ) : (
          <MenuItem onClick={handleStartCreateTag}>
            <Typography variant="body2" fontWeight={600}>
              ➕ Crear nueva etiqueta
            </Typography>
          </MenuItem>
        )}
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

          {isAdmin && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <TextField
                select
                size="small"
                label="Vendedor"
                value={vendedorFilterId ? String(vendedorFilterId) : ''}
                onChange={(event) => {
                  const value = event.target.value;
                  setVendedorFilterId(value ? Number(value) : null);
                }}
                SelectProps={{ MenuProps: leadSelectMenuProps }}
                sx={{ minWidth: 220 }}
                disabled={leadScope === 'mis'}
              >
                <MenuItem value="">Todos los vendedores</MenuItem>
                {vendorOptions.map((v) => (
                  <MenuItem key={v.id} value={String(v.id)}>
                    {v.nombre}
                  </MenuItem>
                ))}
              </TextField>
              {leadScope === 'mis' && (
                <Typography variant="caption" color="text.secondary">
                  Cambia a “Todos” para filtrar por vendedor.
                </Typography>
              )}
            </Box>
          )}

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {showMisChip && (
              <Chip
                label="Mis leads"
                color={leadScope === 'mis' ? 'primary' : 'default'}
                variant={leadScope === 'mis' ? 'filled' : 'outlined'}
                onClick={canToggleScope ? () => {
                  setLeadScope('mis');
                  setScopeTouched(true);
                } : undefined}
                sx={{ fontWeight: 700 }}
              />
            )}
            {showTodosChip && (
              <Chip
                label="Todos"
                color={leadScope === 'todos' ? 'primary' : 'default'}
                variant={leadScope === 'todos' ? 'filled' : 'outlined'}
                onClick={canToggleScope ? () => {
                  setLeadScope('todos');
                  setScopeTouched(true);
                } : undefined}
                sx={{ fontWeight: 700 }}
              />
            )}
          </Stack>

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
                <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                  <Typography variant="h6" fontWeight={700}>
                    {selectedLead.name}
                  </Typography>
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<EditIcon fontSize="small" />}
                    onClick={openCompleteContactDialog}
                    disabled={!selectedContactoId}
                    sx={{ textTransform: 'none', color: 'text.secondary', px: 0.5, minWidth: 'auto' }}
                  >
                    Editar datos
                  </Button>
                </Stack>
                <Stack spacing={0.35} sx={{ color: 'text.secondary' }}>
                  {isAdmin ? (
                    <TextField
                      select
                      size="small"
                      label="Asignado a"
                      value={selectedVendedorId ? String(selectedVendedorId) : ''}
                      onChange={(e) => handleOwnerChange(e.target.value)}
                      disabled={isUpdatingOwner || !selectedContactoId}
                      SelectProps={{ MenuProps: leadSelectMenuProps }}
                      sx={{ maxWidth: 240 }}
                      helperText={isUpdatingOwner ? 'Actualizando…' : undefined}
                    >
                      <MenuItem value="">
                        Sin asignar
                      </MenuItem>
                      {vendorOptions.map((v) => (
                        <MenuItem key={v.id} value={String(v.id)}>
                          {v.nombre}
                        </MenuItem>
                      ))}
                    </TextField>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Asignado a: {buildLeadOwnerLabel(selectedLead, vendedoresById, vendedorContactoId)}
                    </Typography>
                  )}
                  <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
                    {conversationTags.map((tag) => (
                      <Chip
                        key={tag.id}
                        size="small"
                        label={tag.nombre}
                        onDelete={() => toggleConversationTag(tag)}
                        sx={{
                          bgcolor: tag.color,
                          color: '#fff',
                          fontWeight: 500,
                          height: 24,
                          mr: 0.5,
                          '& .MuiChip-deleteIcon': { color: '#fff' },
                        }}
                      />
                    ))}
                    <IconButton
                      size="small"
                      onClick={handleOpenTagsMenu}
                      aria-label="Agregar etiqueta"
                      sx={{ border: '1px dashed', borderColor: 'divider' }}
                    >
                      <AddIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
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
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ gap: 1 }}>
                    <Typography
                      variant="subtitle1"
                      fontWeight={700}
                      sx={{
                        color: selectedLead.statusType === 'attention'
                          ? 'error.main'
                          : selectedLead.statusType === 'waiting'
                            ? 'text.secondary'
                            : 'text.primary',
                      }}
                    >
                      {selectedLead.statusLabel}
                    </Typography>
                    <Typography variant="subtitle1" color="text.secondary" fontWeight={600}>
                      · {formatMinutesAgo(selectedLead.idleMinutes)}
                    </Typography>
                    <Chip
                      size="small"
                      label={selectedLead.priority}
                      sx={{
                        fontWeight: 700,
                        border: '1px solid',
                        borderColor: selectedLead.priority === 'Alta'
                          ? 'error.light'
                          : selectedLead.priority === 'Media'
                            ? 'warning.light'
                            : 'grey.200',
                        color: selectedLead.priority === 'Alta'
                          ? 'error.dark'
                          : selectedLead.priority === 'Media'
                            ? '#7c5a00'
                            : 'grey.700',
                        bgcolor: selectedLead.priority === 'Alta'
                          ? 'error.light + 14'
                          : selectedLead.priority === 'Media'
                            ? 'warning.light + 16'
                            : 'grey.100',
                      }}
                    />
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Typography variant="body2" fontWeight={600} color="text.primary">
                      👉 {selectedLead.statusType === 'attention' ? 'Responder ahora' : 'Esperar respuesta del cliente'}
                    </Typography>
                  </Stack>
                  {(() => {
                    const expiresIn = selectedLead.windowExpiresInMinutes;
                    const windowState = selectedLead.within24hWindow
                      ? expiresIn <= 120
                        ? 'warning'
                        : 'open'
                      : 'closed';
                    const windowLabel = windowState === 'closed'
                      ? 'Ventana cerrada · requiere plantilla'
                      : windowState === 'warning'
                        ? `Expira pronto · ${formatMinutes(expiresIn)} restantes`
                        : `Ventana abierta · expira en ${formatMinutes(expiresIn)}`;
                    const windowColor = windowState === 'closed'
                      ? 'error.main'
                      : windowState === 'warning'
                        ? 'warning.main'
                        : 'success.main';
                    const windowDot = windowState === 'closed' ? '🔴' : windowState === 'warning' ? '🟡' : '🟢';

                    return (
                      <Typography variant="caption" sx={{ color: windowColor, fontWeight: 600 }}>
                        {windowDot} {windowLabel}
                      </Typography>
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
                    <Tooltip
                      arrow
                      disableHoverListener={!selectedLead.requiresTemplate}
                      title={(
                        <Box sx={{ maxWidth: 280 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>
                            No puedes enviar mensajes libres porque han pasado más de 24 horas desde el último mensaje del cliente.
                          </Typography>
                          <Typography variant="body2" sx={{ mb: 0.75 }}>
                            WhatsApp requiere que, fuera de esta ventana, solo se envíen mensajes mediante plantillas aprobadas.
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            👉 Para continuar la conversación, usa el botón “Enviar plantilla”.
                          </Typography>
                        </Box>
                      )}
                    >
                      <span>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<ReplyIcon />}
                          onClick={() => handleSendWhatsapp()}
                          disabled={isSending || selectedLead.requiresTemplate}
                          sx={{ textTransform: 'none', px: 1.5, whiteSpace: 'nowrap' }}
                        >
                          {isSending ? 'Enviando…' : sendSuccess ? 'Enviado ✓' : 'Escribir en el chat'}
                        </Button>
                      </span>
                    </Tooltip>
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
                    <Button
                      variant={selectedLead.requiresTemplate ? 'contained' : 'outlined'}
                      color={selectedLead.requiresTemplate ? 'warning' : 'inherit'}
                      size="small"
                      startIcon={<DescriptionIcon />}
                      onClick={handleSendTemplate}
                      disabled={isSendingTemplate}
                      sx={{ textTransform: 'none', px: 1.5, whiteSpace: 'nowrap' }}
                    >
                      {isSendingTemplate ? 'Reactivando…' : 'Reactivar conversación'}
                    </Button>
                    <Button variant="outlined" size="small" startIcon={<CheckCircleIcon />}>Marcar cotizado</Button>
                    <Button variant="outlined" size="small" color="error">Cerrar / Perdido</Button>
                  </Stack>
                </Stack>
              </Paper>

              <Dialog
                open={isTemplateDialogOpen}
                onClose={() => !isSendingTemplate && setIsTemplateDialogOpen(false)}
                maxWidth="xs"
                fullWidth
              >
                <DialogTitle>Reactivar conversación</DialogTitle>
                <DialogContent>
                  <Typography variant="body2" color="text.secondary">
                    Se enviará un mensaje para reactivar la conversación con el cliente.
                    Después podrás escribir normalmente.
                  </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                  <Button
                    onClick={() => setIsTemplateDialogOpen(false)}
                    disabled={isSendingTemplate}
                    variant="outlined"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleConfirmTemplateSend}
                    disabled={isSendingTemplate}
                    variant="contained"
                    color="warning"
                  >
                    {isSendingTemplate ? 'Reactivando…' : 'Reactivar'}
                  </Button>
                </DialogActions>
              </Dialog>

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
              <Dialog
                open={isCompleteContactOpen}
                onClose={closeCompleteContactDialog}
                fullWidth
                maxWidth="sm"
              >
                <DialogTitle>Completar contacto</DialogTitle>
                <DialogContent dividers>
                  <Stack spacing={2} sx={{ pt: 0.5 }}>
                    <TextField
                      label="Nombre"
                      value={completeContactForm.nombre}
                      onChange={(e) => setCompleteContactForm((prev) => ({ ...prev, nombre: e.target.value }))}
                      fullWidth
                      required
                    />
                    <TextField
                      label="Email"
                      value={completeContactForm.email}
                      onChange={(e) => setCompleteContactForm((prev) => ({ ...prev, email: e.target.value }))}
                      fullWidth
                    />
                    <TextField
                      label="Empresa"
                      value={completeContactForm.empresa}
                      onChange={(e) => setCompleteContactForm((prev) => ({ ...prev, empresa: e.target.value }))}
                      fullWidth
                    />
                    <TextField
                      label="Observaciones"
                      value={completeContactForm.observaciones}
                      onChange={(e) => setCompleteContactForm((prev) => ({ ...prev, observaciones: e.target.value }))}
                      fullWidth
                      multiline
                      minRows={3}
                    />
                  </Stack>
                </DialogContent>
                <DialogActions>
                  <Button onClick={closeCompleteContactDialog} variant="text">
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSaveCompleteContact}
                    variant="contained"
                    disabled={!completeContactForm.nombre.trim() || !selectedContactoId}
                  >
                    Guardar
                  </Button>
                </DialogActions>
              </Dialog>
              </>
            ) : (
              <Typography variant="body1">Selecciona un lead para ver el detalle.</Typography>
            )}
        </Box>
      </Box>
    </Box>
    <Snackbar
      open={snackbar.open}
      autoHideDuration={2500}
      onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        severity={snackbar.severity}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        sx={{ width: '100%' }}
      >
        {snackbar.message}
      </Alert>
    </Snackbar>
    </>
  );
}
