/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  Globe,
  User as UserIcon,
  Users,
  FileCode2,
  ChevronRight,
  ChevronDown,
  FolderPlus,
  UserPlus,
  ShieldPlus,
  Link2,
  Search,
  ShieldAlert,
  Check,
  X,
  SlidersHorizontal,
  Trash2,
  GripVertical,
  AlertTriangle,
  Plus,
  BookOpen,
  Archive,
  FilePlus2,
  Play,
  Cpu,
  ArrowDown,
  ArrowUp,
  Download,
  Upload,
  FileJson,
  Terminal,
  Award,
  Copy,
  Monitor,
  Lock,
  Unlock,
  Package,
  Sun,
  Moon,
  RotateCcw,
  History,
  ExternalLink,
} from 'lucide-react';
import {
  ADEnvironment,
  GroupScope,
  AGDLPValidationError,
  GPO_PRESET_OPTIONS,
  LAB_CHALLENGES,
  GPO_STATUS_OPTIONS,
} from './adModel.js';

type ObjectTypeFilter = 'all' | 'ou' | 'user' | 'group' | 'gpo';
type CenterViewMode =
  | 'ou-directory'
  | 'ou-linked-gpos'
  | 'gpo-container'
  | 'rsop-simulator'
  | 'challenges-view'
  | 'powershell-bpa-view';

interface SelectedEntity {
  type: 'ou' | 'user' | 'group' | 'gpoLink' | 'gpo';
  id: string;
}

type ModalMode =
  | null
  | 'new-ou'
  | 'new-user'
  | 'new-group'
  | 'new-base-gpo'
  | 'link-existing-gpo';

interface ObjectPickerState {
  open: boolean;
  mode: 'user-member-of' | 'group-members' | 'group-member-of';
  targetId: string;
}

interface EducationalErrorState {
  code: string;
  title: string;
  message: string;
  expectedFlow: string;
  ruleType: string;
}

interface DragPayload {
  entityType: 'user' | 'group';
  id: string;
  name: string;
  scope?: string;
}

interface GPOHistoryEntry {
  id: string;
  timestamp: string;
  category:
    | 'Ajuste GPO'
    | 'Seguridad'
    | 'Software MSI'
    | 'Vínculo OU'
    | 'Forzado (Enforced)'
    | 'Precedencia'
    | 'Herencia OU'
    | 'Repositorio GPO';
  gpoName: string;
  summary: string;
  targetEntity: SelectedEntity;
  previousSnapshot: any;
}

const GPO_HISTORY_STORAGE_KEY = 'adlab_gpo_history_v1';
const MAX_GPO_HISTORY_ITEMS = 5;
const AUTHOR_LOGO_URL = `${import.meta.env.BASE_URL}assets/aistudio/icono_81a3db5b.png`;
const AUTHOR_WEB_URL = 'https://www.unfantasmaenelsistema.com/';
const LOADED_CHALLENGE_KEY = 'adlab_loaded_challenge_v1';

/**
 * Resalta visualmente las coincidencias del término de búsqueda dentro de cualquier texto
 * en el TreeView y en las tablas de lista (tanto en Light Mode como en Dark Mode).
 */
function HighlightMatch({
  text,
  query,
  invertOnSelected = false,
}: {
  text: string;
  query: string;
  invertOnSelected?: boolean;
}) {
  const cleanQuery = query.trim();
  if (!cleanQuery || !text) return <>{text}</>;

  const escaped = cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = String(text).split(new RegExp(`(${escaped})`, 'gi'));

  if (parts.length === 1) return <>{text}</>;

  return (
    <>
      {parts.map((part, idx) =>
        part.toLowerCase() === cleanQuery.toLowerCase() ? (
          <mark
            key={idx}
            className={
              invertOnSelected
                ? 'bg-amber-300 text-slate-950 font-bold rounded-xs px-0.5'
                : 'bg-amber-200 dark:bg-amber-400/35 text-slate-950 dark:text-amber-200 font-semibold rounded-xs px-0.5'
            }
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={idx}>{part}</React.Fragment>
        )
      )}
    </>
  );
}

export default function App() {
  const [env, setEnv] = useState<any>(() => ADEnvironment.loadFromLocalStorage());
  const [version, setVersion] = useState<number>(0);
  const [fileMenuOpen, setFileMenuOpen] = useState<boolean>(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Estado global de Dark Mode para consola IT (persistido en localStorage)
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('adlab_theme_mode') === 'dark';
    }
    return false;
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', darkMode);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('adlab_theme_mode', darkMode ? 'dark' : 'light');
    }
  }, [darkMode]);

  const [selectedOuId, setSelectedOuId] = useState<string>(() => env.rootOuId || '');
  const [centerViewMode, setCenterViewMode] = useState<CenterViewMode>('ou-directory');
  const [gpoContainerExpanded, setGpoContainerExpanded] = useState<boolean>(true);
  // Reto cuyo escenario está cargado (se guarda para que tras recargar se evalúe el reto correcto)
  const [loadedChallengeId, setLoadedChallengeId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(LOADED_CHALLENGE_KEY);
      return LAB_CHALLENGES.some((c) => c.id === saved) ? saved : null;
    } catch {
      return null;
    }
  });
  const [activeChallengeId, setActiveChallengeId] = useState<string>(
    () => loadedChallengeId || LAB_CHALLENGES[0].id
  );

  useEffect(() => {
    try {
      if (loadedChallengeId) localStorage.setItem(LOADED_CHALLENGE_KEY, loadedChallengeId);
      else localStorage.removeItem(LOADED_CHALLENGE_KEY);
    } catch {
      // Almacenamiento no disponible
    }
  }, [loadedChallengeId]);

  // Pila de historial de las últimas 5 acciones de configuración de GPO (con soporte Undo)
  const [gpoActionHistory, setGpoActionHistory] = useState<GPOHistoryEntry[]>(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(GPO_HISTORY_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            return parsed.slice(0, MAX_GPO_HISTORY_ITEMS);
          }
        }
      } catch {
        // Ignorar errores de parseo de historial previo
      }
    }
    return [];
  });

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(
          GPO_HISTORY_STORAGE_KEY,
          JSON.stringify(gpoActionHistory.slice(0, MAX_GPO_HISTORY_ITEMS))
        );
      } catch {
        // Ignorar cuota excedida en localStorage
      }
    }
  }, [gpoActionHistory]);

  const [expandedOuIds, setExpandedOuIds] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    Object.keys(env.ous).forEach((id) => {
      initial[id] = true;
    });
    return initial;
  });

  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity>(() => ({
    type: 'ou',
    id: env.rootOuId || '',
  }));

  // Estado del Simulador RSoP para un Usuario
  const [rsopTargetUserId, setRsopTargetUserId] = useState<string>(() => {
    const firstUser = Object.values(env.users)[0] as any;
    return firstUser ? firstUser.id : '';
  });
  const [rsopResult, setRsopResult] = useState<any>(() => {
    const firstUser = Object.values(env.users)[0] as any;
    return firstUser ? env.calculateUserRSoP(firstUser.id) : null;
  });

  // Pestañas de propiedades en el inspector derecho
  const [userInspectorTab, setUserInspectorTab] = useState<'general' | 'memberOf'>('memberOf');
  const [groupInspectorTab, setGroupInspectorTab] = useState<'general' | 'members' | 'memberOf'>('members');

  // Modo estricto de buenas prácticas educativas AGDLP
  const [strictAGDLP, setStrictAGDLP] = useState<boolean>(true);

  const [filterType, setFilterType] = useState<ObjectTypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [modalMode, setModalMode] = useState<ModalMode>(null);

  // Buscador de Objetos ("Seleccionar Usuarios o Grupos")
  const [objectPicker, setObjectPicker] = useState<ObjectPickerState | null>(null);
  const [pickerSearch, setPickerSearch] = useState<string>('');
  const [pickerScopeFilter, setPickerScopeFilter] = useState<string>('ALL');

  // Drag & Drop
  const [draggedItem, setDraggedItem] = useState<DragPayload | null>(null);
  const [dragOverTargetId, setDragOverTargetId] = useState<string | null>(null);

  // Notificaciones y Alerta Educativa AGDLP
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [educationalError, setEducationalError] = useState<EducationalErrorState | null>(null);

  // Estados de formularios de creación
  const [ouName, setOuName] = useState('');
  const [ouDescription, setOuDescription] = useState('');
  const [ouBlockInheritance, setOuBlockInheritance] = useState(false);

  const [userSam, setUserSam] = useState('');
  const [userDisplay, setUserDisplay] = useState('');
  const [userDept, setUserDept] = useState('');
  const [userTitle, setUserTitle] = useState('');

  const [groupName, setGroupName] = useState('');
  const [groupScope, setGroupScope] = useState<string>(GroupScope.GLOBAL);
  const [groupDesc, setGroupDesc] = useState('');
  const [groupPermissionInput, setGroupPermissionInput] = useState('');

  // Estados para crear GPO Base (AppLocker, Wallpaper, Proxy, Windows Update + MSI)
  const [gpoName, setGpoName] = useState('');
  const [gpoDesc, setGpoDesc] = useState('');
  const [gpoAppLocker, setGpoAppLocker] = useState<string>('');
  const [gpoWallpaper, setGpoWallpaper] = useState<string>('');
  const [gpoProxy, setGpoProxy] = useState<string>('');
  const [gpoWindowsUpdate, setGpoWindowsUpdate] = useState<string>('');

  // Estados para vincular una GPO existente a una OU
  const [selectedExistingGpoId, setSelectedExistingGpoId] = useState('');
  const [gpoEnforcedOnLink, setGpoEnforcedOnLink] = useState(false);

  // Inputs auxiliares en el panel de propiedades
  const [newPermissionText, setNewPermissionText] = useState('');
  const [newMsiPackageInput, setNewMsiPackageInput] = useState('');

  useEffect(() => {
    Object.assign(window, {
      adLab: env,
      ADEnvironment,
      AGDLPValidationError,
      GPO_PRESET_OPTIONS,
      LAB_CHALLENGES,
    });
  }, [env, version]);

  // Escape cierra el selector de objetos, los modales de creación y el menú Archivo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setObjectPicker(null);
      setModalMode(null);
      setFileMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const commitChange = () => {
    env.saveToLocalStorage();
    if (rsopTargetUserId && env.users[rsopTargetUserId]) {
      setRsopResult(env.calculateUserRSoP(rsopTargetUserId));
    }
    setVersion((v) => v + 1);
  };

  /**
   * Registra un cambio de configuración de GPO en la pila de historial (máx. 5 acciones)
   * guardando una instantánea completa previa a la mutación para permitir deshacerlo (Undo).
   */
  const recordGPOAction = (
    meta: {
      category: GPOHistoryEntry['category'];
      gpoName: string;
      summary: string;
      targetEntity?: SelectedEntity;
    },
    mutateFn: () => SelectedEntity | void
  ) => {
    const previousSnapshot = JSON.parse(JSON.stringify(env.toJSON()));
    const resultingEntity = mutateFn();
    commitChange();

    const now = new Date();
    const timestamp = now.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const newEntry: GPOHistoryEntry = {
      id: `gpo-act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp,
      category: meta.category,
      gpoName: meta.gpoName,
      summary: meta.summary,
      targetEntity: resultingEntity || meta.targetEntity || selectedEntity,
      previousSnapshot,
    };

    setGpoActionHistory((prev) =>
      [newEntry, ...prev].slice(0, MAX_GPO_HISTORY_ITEMS)
    );
  };

  /**
   * Deshace una acción de la pila de historial de GPOs restaurando el snapshot previo.
   * Si se elige un elemento más antiguo de la pila (index > 0), revierte en bloque hasta ese estado.
   */
  const handleUndoGPOAction = (indexInStack = 0) => {
    const targetEntry = gpoActionHistory[indexInStack];
    if (!targetEntry || !targetEntry.previousSnapshot) return;

    try {
      const restoredEnv: any = new ADEnvironment(targetEntry.previousSnapshot);
      restoredEnv.saveToLocalStorage();
      setEnv(restoredEnv);

      if (rsopTargetUserId && restoredEnv.users[rsopTargetUserId]) {
        setRsopResult(restoredEnv.calculateUserRSoP(rsopTargetUserId));
      }

      // Verificar si la entidad seleccionada sigue existiendo tras deshacer
      const ent = targetEntry.targetEntity;
      if (ent.type === 'gpo' && restoredEnv.gpos[ent.id]) {
        setSelectedEntity(ent);
      } else if (ent.type === 'gpoLink' && restoredEnv.gpoLinks[ent.id]) {
        setSelectedEntity(ent);
      } else if (ent.type === 'ou' && restoredEnv.ous[ent.id]) {
        setSelectedEntity(ent);
      } else {
        const firstGpo = Object.values(restoredEnv.gpos)[0] as any;
        if (centerViewMode === 'gpo-container' && firstGpo) {
          setSelectedEntity({ type: 'gpo', id: firstGpo.id });
        } else {
          setSelectedEntity({ type: 'ou', id: restoredEnv.rootOuId || '' });
        }
      }

      setGpoActionHistory((prev) => prev.slice(indexInStack + 1));
      setVersion((v) => v + 1);
      notifySuccess(
        indexInStack === 0
          ? `Acción deshecha: [${targetEntry.gpoName}] ${targetEntry.summary}`
          : `Se revirtieron ${indexInStack + 1} cambios hasta antes de: [${targetEntry.gpoName}] ${targetEntry.summary}`
      );
    } catch (err) {
      handleADError(err);
    }
  };

  const notifySuccess = (msg: string) => {
    setEducationalError(null);
    setFeedbackSuccess(msg);
    setTimeout(() => {
      setFeedbackSuccess((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  const handleADError = (err: unknown) => {
    setFeedbackSuccess(null);
    if (err instanceof AGDLPValidationError || (err as any)?.name === 'AGDLPValidationError') {
      const agdlpErr = err as any;
      setEducationalError({
        code: agdlpErr.code || 'AGDLP_RULE_VIOLATION',
        title: agdlpErr.title || 'Violación de Regla Active Directory / AGDLP',
        message: agdlpErr.message,
        expectedFlow:
          agdlpErr.expectedFlow ||
          'A (Account) → G (Global) → U (Universal) → DL (Domain Local) → P (Permission)',
        ruleType: agdlpErr.ruleType || 'AD_SCOPE_RULE',
      });
    } else {
      const message = err instanceof Error ? err.message : String(err);
      setEducationalError({
        code: 'AD_OPERATION_ERROR',
        title: 'Operación rechazada por el controlador de dominio',
        message,
        expectedFlow: 'A (Account) → G (Global) → U (Universal) → DL (Domain Local) → P (Permission)',
        ruleType: 'AD_SCOPE_RULE',
      });
    }
  };

  /**
   * Ejecuta el cálculo RSoP para el usuario seleccionado
   */
  const handleCalculateUserRSoP = (targetId = rsopTargetUserId) => {
    if (!targetId || !env.users[targetId]) return;
    try {
      const calculated = env.calculateUserRSoP(targetId);
      setRsopResult(calculated);
      setSelectedEntity({ type: 'user', id: targetId });
      notifySuccess(
        `RSoP calculado para "${calculated.user.displayName}" (${calculated.appliedGPOs.length} GPOs aplicadas, ${calculated.blockedGPOs.length} descartadas).`
      );
    } catch (err) {
      handleADError(err);
    }
  };

  const executeAddMemberToGroup = (
    memberType: 'user' | 'group',
    memberId: string,
    targetGroupId: string
  ): boolean => {
    try {
      if (memberType === 'user') {
        const user = env.users[memberId];
        const group = env.addUserToGroup(memberId, targetGroupId, { strictAGDLP });
        commitChange();
        notifySuccess(
          `AGDLP válido: Cuenta "${user.displayName}" añadida al grupo ${group.scope} "${group.name}".`
        );
        return true;
      } else {
        const childGroup = env.groups[memberId];
        const parentGroup = env.addGroupToGroup(memberId, targetGroupId, { strictAGDLP });
        commitChange();
        notifySuccess(
          `AGDLP válido: Grupo ${childGroup.scope} "${childGroup.name}" anidado en grupo ${parentGroup.scope} "${parentGroup.name}".`
        );
        return true;
      }
    } catch (err) {
      handleADError(err);
      return false;
    }
  };

  const handleResetEnvironment = () => {
    const fresh: any = ADEnvironment.createSeededEnvironment();
    fresh.saveToLocalStorage();
    setLoadedChallengeId(null);
    applyImportedEnvironment(fresh, 'Entorno restaurado al estado inicial de laboratorio.');
  };

  /**
   * Aplica una nueva instancia de ADEnvironment (importada desde JSON o reto docente)
   * y refresca todo el árbol y vistas.
   */
  const applyImportedEnvironment = (newEnv: any, successMessage: string) => {
    setEnv(newEnv);
    setSelectedOuId(newEnv.rootOuId || '');
    setSelectedEntity({ type: 'ou', id: newEnv.rootOuId || '' });
    const firstUser = Object.values(newEnv.users)[0] as any;
    if (firstUser) {
      setRsopTargetUserId(firstUser.id);
      setRsopResult(newEnv.calculateUserRSoP(firstUser.id));
    } else {
      setRsopTargetUserId('');
      setRsopResult(null);
    }
    const allExpanded: Record<string, boolean> = {};
    Object.keys(newEnv.ous).forEach((id) => {
      allExpanded[id] = true;
    });
    setExpandedOuIds(allExpanded);
    setGpoActionHistory([]);
    setEducationalError(null);
    setFileMenuOpen(false);
    setVersion((v) => v + 1);
    notifySuccess(successMessage);
  };

  /**
   * Exporta el estado actual como un archivo descargable `adlab-snapshot.json`
   */
  const handleExportLaboratory = () => {
    try {
      env.exportToFileDownload('adlab-snapshot.json');
      setFileMenuOpen(false);
      notifySuccess('Laboratorio exportado correctamente como "adlab-snapshot.json".');
    } catch (err) {
      handleADError(err);
    }
  };

  /**
   * Importa un archivo `.json` seleccionado desde el <input type="file">
   */
  const handleImportLaboratoryFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rawText = await file.text();
      const importedEnv = ADEnvironment.importFromSnapshotJSON(rawText);
      setLoadedChallengeId(null);
      applyImportedEnvironment(
        importedEnv,
        `Escenario "${file.name}" importado (${Object.keys(importedEnv.ous).length} OUs, ${Object.keys(importedEnv.users).length} usuarios, ${Object.keys(importedEnv.gpos).length} GPOs).`
      );
    } catch (err) {
      handleADError(err);
    } finally {
      e.target.value = '';
    }
  };

  const handleLoadTeacherChallenge = (challengeId = 'challenge-gpo-inheritance') => {
    const challengeEnv = ADEnvironment.createTeacherChallengeEnvironment(challengeId);
    setActiveChallengeId(challengeId);
    setLoadedChallengeId(challengeId);
    applyImportedEnvironment(
      challengeEnv,
      `Escenario de reto cargado: ${LAB_CHALLENGES.find((c) => c.id === challengeId)?.title}`
    );
    setCenterViewMode('challenges-view');
  };

  const currentOU = env.ous[selectedOuId] || env.ous[env.rootOuId];

  const breadcrumbPath = useMemo(() => {
    if (!currentOU) return [];
    return env.getOUHierarchyPath(currentOU.id);
  }, [env, currentOU, version]);

  const currentOUDN = useMemo(() => {
    if (!currentOU) return '';
    return env.getDistinguishedName('', currentOU.id);
  }, [env, currentOU, version]);

  const currentOUGpoLinks = useMemo(() => {
    if (!currentOU) return [];
    return Object.values(env.gpoLinks)
      .filter((link: any) => link.ouId === currentOU.id)
      .sort((a: any, b: any) => a.linkOrder - b.linkOrder)
      .map((link: any) => ({
        link,
        gpo: env.gpos[link.gpoId],
      }))
      .filter((item) => Boolean(item.gpo));
  }, [env, currentOU, version]);

  const currentOURSoP = useMemo(() => {
    if (!currentOU) return null;
    return env.calculateEffectiveGPOsForOU(currentOU.id);
  }, [env, currentOU, version]);

  const challengeEvaluation = useMemo(() => {
    return env.evaluateLabChallenge(activeChallengeId);
  }, [env, activeChallengeId, version]);
  // Solo tiene sentido puntuar el reto cuyo escenario está cargado
  const isActiveChallengeLoaded = loadedChallengeId === activeChallengeId;
  const challengeBadge = loadedChallengeId
    ? env.evaluateLabChallenge(loadedChallengeId).score
    : '–';

  const domainAuditFindings = useMemo(() => {
    return env.runDomainHealthAudit();
  }, [env, version]);

  const powerShellScript = useMemo(() => {
    return env.generatePowerShellDeploymentScript();
  }, [env, version]);

  const ouContents = useMemo(() => {
    if (!currentOU) return [];

    const childOUs = (currentOU.childrenIds || [])
      .map((id: string) => env.ous[id])
      .filter(Boolean)
      .map((ou: any) => ({
        rowId: `ou-${ou.id}`,
        entityType: 'ou' as const,
        id: ou.id,
        name: ou.name,
        typeLabel: 'Unidad organizativa',
        scopeOrStatus: ou.blockInheritance ? 'Herencia bloqueada' : 'Herencia activa',
        description: ou.description || 'Contenedor de directorio',
        raw: ou,
      }));

    const usersInOU = Object.values(env.users)
      .filter((u: any) => u.ouId === currentOU.id)
      .map((u: any) => ({
        rowId: `user-${u.id}`,
        entityType: 'user' as const,
        id: u.id,
        name: u.displayName,
        typeLabel: `Usuario · ${u.samAccountName}`,
        scopeOrStatus: u.enabled ? 'Habilitado' : 'Deshabilitado',
        description:
          [u.title, u.department].filter(Boolean).join(' · ') ||
          'Arrastra hacia un Grupo Global (A → G)',
        raw: u,
      }));

    const groupsInOU = Object.values(env.groups)
      .filter((g: any) => g.ouId === currentOU.id)
      .map((g: any) => ({
        rowId: `group-${g.id}`,
        entityType: 'group' as const,
        id: g.id,
        name: g.name,
        typeLabel: `Grupo de seguridad · ${g.scope}`,
        scopeOrStatus: `${g.memberUserIds.length + g.memberGroupIds.length} miembros`,
        description: g.description || 'Suelta aquí usuarios o grupos compatibles',
        raw: g,
      }));

    const gpoLinksInOU = currentOUGpoLinks.map(({ link, gpo }: any) => ({
      rowId: `gpoLink-${link.id}`,
      entityType: 'gpoLink' as const,
      id: link.id,
      name: gpo.name,
      typeLabel: `Vínculo GPO · Orden #${link.linkOrder}`,
      scopeOrStatus: [
        link.linkEnabled ? 'Activo' : 'Desactivado',
        link.enforced ? 'Forzado (Enforced)' : 'Estándar',
      ].join(' · '),
      description: gpo.description || 'Directiva de grupo vinculada',
      raw: { link, gpo },
    }));

    const combined = [...childOUs, ...usersInOU, ...groupsInOU, ...gpoLinksInOU];

    return combined.filter((item) => {
      if (filterType === 'ou' && item.entityType !== 'ou') return false;
      if (filterType === 'user' && item.entityType !== 'user') return false;
      if (filterType === 'group' && item.entityType !== 'group') return false;
      if (filterType === 'gpo' && item.entityType !== 'gpoLink') return false;

      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.typeLabel.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [env, currentOU, currentOUGpoLinks, filterType, searchQuery, version]);

  /**
   * Mapa global de coincidencias en todo el árbol de Active Directory cuando el usuario
   * escribe en la barra "Filtrar objetos...". Permite iluminar en el TreeView qué OUs
   * coinciden o contienen usuarios/grupos coincidentes y expandir las ramas automáticamente.
   */
  const treeSearchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const directOuMatch: Record<string, boolean> = {};
    const matchingObjectsInOu: Record<string, number> = {};
    const hasDescendantMatch: Record<string, boolean> = {};
    const gpoMatches = new Set<string>();
    const otherOuMatches: Array<{
      id: string;
      entityType: 'ou' | 'user' | 'group';
      name: string;
      subtitle: string;
      ouId: string;
      ouName: string;
      ouPath: string;
    }> = [];

    if (!q) {
      return {
        active: false,
        directOuMatch,
        matchingObjectsInOu,
        hasDescendantMatch,
        gpoMatches,
        otherOuMatches,
        totalMatches: 0,
      };
    }

    let totalMatches = 0;

    // 1. Evaluar OUs directamente
    Object.values(env.ous).forEach((ou: any) => {
      const matched =
        ou.name.toLowerCase().includes(q) ||
        (ou.description || '').toLowerCase().includes(q);
      if (matched) {
        directOuMatch[ou.id] = true;
        totalMatches++;
        if (ou.id !== currentOU?.id) {
          otherOuMatches.push({
            id: ou.id,
            entityType: 'ou',
            name: ou.name,
            subtitle: 'Unidad organizativa',
            ouId: ou.id,
            ouName: ou.name,
            ouPath: env
              .getOUHierarchyPath(ou.id)
              .map((n: any) => n.name)
              .join(' / '),
          });
        }
      }
    });

    // 2. Evaluar Usuarios en todo el dominio
    Object.values(env.users).forEach((u: any) => {
      const matched =
        u.displayName.toLowerCase().includes(q) ||
        u.samAccountName.toLowerCase().includes(q) ||
        (u.department || '').toLowerCase().includes(q) ||
        (u.title || '').toLowerCase().includes(q);
      if (matched) {
        matchingObjectsInOu[u.ouId] = (matchingObjectsInOu[u.ouId] || 0) + 1;
        totalMatches++;
        if (u.ouId !== currentOU?.id) {
          otherOuMatches.push({
            id: u.id,
            entityType: 'user',
            name: u.displayName,
            subtitle: `Usuario · ${u.samAccountName}`,
            ouId: u.ouId,
            ouName: env.ous[u.ouId]?.name || 'Dominio',
            ouPath: env
              .getOUHierarchyPath(u.ouId)
              .map((n: any) => n.name)
              .join(' / '),
          });
        }
      }
    });

    // 3. Evaluar Grupos en todo el dominio
    Object.values(env.groups).forEach((g: any) => {
      const matched =
        g.name.toLowerCase().includes(q) ||
        g.scope.toLowerCase().includes(q) ||
        (g.description || '').toLowerCase().includes(q);
      if (matched) {
        matchingObjectsInOu[g.ouId] = (matchingObjectsInOu[g.ouId] || 0) + 1;
        totalMatches++;
        if (g.ouId !== currentOU?.id) {
          otherOuMatches.push({
            id: g.id,
            entityType: 'group',
            name: g.name,
            subtitle: `Grupo · ${g.scope}`,
            ouId: g.ouId,
            ouName: env.ous[g.ouId]?.name || 'Dominio',
            ouPath: env
              .getOUHierarchyPath(g.ouId)
              .map((n: any) => n.name)
              .join(' / '),
          });
        }
      }
    });

    // 4. Evaluar GPOs en todo el dominio
    Object.values(env.gpos).forEach((gpo: any) => {
      const matched =
        gpo.name.toLowerCase().includes(q) ||
        (gpo.description || '').toLowerCase().includes(q) ||
        (gpo.securityFiltering || []).some((sf: string) =>
          sf.toLowerCase().includes(q)
        );
      if (matched) {
        gpoMatches.add(gpo.id);
        totalMatches++;
      }
    });

    // 5. Propagar hacia arriba en la jerarquía de OUs para auto-expandir ramas con coincidencias
    Object.values(env.ous).forEach((ou: any) => {
      if (directOuMatch[ou.id] || (matchingObjectsInOu[ou.ouId || ou.id] || 0) > 0) {
        const path = env.getOUHierarchyPath(ou.id);
        path.forEach((ancestor: any) => {
          if (ancestor.id !== ou.id) {
            hasDescendantMatch[ancestor.id] = true;
          }
        });
      }
    });

    return {
      active: true,
      directOuMatch,
      matchingObjectsInOu,
      hasDescendantMatch,
      gpoMatches,
      otherOuMatches,
      totalMatches,
    };
  }, [env, currentOU, searchQuery, version]);

  const handleSelectOUInTree = (ouId: string) => {
    setSelectedOuId(ouId);
    if (
      centerViewMode === 'gpo-container' ||
      centerViewMode === 'rsop-simulator' ||
      centerViewMode === 'challenges-view' ||
      centerViewMode === 'powershell-bpa-view'
    ) {
      setCenterViewMode('ou-directory');
    }
    setSelectedEntity({ type: 'ou', id: ouId });
    setExpandedOuIds((prev) => ({ ...prev, [ouId]: true }));
  };

  const handleSelectGPOContainerInTree = () => {
    setCenterViewMode('gpo-container');
    setGpoContainerExpanded(true);
    const firstGpo = Object.values(env.gpos)[0] as any;
    if (firstGpo) {
      setSelectedEntity({ type: 'gpo', id: firstGpo.id });
    }
  };

  const openRSoPSimulatorForUser = (userId?: string) => {
    const target = userId || rsopTargetUserId || (Object.values(env.users)[0] as any)?.id;
    if (target && env.users[target]) {
      setRsopTargetUserId(target);
      setRsopResult(env.calculateUserRSoP(target));
      setSelectedEntity({ type: 'user', id: target });
    }
    setCenterViewMode('rsop-simulator');
  };

  const toggleExpandOU = (e: React.MouseEvent, ouId: string) => {
    e.stopPropagation();
    setExpandedOuIds((prev) => ({ ...prev, [ouId]: !prev[ouId] }));
  };

  const openObjectPicker = (
    mode: ObjectPickerState['mode'],
    targetId: string
  ) => {
    setPickerSearch('');
    setPickerScopeFilter('ALL');
    setObjectPicker({ open: true, mode, targetId });
  };

  const pickerCandidates = useMemo(() => {
    if (!objectPicker) return [];
    const q = pickerSearch.trim().toLowerCase();

    if (objectPicker.mode === 'user-member-of') {
      const user = env.users[objectPicker.targetId];
      if (!user) return [];
      return Object.values(env.groups)
        .filter((g: any) => !g.memberUserIds.includes(user.id))
        .filter((g: any) => (pickerScopeFilter === 'ALL' ? true : g.scope === pickerScopeFilter))
        .filter(
          (g: any) =>
            !q ||
            g.name.toLowerCase().includes(q) ||
            g.scope.toLowerCase().includes(q) ||
            (g.description || '').toLowerCase().includes(q)
        )
        .map((g: any) => ({
          candidateType: 'group' as const,
          id: g.id,
          name: g.name,
          subtitle: `Grupo ${g.scope} · ${env.ous[g.ouId]?.name || 'Dominio'}`,
          scope: g.scope,
          isRecommendedAGDLP: g.scope === GroupScope.GLOBAL,
        }));
    }

    if (objectPicker.mode === 'group-member-of') {
      const childGroup = env.groups[objectPicker.targetId];
      if (!childGroup) return [];
      return Object.values(env.groups)
        .filter(
          (g: any) =>
            g.id !== childGroup.id && !g.memberGroupIds.includes(childGroup.id)
        )
        .filter((g: any) => (pickerScopeFilter === 'ALL' ? true : g.scope === pickerScopeFilter))
        .filter(
          (g: any) =>
            !q ||
            g.name.toLowerCase().includes(q) ||
            g.scope.toLowerCase().includes(q)
        )
        .map((g: any) => {
          let compatible = true;
          try {
            env._validateGroupNestingScope(childGroup, g, { strictAGDLP });
          } catch {
            compatible = false;
          }
          return {
            candidateType: 'group' as const,
            id: g.id,
            name: g.name,
            subtitle: `Grupo ${g.scope} · ${env.ous[g.ouId]?.name || 'Dominio'}`,
            scope: g.scope,
            isRecommendedAGDLP: compatible,
          };
        });
    }

    const parentGroup = env.groups[objectPicker.targetId];
    if (!parentGroup) return [];

    const userCandidates = Object.values(env.users)
      .filter((u: any) => !parentGroup.memberUserIds.includes(u.id))
      .filter(() => pickerScopeFilter === 'ALL' || pickerScopeFilter === 'USERS')
      .filter(
        (u: any) =>
          !q ||
          u.displayName.toLowerCase().includes(q) ||
          u.samAccountName.toLowerCase().includes(q)
      )
      .map((u: any) => {
        let compatible = true;
        try {
          env.validateUserToGroupAGDLP(u, parentGroup, { strictAGDLP });
        } catch {
          compatible = false;
        }
        return {
          candidateType: 'user' as const,
          id: u.id,
          name: u.displayName,
          subtitle: `Usuario (${u.samAccountName}) · ${env.ous[u.ouId]?.name || 'Dominio'}`,
          scope: 'Account (A)',
          isRecommendedAGDLP: compatible,
        };
      });

    const groupCandidates = Object.values(env.groups)
      .filter(
        (g: any) =>
          g.id !== parentGroup.id && !parentGroup.memberGroupIds.includes(g.id)
      )
      .filter((g: any) =>
        pickerScopeFilter === 'ALL'
          ? true
          : pickerScopeFilter === 'USERS'
          ? false
          : g.scope === pickerScopeFilter
      )
      .filter(
        (g: any) =>
          !q ||
          g.name.toLowerCase().includes(q) ||
          g.scope.toLowerCase().includes(q)
      )
      .map((g: any) => {
        let compatible = true;
        try {
          env._validateGroupNestingScope(g, parentGroup, { strictAGDLP });
        } catch {
          compatible = false;
        }
        return {
          candidateType: 'group' as const,
          id: g.id,
          name: g.name,
          subtitle: `Grupo ${g.scope} · ${env.ous[g.ouId]?.name || 'Dominio'}`,
          scope: g.scope,
          isRecommendedAGDLP: compatible,
        };
      });

    return [...userCandidates, ...groupCandidates];
  }, [env, objectPicker, pickerSearch, pickerScopeFilter, strictAGDLP, version]);

  const handleDragStartRow = (
    e: React.DragEvent,
    item: { entityType: 'user' | 'group'; id: string; name: string; raw: any }
  ) => {
    const payload: DragPayload = {
      entityType: item.entityType,
      id: item.id,
      name: item.name,
      scope: item.entityType === 'group' ? item.raw.scope : 'Account',
    };
    setDraggedItem(payload);
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleDragEndRow = () => {
    setDraggedItem(null);
    setDragOverTargetId(null);
  };

  const handleDropOnGroupTarget = (e: React.DragEvent, targetGroupId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTargetId(null);

    let payload = draggedItem;
    if (!payload) {
      try {
        const raw = e.dataTransfer.getData('application/json');
        if (raw) payload = JSON.parse(raw);
      } catch {
        return;
      }
    }
    if (!payload) return;

    executeAddMemberToGroup(payload.entityType, payload.id, targetGroupId);
    setDraggedItem(null);
  };

  const openModal = (mode: ModalMode) => {
    if (mode === 'new-ou') {
      setOuName('');
      setOuDescription('');
      setOuBlockInheritance(false);
    } else if (mode === 'new-user') {
      setUserSam('');
      setUserDisplay('');
      setUserDept('');
      setUserTitle('');
    } else if (mode === 'new-group') {
      setGroupName('');
      setGroupScope(GroupScope.GLOBAL);
      setGroupDesc('');
      setGroupPermissionInput('');
    } else if (mode === 'new-base-gpo') {
      setGpoName('');
      setGpoDesc('');
      setGpoAppLocker(GPO_PRESET_OPTIONS.appLocker[2].value || '');
      setGpoWallpaper(GPO_PRESET_OPTIONS.wallpaper[1].value || '');
      setGpoProxy(GPO_PRESET_OPTIONS.proxy[1].value || '');
      setGpoWindowsUpdate(GPO_PRESET_OPTIONS.windowsUpdate[1].value || '');
    } else if (mode === 'link-existing-gpo') {
      const allGpos = Object.values(env.gpos) as any[];
      setSelectedExistingGpoId(allGpos[0]?.id || '');
      setGpoEnforcedOnLink(false);
    }
    setModalMode(mode);
  };

  const handleCreateOUSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = env.createOU({
        name: ouName,
        description: ouDescription,
        parentId: currentOU.id,
        blockInheritance: ouBlockInheritance,
      });
      setExpandedOuIds((prev) => ({ ...prev, [currentOU.id]: true, [created.id]: true }));
      commitChange();
      setSelectedEntity({ type: 'ou', id: created.id });
      setModalMode(null);
      notifySuccess(`Unidad Organizativa "${created.name}" creada en ${currentOU.name}.`);
    } catch (err) {
      handleADError(err);
    }
  };

  const handleCreateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = env.createUser({
        samAccountName: userSam,
        displayName: userDisplay || userSam,
        ouId: currentOU.id,
        department: userDept,
        title: userTitle,
      });
      commitChange();
      setSelectedEntity({ type: 'user', id: created.id });
      setRsopTargetUserId(created.id);
      setUserInspectorTab('memberOf');
      setModalMode(null);
      notifySuccess(`Usuario "${created.displayName}" (${created.samAccountName}) creado.`);
    } catch (err) {
      handleADError(err);
    }
  };

  const handleCreateGroupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const permissions = groupPermissionInput
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

      const created = env.createGroup({
        name: groupName,
        description: groupDesc,
        ouId: currentOU.id,
        scope: groupScope,
        permissions,
      });
      commitChange();
      setSelectedEntity({ type: 'group', id: created.id });
      setGroupInspectorTab('members');
      setModalMode(null);
      notifySuccess(`Grupo "${created.name}" (${created.scope}) creado.`);
    } catch (err) {
      handleADError(err);
    }
  };

  const handleCreateBaseGPOSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let createdGpo: any = null;
      recordGPOAction(
        {
          category: 'Repositorio GPO',
          gpoName: gpoName.trim(),
          summary: 'Creación de nueva GPO Base en el almacén central GPMC',
        },
        () => {
          createdGpo = env.createGPO({
            name: gpoName,
            description: gpoDesc || 'Directiva almacenada en Objetos de directiva de grupo',
            settings: {
              appLocker: gpoAppLocker || null,
              wallpaper: gpoWallpaper || null,
              proxy: gpoProxy || null,
              windowsUpdate: gpoWindowsUpdate || null,
            },
          });
          return { type: 'gpo', id: createdGpo.id };
        }
      );
      if (createdGpo) {
        setSelectedEntity({ type: 'gpo', id: createdGpo.id });
        setModalMode(null);
        notifySuccess(
          `GPO Base "${createdGpo.name}" creada en Objetos de directiva de grupo.`
        );
      }
    } catch (err) {
      handleADError(err);
    }
  };

  const handleLinkExistingGPOSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!selectedExistingGpoId) return;
      const targetGpoName = env.gpos[selectedExistingGpoId]?.name || 'GPO';
      let createdLink: any = null;
      recordGPOAction(
        {
          category: 'Vínculo OU',
          gpoName: targetGpoName,
          summary: `Vinculada a la OU "${currentOU.name}"${
            gpoEnforcedOnLink ? ' (Forzado / Enforced)' : ''
          }`,
        },
        () => {
          createdLink = env.linkGPOToOU(selectedExistingGpoId, currentOU.id, {
            enforced: gpoEnforcedOnLink,
          });
          return { type: 'gpoLink', id: createdLink.id };
        }
      );
      if (createdLink) {
        setCenterViewMode('ou-linked-gpos');
        setSelectedEntity({ type: 'gpoLink', id: createdLink.id });
        setModalMode(null);
        notifySuccess(
          `GPO "${targetGpoName}" vinculada a la OU "${currentOU.name}".`
        );
      }
    } catch (err) {
      handleADError(err);
    }
  };

  const renderTreeNode = (ouId: string, depth = 0) => {
    const ou = env.ous[ouId];
    if (!ou) return null;

    const hasChildren = Array.isArray(ou.childrenIds) && ou.childrenIds.length > 0;
    const isDirectMatch = Boolean(treeSearchMatches.directOuMatch[ou.id]);
    const containedMatchCount = treeSearchMatches.matchingObjectsInOu[ou.id] || 0;
    const hasChildMatch = Boolean(treeSearchMatches.hasDescendantMatch[ou.id]);
    const isRelevantInSearch =
      !treeSearchMatches.active || isDirectMatch || containedMatchCount > 0 || hasChildMatch;

    // Auto-expandir si hay búsqueda activa y una sub-rama tiene coincidencias
    const isExpanded =
      Boolean(expandedOuIds[ou.id]) ||
      (treeSearchMatches.active && (hasChildMatch || containedMatchCount > 0));

    const isSelected =
      (centerViewMode === 'ou-directory' || centerViewMode === 'ou-linked-gpos') &&
      selectedOuId === ou.id;

    return (
      <div key={ou.id} className="select-none">
        <div
          onClick={() => handleSelectOUInTree(ou.id)}
          style={{ paddingLeft: `${depth * 16 + 10}px` }}
          className={`group flex items-center justify-between pr-2.5 py-1.5 text-xs cursor-pointer transition-colors border-b border-transparent ${
            isSelected
              ? 'bg-sky-600 text-white font-medium'
              : treeSearchMatches.active && (isDirectMatch || containedMatchCount > 0)
              ? 'bg-amber-50/90 dark:bg-amber-500/15 text-slate-900 font-semibold border-l-2 border-l-amber-500'
              : 'text-slate-700 hover:bg-slate-100'
          } ${!isRelevantInSearch && !isSelected ? 'opacity-45' : ''}`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleExpandOU(e, ou.id)}
                className={`p-0.5 rounded transition-colors ${
                  isSelected ? 'hover:bg-sky-500 text-white' : 'hover:bg-slate-200 text-slate-500'
                }`}
                aria-label={isExpanded ? 'Contraer' : 'Expandir'}
              >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <span className="w-4 shrink-0" />
            )}

            {ou.isDomainRoot ? (
              <Globe className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-sky-600'}`} />
            ) : isExpanded && hasChildren ? (
              <FolderOpen className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-amber-600'}`} />
            ) : (
              <Folder className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-amber-600'}`} />
            )}

            <span className="truncate">
              <HighlightMatch
                text={ou.name}
                query={searchQuery}
                invertOnSelected={isSelected}
              />
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {treeSearchMatches.active && containedMatchCount > 0 && (
              <span
                title={`${containedMatchCount} objeto(s) coincidente(s) en esta OU`}
                className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-semibold tabular-nums ${
                  isSelected
                    ? 'bg-amber-300 text-slate-950'
                    : 'bg-amber-200/90 dark:bg-amber-500/30 text-amber-950 dark:text-amber-200'
                }`}
              >
                {containedMatchCount}
              </span>
            )}
            {ou.blockInheritance && (
              <span
                title="Herencia de GPO bloqueada (Block Inheritance)"
                className={`inline-flex items-center ${isSelected ? 'text-amber-200' : 'text-amber-600'}`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
              </span>
            )}
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {ou.childrenIds.map((childId: string) => renderTreeNode(childId, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderGPOSettingsEditor = (gpo: any) => {
    const currentFilterTarget = gpo.securityFiltering?.[0] || 'Authenticated Users';

    return (
      <div className="bg-white p-4 rounded border border-slate-200 space-y-3.5 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div>
            <h3 className="font-semibold text-slate-900">
              Editor de Administración de Directivas de Grupo (GPMC)
            </h3>
            <p className="text-slate-500">
              Directiva base: <strong>{gpo.name}</strong>
            </p>
          </div>
        </div>

        {/* Estado de GPO (GPMC → Detalles → Estado de GPO) */}
        <div className="space-y-1">
          <label className="block text-slate-700 font-medium" htmlFor={`gpo-status-${gpo.id}`}>
            Estado de GPO (GPO Status)
          </label>
          <select
            id={`gpo-status-${gpo.id}`}
            value={gpo.gpoStatus || 'Enabled'}
            onChange={(e) => {
              const next = e.target.value;
              const label = GPO_STATUS_OPTIONS.find((o: any) => o.value === next)?.label || next;
              recordGPOAction(
                {
                  category: 'Ajuste GPO',
                  gpoName: gpo.name,
                  summary: `Estado de GPO → ${label}`,
                  targetEntity: { type: 'gpo', id: gpo.id },
                },
                () => {
                  gpo.gpoStatus = next;
                  gpo.updatedAt = new Date().toISOString();
                }
              );
            }}
            className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white"
          >
            {GPO_STATUS_OPTIONS.map((o: any) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="text-slate-500">
            Deshabilitar la configuración de usuario anula tapiz, proxy y restricciones de cmd, regedit y Panel de control;
            la del equipo anula AppLocker, Windows Update y el despliegue de software.
          </p>
        </div>

        {/* Filtrado de Seguridad (Security Filtering) */}
        <div className="space-y-1">
          <label className="block text-slate-700 font-medium">
            Filtrado de Seguridad (Security Filtering)
          </label>
          <select
            value={currentFilterTarget}
            onChange={(e) => {
              const nextTarget = e.target.value;
              recordGPOAction(
                {
                  category: 'Seguridad',
                  gpoName: gpo.name,
                  summary: `Filtrado de Seguridad → "${nextTarget}"`,
                  targetEntity: { type: 'gpo', id: gpo.id },
                },
                () => {
                  gpo.setSecurityFiltering([nextTarget]);
                }
              );
              notifySuccess(
                `Filtrado de seguridad de "${gpo.name}" actualizado a "${nextTarget}".`
              );
            }}
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
          >
            <option value="Authenticated Users">
              Authenticated Users (Todos los usuarios del dominio)
            </option>
            {Object.values(env.groups).map((grp: any) => (
              <option key={grp.id} value={grp.name}>
                Solo miembros del grupo: {grp.name} ({grp.scope})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-slate-700 font-medium">
            1. AppLocker (Control de Ejecución de Aplicaciones)
          </label>
          <select
            value={gpo.settings.appLocker || ''}
            onChange={(e) => {
              const nextVal = e.target.value || null;
              recordGPOAction(
                {
                  category: 'Ajuste GPO',
                  gpoName: gpo.name,
                  summary: `AppLocker → ${nextVal ? `"${nextVal}"` : 'No configurado'}`,
                  targetEntity: { type: 'gpo', id: gpo.id },
                },
                () => {
                  gpo.updateSettings({ appLocker: nextVal });
                }
              );
            }}
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
          >
            {GPO_PRESET_OPTIONS.appLocker.map((opt, idx) => (
              <option key={idx} value={opt.value || ''}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-slate-700 font-medium">
            2. Desktop Wallpaper (Tapiz de Escritorio Active Desktop)
          </label>
          <select
            value={gpo.settings.wallpaper || ''}
            onChange={(e) => {
              const nextVal = e.target.value || null;
              recordGPOAction(
                {
                  category: 'Ajuste GPO',
                  gpoName: gpo.name,
                  summary: `Wallpaper → ${nextVal ? `"${nextVal}"` : 'No configurado'}`,
                  targetEntity: { type: 'gpo', id: gpo.id },
                },
                () => {
                  gpo.updateSettings({ wallpaper: nextVal });
                }
              );
            }}
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
          >
            {GPO_PRESET_OPTIONS.wallpaper.map((opt, idx) => (
              <option key={idx} value={opt.value || ''}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-slate-700 font-medium">
            3. Proxy Corporativo (WinHTTP / Internet Settings)
          </label>
          <select
            value={gpo.settings.proxy || ''}
            onChange={(e) => {
              const nextVal = e.target.value || null;
              recordGPOAction(
                {
                  category: 'Ajuste GPO',
                  gpoName: gpo.name,
                  summary: `Proxy Corporativo → ${nextVal ? `"${nextVal}"` : 'No configurado'}`,
                  targetEntity: { type: 'gpo', id: gpo.id },
                },
                () => {
                  gpo.updateSettings({ proxy: nextVal });
                }
              );
            }}
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
          >
            {GPO_PRESET_OPTIONS.proxy.map((opt, idx) => (
              <option key={idx} value={opt.value || ''}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-slate-700 font-medium">
            4. Windows Update / WSUS (Directiva de Parches)
          </label>
          <select
            value={gpo.settings.windowsUpdate || ''}
            onChange={(e) => {
              const nextVal = e.target.value || null;
              recordGPOAction(
                {
                  category: 'Ajuste GPO',
                  gpoName: gpo.name,
                  summary: `Windows Update → ${nextVal ? `"${nextVal}"` : 'No configurado'}`,
                  targetEntity: { type: 'gpo', id: gpo.id },
                },
                () => {
                  gpo.updateSettings({ windowsUpdate: nextVal });
                }
              );
            }}
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
          >
            {GPO_PRESET_OPTIONS.windowsUpdate.map((opt, idx) => (
              <option key={idx} value={opt.value || ''}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Restricciones de Plantillas Administrativas */}
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <span className="font-semibold text-slate-700 block">
            5. Restricciones de Sistema (Plantillas Administrativas)
          </span>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-slate-600">Bloquear Panel de Control (control.exe)</span>
            <input
              type="checkbox"
              checked={Boolean(gpo.settings.disableControlPanel)}
              onChange={(e) => {
                const checked = e.target.checked;
                recordGPOAction(
                  {
                    category: 'Ajuste GPO',
                    gpoName: gpo.name,
                    summary: `Bloquear Panel de Control (control.exe) → ${
                      checked ? 'Habilitado' : 'Deshabilitado'
                    }`,
                    targetEntity: { type: 'gpo', id: gpo.id },
                  },
                  () => {
                    gpo.updateSettings({ disableControlPanel: checked });
                  }
                );
              }}
              className="rounded border-slate-300 text-sky-600"
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-slate-600">Bloquear Símbolo del Sistema (cmd.exe)</span>
            <input
              type="checkbox"
              checked={Boolean(gpo.settings.disableCmd)}
              onChange={(e) => {
                const checked = e.target.checked;
                recordGPOAction(
                  {
                    category: 'Ajuste GPO',
                    gpoName: gpo.name,
                    summary: `Bloquear Símbolo del Sistema (cmd.exe) → ${
                      checked ? 'Habilitado' : 'Deshabilitado'
                    }`,
                    targetEntity: { type: 'gpo', id: gpo.id },
                  },
                  () => {
                    gpo.updateSettings({ disableCmd: checked });
                  }
                );
              }}
              className="rounded border-slate-300 text-sky-600"
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-slate-600">Deshabilitar Editor de Registro (regedit.exe)</span>
            <input
              type="checkbox"
              checked={Boolean(gpo.settings.disableRegistryTools)}
              onChange={(e) => {
                const checked = e.target.checked;
                recordGPOAction(
                  {
                    category: 'Ajuste GPO',
                    gpoName: gpo.name,
                    summary: `Deshabilitar Editor de Registro (regedit.exe) → ${
                      checked ? 'Habilitado' : 'Deshabilitado'
                    }`,
                    targetEntity: { type: 'gpo', id: gpo.id },
                  },
                  () => {
                    gpo.updateSettings({ disableRegistryTools: checked });
                  }
                );
              }}
              className="rounded border-slate-300 text-sky-600"
            />
          </label>
        </div>

        {/* Despliegue de Paquetes MSI */}
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <span className="font-semibold text-slate-700 block">
            6. Despliegue de Software (Instalación de Paquetes MSI)
          </span>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={newMsiPackageInput}
              onChange={(e) => setNewMsiPackageInput(e.target.value)}
              placeholder="Ej: ERP_Cliente_2026.msi"
              className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded font-mono"
            />
            <button
              type="button"
              onClick={() => {
                const pkg = newMsiPackageInput.trim();
                if (!pkg) return;
                recordGPOAction(
                  {
                    category: 'Software MSI',
                    gpoName: gpo.name,
                    summary: `Añadido paquete MSI "${pkg}" a Despliegue de Software`,
                    targetEntity: { type: 'gpo', id: gpo.id },
                  },
                  () => {
                    const currentList = Array.isArray(gpo.settings.deploySoftware)
                      ? gpo.settings.deploySoftware
                      : [];
                    gpo.updateSettings({
                      deploySoftware: [...new Set([...currentList, pkg])],
                    });
                  }
                );
                setNewMsiPackageInput('');
              }}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded font-medium"
            >
              + MSI
            </button>
          </div>
          {Array.isArray(gpo.settings.deploySoftware) &&
            gpo.settings.deploySoftware.length > 0 && (
              <div className="space-y-1">
                {gpo.settings.deploySoftware.map((msi: string) => (
                  <div
                    key={msi}
                    className="flex items-center justify-between px-2.5 py-1 bg-slate-50 rounded border border-slate-100 font-mono"
                  >
                    <span>{msi}</span>
                    <button
                      type="button"
                      onClick={() => {
                        recordGPOAction(
                          {
                            category: 'Software MSI',
                            gpoName: gpo.name,
                            summary: `Eliminado paquete MSI "${msi}" de Despliegue de Software`,
                            targetEntity: { type: 'gpo', id: gpo.id },
                          },
                          () => {
                            gpo.updateSettings({
                              deploySoftware: gpo.settings.deploySoftware.filter(
                                (item: string) => item !== msi
                              ),
                            });
                          }
                        );
                      }}
                      className="text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    );
  };

  return (
    <div className={`adlab-console min-h-screen flex flex-col bg-slate-50 text-slate-900 ${darkMode ? 'dark' : ''}`}>
      {/* TOP BAR CONTRACT: 3 Zonas */}
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-2.5 bg-slate-900 text-slate-100 border-b border-slate-800">
        <div className="flex items-center gap-3 shrink-0">
          <a
            href={AUTHOR_WEB_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="Visitar Un Fantasma en el Sistema (https://www.unfantasmaenelsistema.com/)"
            className="flex items-center gap-2.5 group shrink-0"
          >
            <span className="inline-flex items-center justify-center p-1 rounded-lg bg-white/95 shadow-xs ring-1 ring-slate-700/60 group-hover:ring-sky-400 transition-all shrink-0">
              <img
                src={AUTHOR_LOGO_URL}
                alt="Logo Un Fantasma en el Sistema"
                className="h-9 w-auto object-contain shrink-0 select-none"
              />
            </span>
          </a>

          <div className="flex flex-col">
            <a
              href="#top"
              onClick={(e) => {
                e.preventDefault();
                handleSelectOUInTree(env.rootOuId || '');
              }}
              className="text-base font-bold tracking-tight text-white hover:text-sky-300 transition-colors whitespace-nowrap leading-tight"
            >
              ADLab MMC Console
            </a>
            <a
              href={AUTHOR_WEB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-400 hover:text-sky-300 hover:underline transition-colors whitespace-nowrap"
            >
              <span>unfantasmaenelsistema.com</span>
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          </div>
        </div>

        <nav className="order-3 w-full lg:order-none lg:w-auto flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-medium text-slate-300">
          <button
            type="button"
            onClick={() => setCenterViewMode('ou-directory')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              centerViewMode === 'ou-directory' ? 'text-white underline underline-offset-4' : ''
            }`}
          >
            Usuarios y Equipos (dsa.msc)
          </button>
          <button
            type="button"
            onClick={() => setCenterViewMode('ou-linked-gpos')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              centerViewMode === 'ou-linked-gpos' ? 'text-white underline underline-offset-4' : ''
            }`}
          >
            GPOs en OU ({currentOUGpoLinks.length})
          </button>
          <button
            type="button"
            onClick={handleSelectGPOContainerInTree}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              centerViewMode === 'gpo-container' ? 'text-white underline underline-offset-4' : ''
            }`}
          >
            Almacén GPOs ({Object.keys(env.gpos).length})
          </button>
          <button
            type="button"
            onClick={() => openRSoPSimulatorForUser()}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              centerViewMode === 'rsop-simulator' ? 'text-white underline underline-offset-4' : ''
            }`}
          >
            RSoP / Simulación
          </button>
          <button
            type="button"
            onClick={() => setCenterViewMode('challenges-view')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              centerViewMode === 'challenges-view' ? 'text-amber-300 underline underline-offset-4' : 'text-amber-200/90'
            }`}
          >
            Retos Guiados ({challengeBadge})
          </button>
          <button
            type="button"
            onClick={() => setCenterViewMode('powershell-bpa-view')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              centerViewMode === 'powershell-bpa-view' ? 'text-sky-300 underline underline-offset-4' : ''
            }`}
          >
            PowerShell & BPA
          </button>
        </nav>

        <div className="flex items-center gap-2.5 shrink-0 relative">
          {/* Conmutador Global Dark Mode / Light Mode */}
          <button
            type="button"
            onClick={() => setDarkMode((prev) => !prev)}
            title={darkMode ? 'Cambiar a modo claro (MMC Clásico)' : 'Cambiar a modo oscuro (Consola IT Dark)'}
            aria-label="Alternar modo oscuro"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 ${
              darkMode
                ? 'bg-slate-800 text-amber-300 border-slate-700 hover:bg-slate-700'
                : 'bg-slate-800/80 text-slate-200 border-slate-700 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {darkMode ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-sky-400" />
                <span>Dark Mode</span>
              </>
            )}
          </button>

          {/* Input oculto para importar archivos .json */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportLaboratoryFile}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => setFileMenuOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 rounded transition-colors whitespace-nowrap shrink-0"
          >
            <FileJson className="w-3.5 h-3.5" />
            Archivo (Exportar / Importar)
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {fileMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-76 bg-white text-slate-800 rounded-md shadow-lg border border-slate-200 py-1.5 z-50 text-xs">
              <div className="px-3 py-1 text-slate-400 font-semibold">
                Gestión de Escenarios (.json / .ps1)
              </div>
              <button
                type="button"
                onClick={handleExportLaboratory}
                className="w-full px-3 py-2 text-left hover:bg-slate-100 flex items-center gap-2.5 font-medium text-slate-800"
              >
                <Download className="w-4 h-4 text-sky-600 shrink-0" />
                <div>
                  <div>Exportar Laboratorio</div>
                  <div className="text-slate-400 font-normal">
                    Descargar estado como adlab-snapshot.json
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFileMenuOpen(false);
                  fileInputRef.current?.click();
                }}
                className="w-full px-3 py-2 text-left hover:bg-slate-100 flex items-center gap-2.5 font-medium text-slate-800"
              >
                <Upload className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <div>Importar Laboratorio</div>
                  <div className="text-slate-400 font-normal">
                    Cargar escenario .json desde tu equipo
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  env.exportPowerShellToFile('deploy-adlab.ps1');
                  setFileMenuOpen(false);
                  notifySuccess('Script PowerShell "deploy-adlab.ps1" descargado.');
                }}
                className="w-full px-3 py-2 text-left hover:bg-slate-100 flex items-center gap-2.5 font-medium text-slate-800"
              >
                <Terminal className="w-4 h-4 text-indigo-600 shrink-0" />
                <div>
                  <div>Exportar Script PowerShell (.ps1)</div>
                  <div className="text-slate-400 font-normal">
                    Generar comandos AD DS para Windows Server
                  </div>
                </div>
              </button>

              <div className="my-1 border-t border-slate-100" />

              <button
                type="button"
                onClick={() => handleLoadTeacherChallenge('challenge-gpo-inheritance')}
                className="w-full px-3 py-2 text-left hover:bg-amber-50 flex items-center gap-2.5 font-medium text-amber-900"
              >
                <Award className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <div>Abrir Retos Guiados de Clase</div>
                  <div className="text-amber-700 font-normal">
                    3 escenarios autocorregibles (GPO y AGDLP)
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={handleResetEnvironment}
                className="w-full px-3 py-2 text-left hover:bg-slate-100 flex items-center gap-2.5 text-slate-600"
              >
                <X className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Restaurar Laboratorio de Fábrica</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* BARRA DE ACCIONES MMC */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-2.5 bg-white border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openModal('new-ou')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded transition-colors whitespace-nowrap shrink-0"
          >
            <FolderPlus className="w-3.5 h-3.5 text-amber-600" />
            Nueva OU
          </button>
          <button
            type="button"
            onClick={() => openModal('new-user')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded transition-colors whitespace-nowrap shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5 text-sky-600" />
            Nuevo Usuario
          </button>
          <button
            type="button"
            onClick={() => openModal('new-group')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded transition-colors whitespace-nowrap shrink-0"
          >
            <ShieldPlus className="w-3.5 h-3.5 text-indigo-600" />
            Nuevo Grupo
          </button>

          <div className="h-4 w-px bg-slate-200 mx-1" />

          <button
            type="button"
            onClick={() => openModal('new-base-gpo')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition-colors whitespace-nowrap shrink-0"
          >
            <FilePlus2 className="w-3.5 h-3.5 text-emerald-700" />
            Crear GPO Base
          </button>
          <button
            type="button"
            onClick={() => openModal('link-existing-gpo')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded transition-colors whitespace-nowrap shrink-0"
          >
            <Link2 className="w-3.5 h-3.5 text-emerald-600" />
            Vincular GPO a {currentOU.name}
          </button>

          <div className="h-4 w-px bg-slate-200 mx-1" />

          <button
            type="button"
            onClick={handleExportLaboratory}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-sky-600" />
            Exportar .json
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-600" />
            Importar .json
          </button>
        </div>

        <div className="flex items-center gap-3">
          {feedbackSuccess && (
            <span className="text-xs font-medium text-emerald-700 flex items-center gap-1">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>{feedbackSuccess}</span>
            </span>
          )}
          {treeSearchMatches.active && (
            <span className="text-xs font-mono text-amber-700 dark:text-amber-300 whitespace-nowrap">
              {treeSearchMatches.totalMatches} coincidencia(s) en el dominio
            </span>
          )}
          <div className="relative flex items-center">
            <Search
              className={`w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 ${
                treeSearchMatches.active ? 'text-amber-600' : 'text-slate-400'
              }`}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrar objetos..."
              className={`pl-8 pr-7 py-1.5 text-xs bg-slate-50 border rounded w-56 focus:outline-none transition-colors ${
                treeSearchMatches.active
                  ? 'border-amber-500 ring-1 ring-amber-500/30'
                  : 'border-slate-200 focus:border-sky-600'
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                title="Limpiar filtro"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* BANNER EDUCATIVO DE ERROR AGDLP */}
      {educationalError && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3.5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2 font-semibold text-red-900">
                <span>{educationalError.title}</span>
                <span className="text-red-500 font-mono">· Código: {educationalError.code}</span>
              </div>
              <p className="text-red-800 leading-relaxed max-w-4xl">
                {educationalError.message}
              </p>
              {educationalError.code !== 'AD_OPERATION_ERROR' && (
                <div className="pt-1 flex items-center gap-2 text-red-700 font-mono">
                  <BookOpen className="w-3.5 h-3.5 shrink-0" />
                  <span>Flujo recomendado Microsoft: {educationalError.expectedFlow}</span>
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEducationalError(null)}
            className="px-2.5 py-1 text-xs font-medium text-red-800 hover:bg-red-100 rounded shrink-0"
          >
            Entendido
          </button>
        </div>
      )}

      {/* WORKSPACE PRINCIPAL: 3 PANELES MMC */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-105px)]">
        {/* PANEL IZQUIERDO: Árbol de Directorio + GPMC + RSoP + Herramientas */}
        <aside className="min-w-0 lg:col-span-3 xl:col-span-3 bg-white border-r border-slate-200 flex flex-col">
          <div className="px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">
              Árbol de Consola (dsa.msc / gpmc.msc)
            </span>
          </div>

          <div className="py-2 flex-1 overflow-y-auto space-y-2">
            {/* 1. Árbol del Dominio y OUs */}
            <div>
              <div className="px-3 py-1 text-xs font-semibold text-slate-400">
                Unidades Organizativas
              </div>
              {renderTreeNode(env.rootOuId, 0)}
            </div>

            {/* 2. Nodo "Objetos de directiva de grupo" */}
            <div className="pt-2 border-t border-slate-100 select-none">
              <div className="px-3 py-1 text-xs font-semibold text-slate-400">
                Administración de Directivas (GPMC)
              </div>
              <div
                onClick={handleSelectGPOContainerInTree}
                className={`flex items-center justify-between px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                  centerViewMode === 'gpo-container'
                    ? 'bg-emerald-700 text-white font-medium'
                    : 'text-slate-800 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setGpoContainerExpanded((v) => !v);
                    }}
                    className="p-0.5 rounded"
                  >
                    {gpoContainerExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <Archive
                    className={`w-4 h-4 shrink-0 ${
                      centerViewMode === 'gpo-container' ? 'text-white' : 'text-emerald-600'
                    }`}
                  />
                  <span className="truncate">Objetos de directiva de grupo</span>
                </div>
                <span
                  className={`text-xs font-mono tabular-nums ${
                    centerViewMode === 'gpo-container' ? 'text-emerald-100' : 'text-slate-400'
                  }`}
                >
                  {Object.keys(env.gpos).length}
                </span>
              </div>

              {gpoContainerExpanded && (
                <div className="mt-0.5">
                  {Object.values(env.gpos).map((gpo: any) => {
                    const isGpoSelected =
                      selectedEntity.type === 'gpo' && selectedEntity.id === gpo.id;
                    const gpoMatched =
                      treeSearchMatches.active &&
                      (gpo.name.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
                        (gpo.description || '')
                          .toLowerCase()
                          .includes(searchQuery.trim().toLowerCase()));
                    return (
                      <div
                        key={gpo.id}
                        onClick={() => {
                          setCenterViewMode('gpo-container');
                          setSelectedEntity({ type: 'gpo', id: gpo.id });
                        }}
                        className={`flex items-center gap-2 pl-9 pr-3 py-1.5 text-xs cursor-pointer transition-colors ${
                          isGpoSelected
                            ? 'bg-emerald-50 text-emerald-900 font-semibold'
                            : gpoMatched
                            ? 'bg-amber-50/90 dark:bg-amber-500/15 text-slate-900 font-semibold border-l-2 border-l-amber-500'
                            : 'text-slate-600 hover:bg-slate-50'
                        } ${treeSearchMatches.active && !gpoMatched && !isGpoSelected ? 'opacity-45' : ''}`}
                      >
                        <FileCode2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">
                          <HighlightMatch text={gpo.name} query={searchQuery} />
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. Herramientas de Simulación, Retos y PowerShell */}
            <div className="pt-2 border-t border-slate-100 select-none space-y-0.5">
              <div className="px-3 py-1 text-xs font-semibold text-slate-400">
                Simulación y Evaluación
              </div>
              <div
                onClick={() => openRSoPSimulatorForUser()}
                className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition-colors ${
                  centerViewMode === 'rsop-simulator'
                    ? 'bg-slate-900 text-white font-medium'
                    : 'text-slate-800 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Cpu
                    className={`w-4 h-4 shrink-0 ${
                      centerViewMode === 'rsop-simulator' ? 'text-sky-400' : 'text-slate-700'
                    }`}
                  />
                  <span className="truncate">RSoP / Simulación de Usuario</span>
                </div>
              </div>

              <div
                onClick={() => setCenterViewMode('challenges-view')}
                className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition-colors ${
                  centerViewMode === 'challenges-view'
                    ? 'bg-amber-600 text-white font-medium'
                    : 'text-slate-800 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Award
                    className={`w-4 h-4 shrink-0 ${
                      centerViewMode === 'challenges-view' ? 'text-white' : 'text-amber-600'
                    }`}
                  />
                  <span className="truncate">Retos Guiados y Autoevaluación</span>
                </div>
                <span
                  className={`font-mono text-xs ${
                    centerViewMode === 'challenges-view' ? 'text-amber-100' : 'text-slate-500'
                  }`}
                >
                  {challengeBadge}
                </span>
              </div>

              <div
                onClick={() => setCenterViewMode('powershell-bpa-view')}
                className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition-colors ${
                  centerViewMode === 'powershell-bpa-view'
                    ? 'bg-indigo-700 text-white font-medium'
                    : 'text-slate-800 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Terminal
                    className={`w-4 h-4 shrink-0 ${
                      centerViewMode === 'powershell-bpa-view' ? 'text-white' : 'text-indigo-600'
                    }`}
                  />
                  <span className="truncate">Exportador PowerShell & BPA</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 space-y-2.5">
            <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
              <input
                type="checkbox"
                checked={strictAGDLP}
                onChange={(e) => setStrictAGDLP(e.target.checked)}
                className="rounded border-slate-300 text-sky-600"
              />
              <span>Validación Educativa AGDLP Estricta</span>
            </label>

            <a
              href={AUTHOR_WEB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 p-2 rounded-md bg-white border border-slate-200 hover:border-sky-400 transition-colors group"
              title="Ir a https://www.unfantasmaenelsistema.com/"
            >
              <img
                src={AUTHOR_LOGO_URL}
                alt="Un Fantasma en el Sistema"
                className="h-9 w-auto object-contain shrink-0 select-none"
              />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold text-slate-800 group-hover:text-sky-700 truncate flex items-center gap-1">
                  <span>Un Fantasma en el Sistema</span>
                  <ExternalLink className="w-3 h-3 shrink-0 text-sky-600" />
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  www.unfantasmaenelsistema.com
                </div>
              </div>
            </a>
          </div>
        </aside>

        {/* PANEL CENTRAL */}
        <main className="min-w-0 lg:col-span-5 xl:col-span-5 bg-white border-r border-slate-200 flex flex-col">
          {centerViewMode === 'challenges-view' ? (
            /* ================================================================
               VISTA DE RETOS GUIADOS Y AUTOEVALUACIÓN DOCENTE
               ================================================================ */
            <div className="flex-1 flex flex-col overflow-y-auto divide-y divide-slate-200 text-xs">
              <div className="p-5 bg-amber-50/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-amber-800 font-semibold">
                    Laboratorio de Autoevaluación · ADLab Training
                  </span>
                  <span className="font-mono font-bold text-amber-900">
                    {isActiveChallengeLoaded
                      ? `Progreso actual: ${challengeEvaluation.score} objetivos`
                      : 'Escenario no cargado'}
                  </span>
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  Escenarios Prácticos de Resolución de Problemas (Troubleshooting)
                </h2>
                <p className="text-slate-600 leading-relaxed">
                  Selecciona un escenario de laboratorio para cargar una topología con incidencias reales de Windows Server. Resuelve el problema usando las consolas y verifica automáticamente cada objetivo.
                </p>

                <div className="grid grid-cols-1 gap-2 pt-1">
                  {LAB_CHALLENGES.map((ch) => {
                    const isSelected = activeChallengeId === ch.id;
                    return (
                      <div
                        key={ch.id}
                        onClick={() => setActiveChallengeId(ch.id)}
                        className={`p-3 rounded border cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-white border-amber-500 shadow-2xs'
                            : 'bg-white/70 border-slate-200 hover:bg-white'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-slate-900">{ch.title}</div>
                          <div className="text-slate-500 mt-0.5">
                            Nivel: {ch.difficulty}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLoadTeacherChallenge(ch.id);
                          }}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded shrink-0"
                        >
                          Cargar Escenario
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {(() => {
                const activeMeta =
                  LAB_CHALLENGES.find((c) => c.id === activeChallengeId) ||
                  LAB_CHALLENGES[0];
                return (
                  <div className="p-5 space-y-4">
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-slate-900">
                        {activeMeta.title}
                      </h3>
                      <p className="text-slate-600 leading-relaxed">
                        {activeMeta.scenarioDescription}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">
                          Verificación en Tiempo Real de Objetivos:
                        </span>
                        <span
                          className={`font-semibold ${
                            challengeEvaluation.completed
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {challengeEvaluation.completed
                            ? '¡Reto Superado al 100%!'
                            : `En progreso (${challengeEvaluation.score})`}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {!isActiveChallengeLoaded && (
                          <div className="p-2.5 rounded border border-amber-300 bg-amber-50 text-amber-900">
                            Este reto no está cargado: la verificación de abajo se calcula sobre el entorno actual. Pulsa
                            <strong> Cargar Escenario</strong> para empezarlo con su topología.
                          </div>
                        )}
                        {challengeEvaluation.checks.map((chk: any, idx: number) => (
                          <div
                            key={idx}
                            className={`p-3 rounded border flex items-start gap-2.5 ${
                              chk.passed
                                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            {chk.passed ? (
                              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-slate-400 shrink-0 mt-0.5" />
                            )}
                            <span className="leading-relaxed">{chk.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openRSoPSimulatorForUser()}
                        className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-medium rounded"
                      >
                        Ir a Simulador RSoP
                      </button>
                      <button
                        type="button"
                        onClick={() => setCenterViewMode('ou-directory')}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium rounded"
                      >
                        Ir a Usuarios y Equipos (dsa.msc)
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : centerViewMode === 'powershell-bpa-view' ? (
            /* ================================================================
               VISTA DE GENERADOR POWERSHELL (.PS1) Y AUDITORÍA BPA
               ================================================================ */
            <div className="flex-1 flex flex-col overflow-y-auto divide-y divide-slate-200 text-xs">
              <div className="p-5 bg-slate-50 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-mono text-indigo-700 font-semibold">
                      Windows PowerShell · Módulos ActiveDirectory & GroupPolicy
                    </span>
                    <h2 className="text-base font-bold text-slate-900 mt-0.5">
                      Script de Despliegue Real para Windows Server (.ps1)
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(powerShellScript);
                        notifySuccess('Script PowerShell copiado al portapapeles.');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded font-medium text-slate-800"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copiar Script
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        env.exportPowerShellToFile('deploy-adlab.ps1');
                        notifySuccess('Archivo "deploy-adlab.ps1" descargado.');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Descargar deploy-adlab.ps1
                    </button>
                  </div>
                </div>
                <p className="text-slate-600">
                  Este script se genera dinámicamente a partir de tu diseño actual y puede ejecutarse directamente en un controlador de dominio Windows Server 2022/2025 para desplegar toda la infraestructura en producción.
                </p>
                <pre className="p-3.5 bg-slate-900 text-slate-100 rounded font-mono text-xs overflow-x-auto max-h-72 leading-relaxed">
                  {powerShellScript}
                </pre>
              </div>

              <div className="p-5 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Analizador de Buenas Prácticas de Active Directory (BPA)
                    </h3>
                    <p className="text-slate-500">
                      Auditoría automática de arquitectura AGDLP, vínculos GPO y bloqueo de herencia.
                    </p>
                  </div>
                  <span className="font-mono text-slate-500">
                    {domainAuditFindings.length} hallazgos
                  </span>
                </div>

                {domainAuditFindings.length === 0 ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded text-emerald-900 font-medium">
                    ¡Excelente! No se detectaron advertencias de diseño en el directorio actual.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {domainAuditFindings.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-3 rounded border space-y-1 ${
                          item.severity === 'error'
                            ? 'bg-red-50 border-red-200 text-red-950'
                            : item.severity === 'warning'
                            ? 'bg-amber-50 border-amber-200 text-amber-950'
                            : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between font-semibold">
                          <span>{item.title}</span>
                          <span className="font-mono text-slate-500">{item.category}</span>
                        </div>
                        <p className="text-slate-600 leading-relaxed">
                          {item.recommendation}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : centerViewMode === 'rsop-simulator' ? (
            /* ================================================================
               PESTAÑA / VISTA "RSoP / SIMULACIÓN" PARA UN USUARIO
               ================================================================ */
            <div className="flex-1 flex flex-col overflow-y-auto divide-y divide-slate-200">
              {/* Cabecera y Selector de Usuario + Botón "Calcular RSoP" */}
              <div className="p-5 bg-slate-50 space-y-3.5">
                <div>
                  <span className="text-xs font-mono text-sky-700">
                    rsop.msc · Resultant Set of Policy Engine
                  </span>
                  <h2 className="text-base font-bold text-slate-900 mt-0.5">
                    Simulación RSoP por Usuario (Dominio → OUs Anidadas)
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Selecciona un usuario del directorio y pulsa <strong>Calcular RSoP</strong> para evaluar la herencia descendente, el Orden de Vínculo, el Bloqueo de Herencia, el Filtrado de Seguridad y los vínculos Forzados (Enforced).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <div className="flex-1 min-w-[220px]">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Usuario objetivo de la simulación:
                    </label>
                    <select
                      value={rsopTargetUserId}
                      onChange={(e) => {
                        setRsopTargetUserId(e.target.value);
                        handleCalculateUserRSoP(e.target.value);
                      }}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded font-medium text-slate-900 focus:outline-none focus:border-sky-600"
                    >
                      {Object.values(env.users).map((u: any) => {
                        const pathNames = env
                          .getOUHierarchyPath(u.ouId)
                          .map((o: any) => o.name)
                          .join(' → ');
                        return (
                          <option key={u.id} value={u.id}>
                            {u.displayName} ({u.samAccountName}) — [{pathNames}]
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="self-end">
                    <button
                      type="button"
                      onClick={() => handleCalculateUserRSoP(rsopTargetUserId)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded transition-colors shadow-2xs whitespace-nowrap"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Calcular RSoP
                    </button>
                  </div>
                </div>
              </div>

              {rsopResult && (
                <>
                  {/* 1. Previsualización del Escritorio Cliente Windows 11 Resultante */}
                  <div className="p-5 bg-slate-900 text-slate-100 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-sky-400" />
                        <span className="font-semibold">
                          Vista Previa de Sesión Cliente Windows 11 ({rsopResult.user.samAccountName}@{env.domainName})
                        </span>
                      </div>
                      <span className="font-mono text-slate-400">
                        OU: {env.ous[rsopResult.user.ouId]?.name}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="p-3 rounded bg-slate-800/90 border border-slate-700 space-y-1">
                        <span className="text-slate-400 block">Tapiz y Entorno Visual</span>
                        <span className="font-mono text-sky-300 block truncate">
                          {rsopResult.settingsTable
                            .find((r: any) => r.key === 'wallpaper')
                            ?.finalValue.split('\\')
                            .pop() || 'Tapiz Windows predeterminado'}
                        </span>
                      </div>
                      <div className="p-3 rounded bg-slate-800/90 border border-slate-700 space-y-1">
                        <span className="text-slate-400 block flex items-center gap-1">
                          <Package className="w-3.5 h-3.5 text-emerald-400" />
                          Software MSI Instalado
                        </span>
                        <span className="font-mono text-emerald-300 block truncate">
                          {rsopResult.settingsTable.find((r: any) => r.key === 'deploySoftware')
                            ?.isConfigured
                            ? rsopResult.settingsTable.find(
                                (r: any) => r.key === 'deploySoftware'
                              )?.finalValue
                            : 'Sin paquetes MSI asignados'}
                        </span>
                      </div>
                      <div className="p-3 rounded bg-slate-800/90 border border-slate-700 space-y-1">
                        <span className="text-slate-400 block">Herramientas del Sistema</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span
                            className={`inline-flex items-center gap-1 ${
                              rsopResult.settingsTable.find(
                                (r: any) => r.key === 'disableControlPanel'
                              )?.isConfigured
                                ? 'text-red-400'
                                : 'text-emerald-400'
                            }`}
                          >
                            {rsopResult.settingsTable.find(
                              (r: any) => r.key === 'disableControlPanel'
                            )?.isConfigured ? (
                              <Lock className="w-3 h-3" />
                            ) : (
                              <Unlock className="w-3 h-3" />
                            )}
                            Panel
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 ${
                              rsopResult.settingsTable.find((r: any) => r.key === 'disableCmd')
                                ?.isConfigured
                                ? 'text-red-400'
                                : 'text-emerald-400'
                            }`}
                          >
                            {rsopResult.settingsTable.find((r: any) => r.key === 'disableCmd')
                              ?.isConfigured ? (
                              <Lock className="w-3 h-3" />
                            ) : (
                              <Unlock className="w-3 h-3" />
                            )}
                            CMD
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 ${
                              rsopResult.settingsTable.find(
                                (r: any) => r.key === 'disableRegistryTools'
                              )?.isConfigured
                                ? 'text-red-400'
                                : 'text-emerald-400'
                            }`}
                          >
                            {rsopResult.settingsTable.find(
                              (r: any) => r.key === 'disableRegistryTools'
                            )?.isConfigured ? (
                              <Lock className="w-3 h-3" />
                            ) : (
                              <Unlock className="w-3 h-3" />
                            )}
                            Regedit
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. Traza Visual de Procesamiento Jerárquico (Dominio -> OUs -> Usuario) */}
                  <div className="p-5 bg-white space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-slate-900">
                        1. Ruta de Evaluación Jerárquica (LSDOU: Dominio → OUs Hijas)
                      </h3>
                      <span className="font-mono text-slate-500">
                        {rsopResult.appliedGPOs.length} GPOs aplicadas · {rsopResult.blockedGPOs.length} descartadas
                      </span>
                    </div>

                    <div className="space-y-2">
                      {rsopResult.hierarchySteps.map((step: any, idx: number) => (
                        <React.Fragment key={step.ou.id}>
                          {idx > 0 && (
                            <div className="flex justify-center">
                              <ArrowDown className="w-3.5 h-3.5 text-slate-400" />
                            </div>
                          )}
                          <div className="p-3 rounded border border-slate-200 bg-slate-50/70 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                {step.ou.isDomainRoot ? (
                                  <Globe className="w-4 h-4 text-sky-600" />
                                ) : (
                                  <Folder className="w-4 h-4 text-amber-600" />
                                )}
                                <span className="font-semibold text-slate-900">
                                  Nivel {idx + 1}: {step.ou.name}
                                </span>
                                <span className="text-slate-400">·</span>
                                <span className="text-slate-500">
                                  {step.ou.isDomainRoot ? 'Raíz del Dominio' : 'Unidad Organizativa'}
                                </span>
                              </div>

                              {/* Checkbox rápido para probar Block Inheritance en vivo desde el simulador */}
                              <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
                                <input
                                  type="checkbox"
                                  checked={Boolean(step.ou.blockInheritance)}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    recordGPOAction(
                                      {
                                        category: 'Herencia OU',
                                        gpoName: step.ou.name,
                                        summary: `Bloquear herencia (Block Inheritance) → ${
                                          checked ? 'ACTIVADO' : 'DESACTIVADO'
                                        }`,
                                        targetEntity: { type: 'ou', id: step.ou.id },
                                      },
                                      () => {
                                        env.setOUBlockInheritance(step.ou.id, checked);
                                      }
                                    );
                                    handleCalculateUserRSoP(rsopTargetUserId);
                                  }}
                                  className="rounded border-slate-300 text-amber-600"
                                />
                                <span>Bloquear herencia aquí</span>
                              </label>
                            </div>

                            {step.blockedHere.length > 0 && (
                              <div className="p-2 bg-amber-50 border border-amber-200 rounded text-amber-900 space-y-1">
                                {step.blockedHere.map((b: any, bIdx: number) => (
                                  <div key={bIdx}>
                                    <strong>Directiva Descartada ({b.gpo.name}):</strong> {b.reason}
                                  </div>
                                ))}
                              </div>
                            )}

                            {step.linkedEntries.length === 0 ? (
                              <p className="text-slate-400">Sin GPOs vinculadas en este nivel.</p>
                            ) : (
                              <div className="space-y-1">
                                {step.linkedEntries.map((entry: any) => (
                                  <div
                                    key={entry.link.id}
                                    className="flex items-center justify-between px-2.5 py-1.5 bg-white rounded border border-slate-200"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <FileCode2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      <span className="font-medium text-slate-800 truncate">
                                        {entry.gpo.name}
                                      </span>
                                      <span className="font-mono text-slate-400">
                                        (Orden #{entry.linkOrder})
                                      </span>
                                    </div>
                                    <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 shrink-0 ml-2">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(entry.link.enforced)}
                                        onChange={(e) => {
                                          const checked = e.target.checked;
                                          recordGPOAction(
                                            {
                                              category: 'Forzado (Enforced)',
                                              gpoName: entry.gpo.name,
                                              summary: `Forzar (Enforced) en "${step.ou.name}" → ${
                                                checked ? 'Sí (Forzado)' : 'No (Estándar)'
                                              }`,
                                              targetEntity: { type: 'gpoLink', id: entry.link.id },
                                            },
                                            () => {
                                              env.setGPOLinkEnforced(entry.link.id, checked);
                                            }
                                          );
                                          handleCalculateUserRSoP(rsopTargetUserId);
                                        }}
                                        className="rounded border-slate-300 text-emerald-600"
                                      />
                                      <span className={entry.link.enforced ? 'font-semibold text-emerald-700' : ''}>
                                        Forzar (Enforced)
                                      </span>
                                    </label>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  {/* 3. Tabla Detallada de Directivas Aplicadas y GPO Ganadora */}
                  <div className="p-5 bg-white space-y-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-slate-900 flex items-center gap-2 flex-wrap">
                          <span>
                            2. Tabla de Resolución de Directivas Efectivas para "{rsopResult.user.displayName}"
                          </span>
                          {(() => {
                            const conflictCount = rsopResult.settingsTable.filter(
                              (r: any) => r.hasConflict
                            ).length;
                            return conflictCount > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-semibold">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                {conflictCount} conflicto(s) de registro detectado(s)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-medium">
                                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                Sin colisiones de directivas
                              </span>
                            );
                          })()}
                        </h3>
                        <p className="text-slate-500 mt-0.5">
                          Muestra el valor final que recibe el usuario en cada clave de registro, el indicador de conflicto cuando múltiples GPOs compiten y la regla exacta de desempate (Orden de Vínculo #1, Jerarquía LSDOU o Vínculo Forzado).
                        </p>
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded">
                      <div className="overflow-x-auto max-w-full"><table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                            <th className="py-2.5 pl-3 pr-2">Configuración y Clave de Registro</th>
                            <th className="py-2.5 px-2">Valor Final Aplicado</th>
                            <th className="py-2.5 px-2">GPO Origen Ganadora</th>
                            <th className="py-2.5 pl-2 pr-3">Resolución de Precedencia y Conflictos</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {rsopResult.settingsTable.map((row: any) => (
                            <tr
                              key={row.key}
                              className={
                                row.hasConflict
                                  ? 'bg-amber-50/25 border-l-2 border-l-amber-500'
                                  : row.isConfigured
                                  ? 'bg-white'
                                  : 'bg-slate-50/50 text-slate-400'
                              }
                            >
                              <td className="py-2.5 pl-3 pr-2 align-top">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-semibold text-slate-900">
                                    {row.label}
                                  </span>
                                  {row.hasConflict && (
                                    <span
                                      title={`Colisión de registro: ${row.totalCompetingGPOs} GPOs configuran ${row.registryKey}`}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-semibold"
                                    >
                                      <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                                      Conflicto ({row.totalCompetingGPOs} GPOs)
                                    </span>
                                  )}
                                </div>
                                <div className="text-slate-500 mt-0.5">{row.category}</div>
                                {row.registryKey && (
                                  <div
                                    className="font-mono text-[10px] text-slate-400 mt-0.5 break-all"
                                    title="Clave del Registro de Windows afectada"
                                  >
                                    {row.registryKey}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-2 align-top">
                                <div className="font-mono text-slate-900 font-medium">
                                  {row.finalValue}
                                </div>
                                {row.hasConflict && row.overriddenHistory?.length > 0 && (
                                  <div className="mt-1 space-y-0.5">
                                    {row.overriddenHistory.map((ov: any, oIdx: number) => (
                                      <div
                                        key={oIdx}
                                        className="font-mono text-[11px] text-slate-400 line-through"
                                        title={`Valor sobrescrito de ${ov.gpoName} (${ov.sourceOUName}, Orden #${ov.linkOrder})`}
                                      >
                                        {ov.value}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-2 align-top whitespace-nowrap">
                                {row.winningGPO ? (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-semibold text-emerald-800">
                                        {row.winningGPO}
                                      </span>
                                      {row.isEnforcedWinner && (
                                        <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-semibold">
                                          Forzado
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-slate-500">
                                      Desde: <strong>{row.winningOU}</strong> · Orden #{row.winningOrder}
                                    </div>
                                    {row.hasConflict && row.conflictResolutionRule && (
                                      <div className="inline-block px-1.5 py-0.5 rounded bg-sky-50 text-sky-900 border border-sky-200 text-[10px] font-medium">
                                        {row.conflictResolutionRule}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="py-2.5 pl-2 pr-3 align-top text-slate-600 leading-relaxed">
                                <p>{row.explanation}</p>
                                {row.hasConflict &&
                                  Array.isArray(row.competingChain) &&
                                  row.competingChain.length > 1 && (
                                    <div className="mt-2 p-2 rounded bg-white border border-slate-200 space-y-1">
                                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                        Traza de Competición por Clave de Registro ({row.competingChain.length} GPOs):
                                      </div>
                                      {row.competingChain.map((comp: any, cIdx: number) => (
                                        <div
                                          key={cIdx}
                                          className={`flex flex-wrap items-center justify-between gap-2 px-2 py-1 rounded text-[11px] ${
                                            comp.isWinner
                                              ? 'bg-emerald-50/90 text-emerald-950 border border-emerald-200 font-medium'
                                              : 'bg-slate-50 text-slate-500'
                                          }`}
                                        >
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="font-mono text-[10px] px-1 rounded bg-slate-200/80 text-slate-700">
                                              {cIdx + 1}
                                            </span>
                                            <span
                                              className={
                                                comp.isWinner
                                                  ? 'font-semibold text-emerald-900'
                                                  : 'line-through text-slate-500'
                                              }
                                            >
                                              {comp.gpoName}
                                            </span>
                                            <span className="text-slate-400">
                                              ({comp.sourceOUName} · Orden #{comp.linkOrder}
                                              {comp.enforced ? ' · Enforced' : ''})
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2 shrink-0">
                                            <span
                                              className={`font-mono ${
                                                comp.isWinner ? 'text-emerald-900' : 'line-through text-slate-400'
                                              }`}
                                            >
                                              "{comp.value}"
                                            </span>
                                            <span
                                              className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                                                comp.isWinner
                                                  ? 'bg-emerald-600 text-white'
                                                  : 'bg-amber-100 text-amber-900'
                                              }`}
                                            >
                                              {comp.isWinner ? 'GANADORA' : comp.outcomeLabel}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table></div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : centerViewMode === 'gpo-container' ? (
            /* ================================================================
               VISTA DEL NODO "OBJETOS DE DIRECTIVA DE GRUPO" (GPMC REPOSITORY)
               ================================================================ */
            <>
              <div className="px-5 py-3.5 border-b border-slate-200 bg-emerald-50/40 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-950">
                    <span>{env.domainName}</span>
                    <span className="text-slate-400">/</span>
                    <span>Objetos de directiva de grupo (Almacén Central GPMC)</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Repositorio maestro de GPOs del dominio. Crea aquí directivas base y luego vincúlalas a cualquier OU.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={gpoActionHistory.length === 0}
                    onClick={() => handleUndoGPOAction(0)}
                    title={
                      gpoActionHistory.length > 0
                        ? `Deshacer: [${gpoActionHistory[0].gpoName}] ${gpoActionHistory[0].summary}`
                        : 'No hay cambios recientes de GPO para deshacer'
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none rounded transition-colors whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                    Deshacer último cambio
                    {gpoActionHistory.length > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-mono text-[10px] font-semibold">
                        {gpoActionHistory.length}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => openModal('new-base-gpo')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-colors whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Nueva GPO Base
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto flex flex-col divide-y divide-slate-200">
                <div className="overflow-x-auto">
                  <div className="overflow-x-auto max-w-full"><table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        <th className="py-2.5 pl-5 pr-3">Nombre de la GPO</th>
                        <th className="py-2.5 px-3">Configuraciones Simuladas</th>
                        <th className="py-2.5 px-3">Filtrado de Seguridad</th>
                        <th className="py-2.5 px-3">OUs Vinculadas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {Object.values(env.gpos).map((gpo: any) => {
                        const linksForGpo = Object.values(env.gpoLinks).filter(
                          (l: any) => l.gpoId === gpo.id
                        ) as any[];
                        const activeSettingsCount = [
                          gpo.settings.appLocker,
                          gpo.settings.wallpaper,
                          gpo.settings.proxy,
                          gpo.settings.windowsUpdate,
                          gpo.settings.disableControlPanel,
                          gpo.settings.disableCmd,
                          gpo.settings.disableRegistryTools,
                          gpo.settings.deploySoftware?.length > 0,
                        ].filter(Boolean).length;
                        const isRowSelected =
                          selectedEntity.type === 'gpo' && selectedEntity.id === gpo.id;
                        const isGpoSearchMatch =
                          treeSearchMatches.active && treeSearchMatches.gpoMatches.has(gpo.id);

                        return (
                          <tr
                            key={gpo.id}
                            onClick={() => setSelectedEntity({ type: 'gpo', id: gpo.id })}
                            className={`h-11 cursor-pointer transition-colors ${
                              isRowSelected
                                ? 'bg-emerald-50/90 text-slate-900 font-medium'
                                : isGpoSearchMatch
                                ? 'bg-amber-50/40 hover:bg-amber-50/70 text-slate-900 border-l-2 border-l-amber-500'
                                : treeSearchMatches.active
                                ? 'opacity-45 hover:opacity-100 hover:bg-slate-50 text-slate-700'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <td className="py-2 pl-5 pr-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <FileCode2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>
                                  <HighlightMatch text={gpo.name} query={searchQuery} />
                                </span>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-slate-600">
                              {activeSettingsCount} ajustes activos
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-600">
                              <HighlightMatch
                                text={(gpo.securityFiltering || ['Authenticated Users']).join(', ')}
                                query={searchQuery}
                              />
                            </td>
                            <td className="py-2 px-3 text-slate-600 tabular-nums">
                              {linksForGpo.length === 0 ? (
                                'No vinculada'
                              ) : (
                                <HighlightMatch
                                  text={linksForGpo
                                    .map((l) => env.ous[l.ouId]?.name)
                                    .filter(Boolean)
                                    .join(', ')}
                                  query={searchQuery}
                                />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table></div>
                </div>

                {/* PANEL DE ACCIONES RECIENTES EN GPOs (PILA DE HISTORIAL / UNDO — ÚLTIMOS 5 CAMBIOS) */}
                <div className="p-5 bg-slate-50/60 space-y-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-emerald-700 shrink-0" />
                      <div>
                        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                          <span>Acciones Recientes en GPOs (Recent GPO Actions)</span>
                          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700">
                            {gpoActionHistory.length}/{MAX_GPO_HISTORY_ITEMS} en pila
                          </span>
                        </h3>
                        <p className="text-slate-500">
                          Registra los últimos {MAX_GPO_HISTORY_ITEMS} cambios de directivas, vínculos, precedencia y herencia con capacidad de reversión instantánea (Undo).
                        </p>
                      </div>
                    </div>

                    {gpoActionHistory.length > 0 && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleUndoGPOAction(0)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Deshacer último (#1)
                        </button>
                        <button
                          type="button"
                          onClick={() => setGpoActionHistory([])}
                          className="px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded transition-colors"
                        >
                          Limpiar historial
                        </button>
                      </div>
                    )}
                  </div>

                  {gpoActionHistory.length === 0 ? (
                    <div className="p-6 text-center bg-white border border-dashed border-slate-200 rounded text-slate-500">
                      Aún no se han registrado cambios de configuración en GPOs en esta sesión. Edita cualquier ajuste de una GPO (AppLocker, Wallpaper, Proxy, Windows Update, MSI, Filtrado de Seguridad o Vínculos) para ver aquí los últimos 5 cambios y deshacerlos en un clic.
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-200 rounded divide-y divide-slate-100 overflow-hidden">
                      {gpoActionHistory.map((item, idx) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            if (
                              item.targetEntity.type === 'gpo' &&
                              env.gpos[item.targetEntity.id]
                            ) {
                              setSelectedEntity(item.targetEntity);
                            } else if (
                              item.targetEntity.type === 'gpoLink' &&
                              env.gpoLinks[item.targetEntity.id]
                            ) {
                              setSelectedEntity(item.targetEntity);
                            } else if (
                              item.targetEntity.type === 'ou' &&
                              env.ous[item.targetEntity.id]
                            ) {
                              setSelectedEntity(item.targetEntity);
                            }
                          }}
                          className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <span
                              className={`mt-0.5 font-mono text-[11px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                                idx === 0
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              #{idx + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-slate-900">
                                  {item.gpoName}
                                </span>
                                <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200/70 text-[10px] font-medium">
                                  {item.category}
                                </span>
                                <span className="font-mono text-[11px] text-slate-400">
                                  {item.timestamp}
                                </span>
                              </div>
                              <p className="text-slate-600 mt-0.5 truncate">
                                {item.summary}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUndoGPOAction(idx);
                            }}
                            title={
                              idx === 0
                                ? 'Deshacer este último cambio'
                                : `Revertir el estado hasta antes de este cambio (deshará ${
                                    idx + 1
                                  } acciones)`
                            }
                            className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                              idx === 0
                                ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>{idx === 0 ? 'Deshacer' : `Revertir (${idx + 1})`}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* ================================================================
               VISTA DE UNIDAD ORGANIZATIVA: PESTAÑAS "OBJETOS" | "GPOs VINCULADAS" | "RSoP"
               ================================================================ */
            <>
              <div className="px-5 pt-3.5 border-b border-slate-200 bg-slate-50/60">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 flex-wrap">
                    {breadcrumbPath.map((node: any, idx: number) => (
                      <React.Fragment key={node.id}>
                        {idx > 0 && <span className="text-slate-400">/</span>}
                        <button
                          type="button"
                          onClick={() => handleSelectOUInTree(node.id)}
                          className={`hover:text-sky-700 transition-colors ${
                            node.id === currentOU.id ? 'font-semibold text-slate-900' : ''
                          }`}
                        >
                          {node.name}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>

                  {/* Checkbox interactivo en la propia OU para "Bloquear herencia" (Block Inheritance) */}
                  <label className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-white border border-slate-200 text-xs font-medium text-slate-800 cursor-pointer select-none shadow-2xs">
                    <input
                      type="checkbox"
                      checked={Boolean(currentOU.blockInheritance)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        recordGPOAction(
                          {
                            category: 'Herencia OU',
                            gpoName: currentOU.name,
                            summary: `Bloquear herencia (Block Inheritance) → ${
                              checked ? 'ACTIVADO' : 'DESACTIVADO'
                            }`,
                            targetEntity: { type: 'ou', id: currentOU.id },
                          },
                          () => {
                            env.setOUBlockInheritance(currentOU.id, checked);
                          }
                        );
                        notifySuccess(
                          `Bloquear herencia (Block Inheritance) ${
                            checked ? 'ACTIVADO' : 'DESACTIVADO'
                          } en la OU "${currentOU.name}".`
                        );
                      }}
                      className="rounded border-slate-300 text-amber-600"
                    />
                    <span>Bloquear herencia (Block Inheritance)</span>
                  </label>
                </div>

                <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                  <span className="font-mono truncate" title={currentOUDN}>
                    {currentOUDN}
                  </span>
                  <div className="flex items-center gap-1">
                    {(['all', 'ou', 'user', 'group', 'gpo'] as ObjectTypeFilter[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFilterType(f)}
                        className={`px-2 py-0.5 rounded text-xs ${
                          filterType === f
                            ? 'bg-slate-800 text-white font-medium'
                            : 'text-slate-500 hover:bg-slate-200/70'
                        }`}
                      >
                        {f === 'all' && 'Todos'}
                        {f === 'ou' && 'OUs'}
                        {f === 'user' && 'Usuarios'}
                        {f === 'group' && 'Grupos'}
                        {f === 'gpo' && 'GPOs'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pestañas de la OU */}
                <div className="flex items-center gap-1 mt-3">
                  <button
                    type="button"
                    onClick={() => setCenterViewMode('ou-directory')}
                    className={`px-3.5 py-2 text-xs font-semibold rounded-t border-t border-x transition-colors ${
                      centerViewMode === 'ou-directory'
                        ? 'bg-white text-slate-900 border-slate-200 -mb-px'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Objetos en contenedor ({ouContents.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCenterViewMode('ou-linked-gpos')}
                    className={`px-3.5 py-2 text-xs font-semibold rounded-t border-t border-x transition-colors ${
                      centerViewMode === 'ou-linked-gpos'
                        ? 'bg-white text-emerald-900 border-slate-200 -mb-px'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    GPOs vinculadas ({currentOUGpoLinks.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => openRSoPSimulatorForUser()}
                    className="px-3.5 py-2 text-xs font-semibold rounded-t border-t border-x border-transparent text-sky-700 hover:text-sky-900 transition-colors"
                  >
                    RSoP / Simulación de Usuario
                  </button>
                </div>
              </div>

              {/* SUB-VISTA A: OBJETOS DE DIRECTORIO */}
              {centerViewMode === 'ou-directory' && (
                <div className="flex-1 overflow-x-auto flex flex-col">
                  {ouContents.length === 0 ? (
                    <div className="p-8 text-center">
                      <p className="text-sm font-medium text-slate-700">
                        {treeSearchMatches.active
                          ? `Sin coincidencias para "${searchQuery.trim()}" en "${currentOU.name}"`
                          : 'No hay objetos en este contenedor'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                        {treeSearchMatches.active
                          ? treeSearchMatches.otherOuMatches.length > 0
                            ? 'Selecciona una de las coincidencias encontradas en otras Unidades Organizativas debajo o haz clic en las OUs resaltadas en el árbol izquierdo.'
                            : 'Prueba con otro término de búsqueda o limpia el filtro.'
                          : 'Utiliza los botones superiores para crear sub-OUs, usuarios, grupos o vincular GPOs.'}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-w-full"><table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                          <th className="py-2.5 pl-4 pr-3">Nombre</th>
                          <th className="py-2.5 px-3">Tipo / Identificador</th>
                          <th className="py-2.5 px-3">Estado / Ámbito</th>
                          <th className="py-2.5 pl-3 pr-5">Descripción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {ouContents.map((item) => {
                          const isRowSelected =
                            selectedEntity.type === item.entityType &&
                            selectedEntity.id === item.id;
                          const isDraggable =
                            item.entityType === 'user' || item.entityType === 'group';
                          const isDropTarget = item.entityType === 'group';
                          const isBeingDraggedOver = dragOverTargetId === `row-${item.id}`;

                          return (
                            <tr
                              key={item.rowId}
                              draggable={isDraggable}
                              onDragStart={
                                isDraggable
                                  ? (e) =>
                                      handleDragStartRow(e, {
                                        entityType: item.entityType as 'user' | 'group',
                                        id: item.id,
                                        name: item.name,
                                        raw: item.raw,
                                      })
                                  : undefined
                              }
                              onDragEnd={isDraggable ? handleDragEndRow : undefined}
                              onDragOver={
                                isDropTarget
                                  ? (e) => {
                                      e.preventDefault();
                                      setDragOverTargetId(`row-${item.id}`);
                                    }
                                  : undefined
                              }
                              onDragLeave={
                                isDropTarget
                                  ? () => {
                                      if (dragOverTargetId === `row-${item.id}`) {
                                        setDragOverTargetId(null);
                                      }
                                    }
                                  : undefined
                              }
                              onDrop={
                                isDropTarget
                                  ? (e) => handleDropOnGroupTarget(e, item.id)
                                  : undefined
                              }
                              onClick={() =>
                                setSelectedEntity({ type: item.entityType, id: item.id })
                              }
                              onDoubleClick={() => {
                                if (item.entityType === 'ou') {
                                  handleSelectOUInTree(item.id);
                                }
                              }}
                              className={`h-10 cursor-pointer transition-colors ${
                                isBeingDraggedOver
                                  ? 'bg-indigo-100/90 outline-1 outline-dashed outline-indigo-600'
                                  : isRowSelected
                                  ? 'bg-sky-50/90 text-slate-900 font-medium'
                                  : treeSearchMatches.active
                                  ? 'bg-amber-50/35 hover:bg-amber-50/70 text-slate-900 border-l-2 border-l-amber-500'
                                  : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <td className="py-2 pl-3 pr-3 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  {isDraggable ? (
                                    <span
                                      title="Arrastrar hacia un grupo"
                                      className="inline-flex shrink-0"
                                    >
                                      <GripVertical className="w-3.5 h-3.5 text-slate-400 cursor-grab" />
                                    </span>
                                  ) : (
                                    <span className="w-3.5 shrink-0" />
                                  )}
                                  {item.entityType === 'ou' && (
                                    <Folder className="w-4 h-4 text-amber-600 shrink-0" />
                                  )}
                                  {item.entityType === 'user' && (
                                    <UserIcon className="w-4 h-4 text-sky-600 shrink-0" />
                                  )}
                                  {item.entityType === 'group' && (
                                    <Users className="w-4 h-4 text-indigo-600 shrink-0" />
                                  )}
                                  {item.entityType === 'gpoLink' && (
                                    <FileCode2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                  )}
                                  <span className="truncate max-w-[180px]">
                                    <HighlightMatch text={item.name} query={searchQuery} />
                                  </span>
                                </div>
                              </td>
                              <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
                                <HighlightMatch text={item.typeLabel} query={searchQuery} />
                              </td>
                              <td className="py-2 px-3 text-slate-600 whitespace-nowrap tabular-nums">
                                <HighlightMatch text={item.scopeOrStatus} query={searchQuery} />
                              </td>
                              <td className="py-2 pl-3 pr-5 text-slate-500 truncate max-w-[200px]">
                                <HighlightMatch text={item.description} query={searchQuery} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table></div>
                  )}

                  {/* Coincidencias globales en otras Unidades Organizativas del Dominio */}
                  {treeSearchMatches.active && treeSearchMatches.otherOuMatches.length > 0 && (
                    <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                          <Search className="w-3.5 h-3.5 text-amber-600" />
                          Coincidencias en otras Unidades Organizativas (
                          {treeSearchMatches.otherOuMatches.length})
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Haz clic para ir a su contenedor y seleccionar el objeto
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
                        {treeSearchMatches.otherOuMatches.map((match) => (
                          <button
                            key={`${match.entityType}-${match.id}`}
                            type="button"
                            onClick={() => {
                              setCenterViewMode('ou-directory');
                              setSelectedOuId(match.ouId);
                              setSelectedEntity({
                                type: match.entityType,
                                id: match.id,
                              });
                            }}
                            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded border border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50/40 text-left text-xs transition-colors group"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {match.entityType === 'ou' && (
                                <Folder className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              )}
                              {match.entityType === 'user' && (
                                <UserIcon className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                              )}
                              {match.entityType === 'group' && (
                                <Users className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              )}
                              <div className="min-w-0">
                                <div className="font-medium text-slate-900 truncate">
                                  <HighlightMatch text={match.name} query={searchQuery} />
                                </div>
                                <div className="text-[11px] text-slate-500 truncate">
                                  <HighlightMatch text={match.subtitle} query={searchQuery} />
                                </div>
                              </div>
                            </div>
                            <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 group-hover:bg-amber-100 text-[10px] font-medium text-slate-600 group-hover:text-amber-900">
                              <Folder className="w-2.5 h-2.5 text-amber-600" />
                              {match.ouName}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SUB-VISTA B: PESTAÑA "GPOs VINCULADAS" EN LA OU ACTUAL */}
              {centerViewMode === 'ou-linked-gpos' && (
                <div className="flex-1 flex flex-col overflow-y-auto divide-y divide-slate-200">
                  <div className="p-4 bg-white space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-semibold text-slate-900">
                          Vínculos de GPO en "{currentOU.name}" (Orden de Precedencia Local)
                        </h3>
                        <p className="text-xs text-slate-500">
                          El Orden <strong>#1</strong> tiene la máxima prioridad local en esta OU. Usa las flechas para cambiar la precedencia o activa <strong>Forzar (Enforced)</strong>.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openModal('link-existing-gpo')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-colors whitespace-nowrap shrink-0"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        Vincular GPO existente...
                      </button>
                    </div>

                    {currentOUGpoLinks.length === 0 ? (
                      <div className="p-6 text-center border border-dashed border-slate-200 rounded text-xs text-slate-500">
                        No hay GPOs vinculadas directamente a la OU <strong>{currentOU.name}</strong>.
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-w-full"><table className="w-full text-left border-collapse border border-slate-200 rounded">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                            <th className="py-2 pl-3 pr-2">Orden</th>
                            <th className="py-2 px-2">Directiva GPO</th>
                            <th className="py-2 px-2">Forzar (Enforced)</th>
                            <th className="py-2 px-2">Vínculo Activo</th>
                            <th className="py-2 pl-2 pr-3 text-right">Precedencia / Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {currentOUGpoLinks.map(({ link, gpo }: any, idx: number) => {
                            const isSelected =
                              selectedEntity.type === 'gpoLink' &&
                              selectedEntity.id === link.id;
                            const isGpoMatch =
                              treeSearchMatches.active &&
                              treeSearchMatches.gpoMatches.has(gpo.id);
                            return (
                              <tr
                                key={link.id}
                                onClick={() =>
                                  setSelectedEntity({ type: 'gpoLink', id: link.id })
                                }
                                className={`h-10 cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-emerald-50/80 font-medium text-slate-900'
                                    : isGpoMatch
                                    ? 'bg-amber-50/40 hover:bg-amber-50/70 text-slate-900 border-l-2 border-l-amber-500'
                                    : 'hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <td className="py-2 pl-3 pr-2 font-mono tabular-nums">
                                  #{link.linkOrder}
                                </td>
                                <td className="py-2 px-2">
                                  <div className="flex items-center gap-1.5">
                                    <FileCode2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span className="truncate max-w-[160px]">
                                      <HighlightMatch text={gpo.name} query={searchQuery} />
                                    </span>
                                  </div>
                                </td>
                                <td
                                  className="py-2 px-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(link.enforced)}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        recordGPOAction(
                                          {
                                            category: 'Forzado (Enforced)',
                                            gpoName: gpo.name,
                                            summary: `Vínculo en "${currentOU.name}" → Forzar (Enforced): ${
                                              checked ? 'Sí' : 'No'
                                            }`,
                                            targetEntity: { type: 'gpoLink', id: link.id },
                                          },
                                          () => {
                                            env.setGPOLinkEnforced(link.id, checked);
                                          }
                                        );
                                        notifySuccess(
                                          `GPO "${gpo.name}" ${
                                            checked
                                              ? 'marcada como Forzada (Enforced)'
                                              : 'cambiada a modo normal'
                                          }.`
                                        );
                                      }}
                                      className="rounded border-slate-300 text-emerald-600"
                                    />
                                    <span>{link.enforced ? 'Sí (Forzado)' : 'No'}</span>
                                  </label>
                                </td>
                                <td
                                  className="py-2 px-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(link.linkEnabled)}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        recordGPOAction(
                                          {
                                            category: 'Vínculo OU',
                                            gpoName: gpo.name,
                                            summary: `Estado del vínculo en "${currentOU.name}" → ${
                                              checked ? 'Habilitado' : 'Inactivo'
                                            }`,
                                            targetEntity: { type: 'gpoLink', id: link.id },
                                          },
                                          () => {
                                            env.setGPOLinkEnabled(link.id, checked);
                                          }
                                        );
                                      }}
                                      className="rounded border-slate-300 text-sky-600"
                                    />
                                    <span>{link.linkEnabled ? 'Habilitado' : 'Inactivo'}</span>
                                  </label>
                                </td>
                                <td
                                  className="py-2 pl-2 pr-3 text-right whitespace-nowrap space-x-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={() => {
                                      recordGPOAction(
                                        {
                                          category: 'Precedencia',
                                          gpoName: gpo.name,
                                          summary: `Subida prioridad en "${currentOU.name}" (Orden #${link.linkOrder} → #${
                                            link.linkOrder - 1
                                          })`,
                                          targetEntity: { type: 'gpoLink', id: link.id },
                                        },
                                        () => {
                                          env.moveGPOLinkOrder(link.id, 'up');
                                        }
                                      );
                                    }}
                                    className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                                    title="Subir prioridad (acercar a Orden #1)"
                                  >
                                    <ArrowUp className="w-3.5 h-3.5 inline" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={idx === currentOUGpoLinks.length - 1}
                                    onClick={() => {
                                      recordGPOAction(
                                        {
                                          category: 'Precedencia',
                                          gpoName: gpo.name,
                                          summary: `Bajada prioridad en "${currentOU.name}" (Orden #${link.linkOrder} → #${
                                            link.linkOrder + 1
                                          })`,
                                          targetEntity: { type: 'gpoLink', id: link.id },
                                        },
                                        () => {
                                          env.moveGPOLinkOrder(link.id, 'down');
                                        }
                                      );
                                    }}
                                    className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                                    title="Bajar prioridad"
                                  >
                                    <ArrowDown className="w-3.5 h-3.5 inline" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      recordGPOAction(
                                        {
                                          category: 'Vínculo OU',
                                          gpoName: gpo.name,
                                          summary: `Eliminado vínculo de la OU "${currentOU.name}"`,
                                          targetEntity: { type: 'ou', id: currentOU.id },
                                        },
                                        () => {
                                          env.unlinkGPOFromOU(gpo.id, currentOU.id);
                                        }
                                      );
                                      notifySuccess(
                                        `Vínculo de "${gpo.name}" eliminado de ${currentOU.name}.`
                                      );
                                    }}
                                    className="p-1 text-slate-400 hover:text-red-600"
                                    title="Eliminar vínculo de esta OU"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 inline" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table></div>
                    )}
                  </div>

                  {currentOURSoP && (
                    <div className="p-4 bg-slate-50/60 space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-slate-900">
                            Herencia Resultante de GPOs en "{currentOU.name}"
                          </h4>
                          <p className="text-slate-500">
                            Resultado efectivo combinando herencia de dominio, Block Inheritance y Enforced.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openRSoPSimulatorForUser()}
                          className="px-3 py-1.5 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 rounded"
                        >
                          Abrir Simulador RSoP Detallado →
                        </button>
                      </div>

                      <div className="bg-white rounded border border-slate-200 divide-y divide-slate-100">
                        <div className="p-2.5 flex items-center justify-between">
                          <span className="font-medium text-slate-700">1. AppLocker:</span>
                          <div className="text-right">
                            <span className="font-mono text-slate-900 block">
                              {currentOURSoP.resultantSettings.appLocker || 'No configurado'}
                            </span>
                            {currentOURSoP.winningGPOs?.appLocker && (
                              <span className="text-emerald-700">
                                Ganadora: {currentOURSoP.winningGPOs.appLocker}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="p-2.5 flex items-center justify-between">
                          <span className="font-medium text-slate-700">2. Wallpaper:</span>
                          <div className="text-right">
                            <span className="font-mono text-slate-900 block">
                              {currentOURSoP.resultantSettings.wallpaper || 'No configurado'}
                            </span>
                            {currentOURSoP.winningGPOs?.wallpaper && (
                              <span className="text-emerald-700">
                                Ganadora: {currentOURSoP.winningGPOs.wallpaper}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="p-2.5 flex items-center justify-between">
                          <span className="font-medium text-slate-700">3. Proxy:</span>
                          <div className="text-right">
                            <span className="font-mono text-slate-900 block">
                              {currentOURSoP.resultantSettings.proxy || 'No configurado'}
                            </span>
                            {currentOURSoP.winningGPOs?.proxy && (
                              <span className="text-emerald-700">
                                Ganadora: {currentOURSoP.winningGPOs.proxy}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="p-2.5 flex items-center justify-between">
                          <span className="font-medium text-slate-700">4. Windows Update:</span>
                          <div className="text-right">
                            <span className="font-mono text-slate-900 block">
                              {currentOURSoP.resultantSettings.windowsUpdate || 'No configurado'}
                            </span>
                            {currentOURSoP.winningGPOs?.windowsUpdate && (
                              <span className="text-emerald-700">
                                Ganadora: {currentOURSoP.winningGPOs.windowsUpdate}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>

        {/* PANEL DERECHO: Inspector de Propiedades */}
        <aside className="min-w-0 lg:col-span-4 xl:col-span-4 bg-slate-50/50 flex flex-col">
          <div className="px-5 py-3 border-b border-slate-200 bg-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-semibold text-slate-800">
                Propiedades del Objeto Seleccionado
              </span>
            </div>
            {selectedEntity.id !== currentOU.id && (
              <button
                type="button"
                onClick={() => setSelectedEntity({ type: 'ou', id: currentOU.id })}
                className="text-xs text-sky-600 hover:underline"
              >
                Inspeccionar OU actual
              </button>
            )}
          </div>

          <div className="p-5 flex-1 overflow-y-auto space-y-5">
            {/* 1. INSPECTOR DE GPO BASE */}
            {selectedEntity.type === 'gpo' && env.gpos[selectedEntity.id] && (() => {
              const gpo = env.gpos[selectedEntity.id];
              return (
                <>
                  <div className="bg-white p-4 rounded border border-slate-200 space-y-2 text-xs">
                    <p className="text-slate-500">Objeto de Directiva de Grupo (GPO Base)</p>
                    <h2 className="text-base font-bold text-slate-900">{gpo.name}</h2>
                    <p className="text-slate-600">{gpo.description}</p>
                    <div className="pt-2 border-t border-slate-100 flex justify-between items-center gap-2">
                      <span className="font-mono text-slate-500">GUID: {gpo.id.slice(0, 12)}...</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedExistingGpoId(gpo.id);
                            setGpoEnforcedOnLink(false);
                            setModalMode('link-existing-gpo');
                          }}
                          className="px-2.5 py-1 bg-emerald-600 text-white font-medium rounded hover:bg-emerald-700"
                        >
                          Vincular a {currentOU.name}
                        </button>
                        {gpo.name !== 'Default Domain Policy' && (
                          <button
                            type="button"
                            onClick={() => {
                              const deletedName = gpo.name;
                              recordGPOAction(
                                {
                                  category: 'Repositorio GPO',
                                  gpoName: deletedName,
                                  summary: 'GPO eliminada del almacén central GPMC',
                                  targetEntity: { type: 'ou', id: currentOU.id },
                                },
                                () => {
                                  env.deleteGPO(gpo.id);
                                }
                              );
                              setSelectedEntity({ type: 'ou', id: currentOU.id });
                              notifySuccess(`GPO "${deletedName}" eliminada del dominio.`);
                            }}
                            className="p-1 text-slate-400 hover:text-red-600"
                            title="Eliminar GPO del almacén central"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {renderGPOSettingsEditor(gpo)}
                </>
              );
            })()}

            {/* 2. INSPECTOR DE OU */}
            {selectedEntity.type === 'ou' && env.ous[selectedEntity.id] && (() => {
              const inspectedOU = env.ous[selectedEntity.id];
              const rsop = env.calculateEffectiveGPOsForOU(inspectedOU.id);
              const dn = env.getDistinguishedName('', inspectedOU.id);

              return (
                <>
                  <div className="bg-white p-4 rounded border border-slate-200 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs text-slate-500">
                          {inspectedOU.isDomainRoot ? 'Dominio Active Directory' : 'Unidad Organizativa (OU)'}
                        </p>
                        <h2 className="text-base font-bold text-slate-900 mt-0.5">
                          {inspectedOU.name}
                        </h2>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectOUInTree(inspectedOU.id);
                            setCenterViewMode('ou-linked-gpos');
                          }}
                          className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded transition-colors"
                        >
                          Ver GPOs vinculadas
                        </button>
                        {!inspectedOU.isDomainRoot && (
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                const parentId = inspectedOU.parentId || env.rootOuId;
                                const deletedName = inspectedOU.name;
                                env.deleteOU(inspectedOU.id);
                                commitChange();
                                handleSelectOUInTree(parentId);
                                notifySuccess(`OU "${deletedName}" eliminada.`);
                              } catch (err) {
                                handleADError(err);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-red-600"
                            title="Eliminar Unidad Organizativa (si está vacía)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-600">
                      {inspectedOU.description || 'Sin descripción configurada.'}
                    </p>

                    <div className="pt-2 border-t border-slate-100 text-xs">
                      <span className="text-slate-500 block">Distinguished Name:</span>
                      <span className="font-mono text-slate-800 break-all">{dn}</span>
                    </div>

                    <div className="pt-3 border-t border-slate-200">
                      <label className="flex items-center justify-between cursor-pointer select-none">
                        <div>
                          <p className="text-xs font-semibold text-slate-800">
                            Bloquear herencia (Block Inheritance)
                          </p>
                          <p className="text-xs text-slate-500">
                            Impide heredar GPOs no forzadas de contenedores padres.
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={Boolean(inspectedOU.blockInheritance)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            recordGPOAction(
                              {
                                category: 'Herencia OU',
                                gpoName: inspectedOU.name,
                                summary: `Bloquear herencia (Block Inheritance) → ${
                                  checked ? 'ACTIVADO' : 'DESACTIVADO'
                                }`,
                                targetEntity: { type: 'ou', id: inspectedOU.id },
                              },
                              () => {
                                env.setOUBlockInheritance(inspectedOU.id, checked);
                              }
                            );
                            notifySuccess(
                              `Herencia ${
                                checked ? 'bloqueada' : 'habilitada'
                              } en ${inspectedOU.name}.`
                            );
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-amber-600"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded border border-slate-200 space-y-3 text-xs">
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        Orden de Precedencia y RSoP Efectivo
                      </h3>
                      <p className="text-slate-500">
                        Orden de aplicación de GPOs heredadas y locales (la última sobrescribe):
                      </p>
                    </div>

                    {rsop.appliedGPOs.length === 0 ? (
                      <p className="text-slate-400">Ninguna GPO activa aplica a esta OU.</p>
                    ) : (
                      <ol className="space-y-1">
                        {rsop.appliedGPOs.map((entry: any, index: number) => (
                          <li
                            key={`${entry.link.id}-${index}`}
                            className="flex items-center justify-between py-1.5 px-2.5 bg-slate-50 rounded border border-slate-100"
                          >
                            <span className="font-medium text-slate-800 truncate">
                              {index + 1}. {entry.gpo.name}
                            </span>
                            <span className="text-slate-500 shrink-0 ml-2">
                              {entry.sourceOU.name}
                              {entry.link.enforced ? ' · Forzado' : ''}
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </>
              );
            })()}

            {/* 3. INSPECTOR DE VÍNCULO GPO (GPOLink) */}
            {selectedEntity.type === 'gpoLink' && env.gpoLinks[selectedEntity.id] && (() => {
              const link = env.gpoLinks[selectedEntity.id];
              const gpo = env.gpos[link.gpoId];
              const linkedOU = env.ous[link.ouId];
              if (!gpo) return null;

              return (
                <>
                  <div className="bg-white p-4 rounded border border-slate-200 space-y-3 text-xs">
                    <div>
                      <p className="text-slate-500">Vínculo de Directiva de Grupo (GPOLink)</p>
                      <h2 className="text-base font-bold text-slate-900 mt-0.5">{gpo.name}</h2>
                      <p className="text-slate-600 mt-0.5">
                        Contenedor: <strong>{linkedOU?.name}</strong> · Orden #{link.linkOrder}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-200 space-y-2.5">
                      <label className="flex items-center justify-between cursor-pointer select-none">
                        <div>
                          <p className="font-semibold text-slate-800">Forzar (Enforced)</p>
                          <p className="text-slate-500">
                            Prevalece sobre OUs hijas e ignora Block Inheritance.
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={Boolean(link.enforced)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            recordGPOAction(
                              {
                                category: 'Forzado (Enforced)',
                                gpoName: gpo.name,
                                summary: `Vínculo en "${linkedOU?.name}" → Forzar (Enforced): ${
                                  checked ? 'Sí' : 'No'
                                }`,
                                targetEntity: { type: 'gpoLink', id: link.id },
                              },
                              () => {
                                env.setGPOLinkEnforced(link.id, checked);
                              }
                            );
                            notifySuccess(
                              `Vínculo GPO "${gpo.name}" ${
                                checked ? 'Forzado (Enforced)' : 'Estándar'
                              }.`
                            );
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600"
                        />
                      </label>

                      <label className="flex items-center justify-between cursor-pointer select-none">
                        <div>
                          <p className="font-semibold text-slate-800">Vínculo habilitado</p>
                          <p className="text-slate-500">Procesar esta GPO en {linkedOU?.name}.</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={Boolean(link.linkEnabled)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            recordGPOAction(
                              {
                                category: 'Vínculo OU',
                                gpoName: gpo.name,
                                summary: `Vínculo en "${linkedOU?.name}" → ${
                                  checked ? 'Habilitado' : 'Inactivo'
                                }`,
                                targetEntity: { type: 'gpoLink', id: link.id },
                              },
                              () => {
                                env.setGPOLinkEnabled(link.id, checked);
                              }
                            );
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-sky-600"
                        />
                      </label>
                    </div>
                  </div>

                  {renderGPOSettingsEditor(gpo)}
                </>
              );
            })()}

            {/* 4. INSPECTOR DE USUARIO */}
            {selectedEntity.type === 'user' && env.users[selectedEntity.id] && (() => {
              const user = env.users[selectedEntity.id];
              const agdlp = env.getUserEffectiveGroupsAndPermissions(user.id);
              const userDN = env.getDistinguishedName(user.displayName, user.ouId);

              return (
                <div className="bg-white rounded border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-start justify-between">
                    <div>
                      <p className="text-xs text-slate-500">Propiedades de Usuario</p>
                      <h2 className="text-base font-bold text-slate-900 mt-0.5">
                        {user.displayName}
                      </h2>
                      <p className="text-xs font-mono text-slate-600">
                        {user.samAccountName}@{env.domainName}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openRSoPSimulatorForUser(user.id)}
                        className="px-2.5 py-1 text-xs font-medium bg-sky-600 text-white hover:bg-sky-700 rounded transition-colors"
                      >
                        Simular RSoP
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const name = user.displayName;
                          env.deleteUser(user.id);
                          commitChange();
                          setSelectedEntity({ type: 'ou', id: currentOU.id });
                          notifySuccess(`Usuario "${name}" eliminado.`);
                        }}
                        className="p-1 text-slate-400 hover:text-red-600"
                        title="Eliminar usuario"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex border-b border-slate-200 bg-slate-100/70 px-3 pt-2 gap-1">
                    <button
                      type="button"
                      onClick={() => setUserInspectorTab('general')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-t border-t border-x ${
                        userInspectorTab === 'general'
                          ? 'bg-white text-slate-900 border-slate-200 -mb-px'
                          : 'border-transparent text-slate-600'
                      }`}
                    >
                      General / Mover OU
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserInspectorTab('memberOf')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-t border-t border-x ${
                        userInspectorTab === 'memberOf'
                          ? 'bg-white text-slate-900 border-slate-200 -mb-px'
                          : 'border-transparent text-slate-600'
                      }`}
                    >
                      Miembro de ({agdlp.directGroups.length})
                    </button>
                  </div>

                  {userInspectorTab === 'general' && (
                    <div className="p-4 space-y-3 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">sAMAccountName</span>
                        <span className="font-mono">{user.samAccountName}</span>
                      </div>
                      <div className="space-y-1">
                        <label className="text-slate-700 font-medium block">
                          Unidad Organizativa (Mover Objeto):
                        </label>
                        <select
                          value={user.ouId}
                          onChange={(e) => {
                            env.moveUserToOU(user.id, e.target.value);
                            commitChange();
                            notifySuccess(
                              `Usuario "${user.displayName}" movido a la OU "${env.ous[e.target.value]?.name}".`
                            );
                          }}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded"
                        >
                          {Object.values(env.ous).map((ou: any) => (
                            <option key={ou.id} value={ou.id}>
                              {ou.name} ({env.getDistinguishedName('', ou.id)})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <span className="text-slate-500 block">Distinguished Name</span>
                        <div className="p-2 bg-slate-50 rounded font-mono break-all border border-slate-100">
                          {userDN}
                        </div>
                      </div>
                    </div>
                  )}

                  {userInspectorTab === 'memberOf' && (
                    <div className="p-4 space-y-4 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-800">
                          Pertenencia a Grupos (Paso A → G)
                        </span>
                        <button
                          type="button"
                          onClick={() => openObjectPicker('user-member-of', user.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-sky-600 hover:bg-sky-700 rounded"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Añadir al grupo...
                        </button>
                      </div>

                      <div className="border border-slate-200 rounded overflow-hidden">
                        {agdlp.directGroups.length === 0 ? (
                          <div className="p-4 text-center text-slate-400">
                            No pertenece a ningún grupo.
                          </div>
                        ) : (
                          <ul className="divide-y divide-slate-100">
                            {agdlp.directGroups.map((g: any) => (
                              <li
                                key={g.id}
                                className="flex items-center justify-between px-3 py-2"
                              >
                                <span className="font-medium text-sky-700">
                                  {g.name} · {g.scope}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    env.removeUserFromGroup(user.id, g.id);
                                    commitChange();
                                  }}
                                  className="text-slate-400 hover:text-red-600"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-100 space-y-1">
                        <span className="font-semibold text-slate-700 block">
                          Cadena de Grupos Efectiva (Transitiva):
                        </span>
                        <span className="font-mono text-slate-600 block">
                          {agdlp.effectiveGroups.length > 0
                            ? agdlp.effectiveGroups
                                .map((g: any) => `${g.name} [${g.scope}]`)
                                .join(' → ')
                            : 'Ninguno'}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-100 space-y-1">
                        <span className="font-semibold text-slate-700 block">
                          Permisos Efectivos AGDLP:
                        </span>
                        <span className="font-mono text-emerald-700 block">
                          {agdlp.effectivePermissions.length > 0
                            ? agdlp.effectivePermissions.join(' · ')
                            : 'Sin permisos de recursos'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 5. INSPECTOR DE GRUPO */}
            {selectedEntity.type === 'group' && env.groups[selectedEntity.id] && (() => {
              const group = env.groups[selectedEntity.id];
              const parentGroupsContainingThis = Object.values(env.groups).filter((g: any) =>
                g.memberGroupIds.includes(group.id)
              ) as any[];
              const totalMembersCount =
                group.memberUserIds.length + group.memberGroupIds.length;

              return (
                <div className="bg-white rounded border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-200 bg-slate-50/50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Grupo · {group.scope}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-semibold text-indigo-700">
                          {group.scope}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const gName = group.name;
                            env.deleteGroup(group.id);
                            commitChange();
                            setSelectedEntity({ type: 'ou', id: currentOU.id });
                            notifySuccess(`Grupo "${gName}" eliminado.`);
                          }}
                          className="text-slate-400 hover:text-red-600"
                          title="Eliminar grupo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <h2 className="text-base font-bold text-slate-900 mt-0.5">{group.name}</h2>
                  </div>

                  <div className="flex border-b border-slate-200 bg-slate-100/70 px-3 pt-2 gap-1">
                    <button
                      type="button"
                      onClick={() => setGroupInspectorTab('general')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-t border-t border-x ${
                        groupInspectorTab === 'general'
                          ? 'bg-white text-slate-900 border-slate-200 -mb-px'
                          : 'border-transparent text-slate-600'
                      }`}
                    >
                      General
                    </button>
                    <button
                      type="button"
                      onClick={() => setGroupInspectorTab('members')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-t border-t border-x ${
                        groupInspectorTab === 'members'
                          ? 'bg-white text-slate-900 border-slate-200 -mb-px'
                          : 'border-transparent text-slate-600'
                      }`}
                    >
                      Miembros ({totalMembersCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setGroupInspectorTab('memberOf')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-t border-t border-x ${
                        groupInspectorTab === 'memberOf'
                          ? 'bg-white text-slate-900 border-slate-200 -mb-px'
                          : 'border-transparent text-slate-600'
                      }`}
                    >
                      Miembro de ({parentGroupsContainingThis.length})
                    </button>
                  </div>

                  {groupInspectorTab === 'general' && (
                    <div className="p-4 space-y-3 text-xs">
                      <p className="text-slate-600">{group.description}</p>
                      <div className="pt-2 border-t border-slate-100 space-y-2">
                        <span className="font-semibold block">Permisos de Recurso (DL → P):</span>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newPermissionText}
                            onChange={(e) => setNewPermissionText(e.target.value)}
                            placeholder="Modify:\\SRV-FS01\Auditorias$"
                            className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!newPermissionText.trim()) return;
                              group.permissions.push(newPermissionText.trim());
                              setNewPermissionText('');
                              commitChange();
                            }}
                            className="px-2.5 py-1.5 bg-slate-100 rounded font-medium"
                          >
                            Añadir ACL
                          </button>
                        </div>
                        {group.permissions.length > 0 && (
                          <div className="space-y-1 pt-1">
                            {group.permissions.map((perm: string) => (
                              <div
                                key={perm}
                                className="flex items-center justify-between px-2.5 py-1 bg-slate-50 rounded border border-slate-100 font-mono"
                              >
                                <span>{perm}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    group.permissions = group.permissions.filter(
                                      (p: string) => p !== perm
                                    );
                                    commitChange();
                                  }}
                                  className="text-slate-400 hover:text-red-600"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {groupInspectorTab === 'members' && (
                    <div className="p-4 space-y-3 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">Miembros de {group.name}</span>
                        <button
                          type="button"
                          onClick={() => openObjectPicker('group-members', group.id)}
                          className="px-3 py-1.5 bg-indigo-600 text-white rounded font-medium"
                        >
                          + Añadir miembro...
                        </button>
                      </div>
                      <ul className="divide-y divide-slate-100 border border-slate-200 rounded">
                        {group.memberUserIds.map((uid: string) => (
                          <li key={uid} className="px-3 py-2 flex justify-between">
                            <span>{env.users[uid]?.displayName} (Usuario)</span>
                            <button
                              type="button"
                              onClick={() => {
                                env.removeUserFromGroup(uid, group.id);
                                commitChange();
                              }}
                              className="text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </li>
                        ))}
                        {group.memberGroupIds.map((gid: string) => (
                          <li key={gid} className="px-3 py-2 flex justify-between">
                            <span>
                              {env.groups[gid]?.name} ({env.groups[gid]?.scope})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                env.removeGroupFromGroup(gid, group.id);
                                commitChange();
                              }}
                              className="text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {groupInspectorTab === 'memberOf' && (
                    <div className="p-4 space-y-3 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">Miembro de (Grupos Padres)</span>
                        <button
                          type="button"
                          onClick={() => openObjectPicker('group-member-of', group.id)}
                          className="px-3 py-1.5 bg-indigo-600 text-white rounded font-medium"
                        >
                          + Añadir a grupo...
                        </button>
                      </div>
                      <ul className="divide-y divide-slate-100 border border-slate-200 rounded">
                        {parentGroupsContainingThis.map((pg: any) => (
                          <li key={pg.id} className="px-3 py-2 flex justify-between">
                            <span>
                              {pg.name} ({pg.scope})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                env.removeGroupFromGroup(group.id, pg.id);
                                commitChange();
                              }}
                              className="text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </aside>
      </div>

      {/* MODAL BUSCADOR DE OBJETOS AD */}
      {objectPicker && objectPicker.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-lg max-w-lg w-full overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="text-sm font-semibold">Seleccionar Usuarios o Grupos</h3>
              <button
                type="button"
                onClick={() => setObjectPicker(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex gap-2 text-xs">
              <input
                type="text"
                autoFocus
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Buscar objeto..."
                className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded"
              />
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 text-xs">
              {pickerCandidates.map((cand) => (
                <div
                  key={`${cand.candidateType}-${cand.id}`}
                  className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50"
                >
                  <div>
                    <span className="font-semibold text-slate-900">{cand.name}</span>
                    <span
                      className={`ml-2 font-mono ${
                        cand.isRecommendedAGDLP ? 'text-emerald-700' : 'text-amber-600'
                      }`}
                    >
                      · {cand.isRecommendedAGDLP ? 'Compatible AGDLP' : 'Rompe AGDLP'}
                    </span>
                    <p className="text-slate-500">{cand.subtitle}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      let ok = false;
                      if (objectPicker.mode === 'user-member-of') {
                        ok = executeAddMemberToGroup('user', objectPicker.targetId, cand.id);
                      } else if (objectPicker.mode === 'group-members') {
                        ok = executeAddMemberToGroup(
                          cand.candidateType,
                          cand.id,
                          objectPicker.targetId
                        );
                      } else if (objectPicker.mode === 'group-member-of') {
                        ok = executeAddMemberToGroup('group', objectPicker.targetId, cand.id);
                      }
                      if (ok) setObjectPicker(null);
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-sky-600 hover:text-white rounded font-medium"
                  >
                    Añadir
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODALES DE CREACIÓN */}
      {modalMode && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-lg max-w-md w-full overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {modalMode === 'new-ou' && `Nueva OU en ${currentOU.name}`}
                {modalMode === 'new-user' && `Nuevo Usuario en ${currentOU.name}`}
                {modalMode === 'new-group' && `Nuevo Grupo en ${currentOU.name}`}
                {modalMode === 'new-base-gpo' && 'Nueva GPO Base (Objetos de directiva de grupo)'}
                {modalMode === 'link-existing-gpo' && `Vincular GPO Existente a ${currentOU.name}`}
              </h3>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalMode === 'new-base-gpo' && (
              <form onSubmit={handleCreateBaseGPOSubmit} className="p-5 space-y-3.5 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Nombre de la GPO *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={gpoName}
                    onChange={(e) => setGpoName(e.target.value)}
                    placeholder="Ej: GPO_Seguridad_Finanzas"
                    className="w-full px-3 py-2 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    1. AppLocker
                  </label>
                  <select
                    value={gpoAppLocker}
                    onChange={(e) => setGpoAppLocker(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded bg-white"
                  >
                    {GPO_PRESET_OPTIONS.appLocker.map((o, i) => (
                      <option key={i} value={o.value || ''}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    2. Wallpaper (Fondo de pantalla)
                  </label>
                  <select
                    value={gpoWallpaper}
                    onChange={(e) => setGpoWallpaper(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded bg-white"
                  >
                    {GPO_PRESET_OPTIONS.wallpaper.map((o, i) => (
                      <option key={i} value={o.value || ''}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    3. Proxy Corporativo
                  </label>
                  <select
                    value={gpoProxy}
                    onChange={(e) => setGpoProxy(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded bg-white"
                  >
                    {GPO_PRESET_OPTIONS.proxy.map((o, i) => (
                      <option key={i} value={o.value || ''}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    4. Windows Update
                  </label>
                  <select
                    value={gpoWindowsUpdate}
                    onChange={(e) => setGpoWindowsUpdate(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded bg-white"
                  >
                    {GPO_PRESET_OPTIONS.windowsUpdate.map((o, i) => (
                      <option key={i} value={o.value || ''}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setModalMode(null)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded"
                  >
                    Crear GPO Base
                  </button>
                </div>
              </form>
            )}

            {modalMode === 'link-existing-gpo' && (
              <form onSubmit={handleLinkExistingGPOSubmit} className="p-5 space-y-4 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Seleccionar GPO de "Objetos de directiva de grupo"
                  </label>
                  <select
                    value={selectedExistingGpoId}
                    onChange={(e) => setSelectedExistingGpoId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                  >
                    {Object.values(env.gpos).map((gpo: any) => (
                      <option key={gpo.id} value={gpo.id}>
                        {gpo.name}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
                  <input
                    type="checkbox"
                    checked={gpoEnforcedOnLink}
                    onChange={(e) => setGpoEnforcedOnLink(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600"
                  />
                  <span>Forzar este vínculo (Enforced / No Override)</span>
                </label>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setModalMode(null)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded"
                  >
                    Vincular a {currentOU.name}
                  </button>
                </div>
              </form>
            )}

            {modalMode === 'new-ou' && (
              <form onSubmit={handleCreateOUSubmit} className="p-5 space-y-4 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Nombre de la OU *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={ouName}
                    onChange={(e) => setOuName(e.target.value)}
                    placeholder="Ej: Sucursal_Sur"
                    className="w-full px-3 py-2 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Descripción
                  </label>
                  <input
                    type="text"
                    value={ouDescription}
                    onChange={(e) => setOuDescription(e.target.value)}
                    placeholder="Ej: Usuarios y equipos de delegación sur"
                    className="w-full px-3 py-2 border border-slate-300 rounded"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ouBlockInheritance}
                    onChange={(e) => setOuBlockInheritance(e.target.checked)}
                  />
                  <span>Bloquear herencia (Block Inheritance)</span>
                </label>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-sky-600 text-white font-medium rounded"
                  >
                    Crear OU
                  </button>
                </div>
              </form>
            )}

            {modalMode === 'new-user' && (
              <form onSubmit={handleCreateUserSubmit} className="p-5 space-y-3.5 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Nombre completo (Display Name) *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={userDisplay}
                    onChange={(e) => setUserDisplay(e.target.value)}
                    placeholder="Ej: Laura Gómez"
                    className="w-full px-3 py-2 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    sAMAccountName (Inicio de sesión) *
                  </label>
                  <input
                    type="text"
                    required
                    value={userSam}
                    onChange={(e) => setUserSam(e.target.value)}
                    placeholder="Ej: lgomez"
                    className="w-full px-3 py-2 border border-slate-300 rounded font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Departamento
                    </label>
                    <input
                      type="text"
                      value={userDept}
                      onChange={(e) => setUserDept(e.target.value)}
                      placeholder="Ej: Finanzas"
                      className="w-full px-3 py-2 border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Cargo / Puesto
                    </label>
                    <input
                      type="text"
                      value={userTitle}
                      onChange={(e) => setUserTitle(e.target.value)}
                      placeholder="Ej: Analista Contable"
                      className="w-full px-3 py-2 border border-slate-300 rounded"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-sky-600 text-white font-medium rounded"
                  >
                    Crear Usuario
                  </button>
                </div>
              </form>
            )}

            {modalMode === 'new-group' && (
              <form onSubmit={handleCreateGroupSubmit} className="p-5 space-y-3.5 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Nombre del Grupo *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Ej: GG_Finanzas o DL_Share_Facturas_RW"
                    className="w-full px-3 py-2 border border-slate-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Ámbito de Grupo (Scope AGDLP)
                  </label>
                  <select
                    value={groupScope}
                    onChange={(e) => setGroupScope(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                  >
                    <option value={GroupScope.GLOBAL}>Global (G) — Agrupa Usuarios por Rol</option>
                    <option value={GroupScope.UNIVERSAL}>Universal (U) — Multi-Sede / Bosque</option>
                    <option value={GroupScope.DOMAIN_LOCAL}>Domain Local (DL) — Otorga Permisos ACL</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Permisos de Recurso (Opcional, separados por coma)
                  </label>
                  <input
                    type="text"
                    value={groupPermissionInput}
                    onChange={(e) => setGroupPermissionInput(e.target.value)}
                    placeholder="Ej: Modify:\\SRV-FS01\Auditorias$"
                    className="w-full px-3 py-2 border border-slate-300 rounded font-mono"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white font-medium rounded"
                  >
                    Crear Grupo
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* FOOTER CON LOGO Y ENLACE OFICIAL */}
      <footer className="px-6 py-2.5 bg-slate-900 text-slate-300 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <a
            href={AUTHOR_WEB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 hover:text-white transition-colors group"
          >
            <span className="inline-flex items-center justify-center p-0.5 rounded bg-white/95 shadow-2xs shrink-0">
              <img
                src={AUTHOR_LOGO_URL}
                alt="Un Fantasma en el Sistema"
                className="h-7 w-auto object-contain shrink-0"
              />
            </span>
            <span className="font-semibold text-white group-hover:text-sky-300 transition-colors">
              Un Fantasma en el Sistema
            </span>
            <span className="text-slate-500">—</span>
            <span className="text-sky-400 group-hover:underline inline-flex flex-wrap break-all items-center gap-1">
              https://www.unfantasmaenelsistema.com/
              <ExternalLink className="w-3 h-3 shrink-0" />
            </span>
          </a>
        </div>
        <div className="text-slate-400 text-[11px]">
          ADLab · Simulador Educativo de Active Directory, AGDLP y Directivas de Grupo (GPO / RSoP)
        </div>
      </footer>
    </div>
  );
}
