/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ADLab - Modelo de Datos y Motor de Estado en Vanilla JS (ES6)
 * Simulador educativo de Active Directory (dsa.msc), AGDLP, GPMC (gpmc.msc),
 * RSoP (rsop.msc), Generador PowerShell y Retos Autocorregibles.
 */

export const GroupScope = Object.freeze({
  GLOBAL: 'Global',
  DOMAIN_LOCAL: 'DomainLocal',
  UNIVERSAL: 'Universal',
});

export const GroupCategory = Object.freeze({
  SECURITY: 'Security',
  DISTRIBUTION: 'Distribution',
});

/**
 * Error especializado para violaciones técnicas de Active Directory o del modelo educativo AGDLP.
 */
export class AGDLPValidationError extends Error {
  constructor({
    code,
    title,
    message,
    expectedFlow = 'A (Account) → G (Global) → U (Universal) → DL (Domain Local) → P (Permission)',
    ruleType = 'AD_SCOPE_RULE',
  }) {
    super(message);
    this.name = 'AGDLPValidationError';
    this.code = code;
    this.title = title;
    this.expectedFlow = expectedFlow;
    this.ruleType = ruleType;
  }
}

/**
 * Generador de GUIDs simulados estilo Active Directory (objectGUID)
 */
function generateGUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Representa una Unidad Organizativa (OU) o el contenedor raíz del Dominio.
 * Soporta anidamiento jerárquico (parentId / childrenIds) y bloqueo de herencia GPO.
 */
export class OU {
  constructor({
    id = generateGUID(),
    name,
    description = '',
    parentId = null,
    childrenIds = [],
    blockInheritance = false,
    isDomainRoot = false,
    createdAt = new Date().toISOString(),
  }) {
    if (!name || typeof name !== 'string') {
      throw new Error('El nombre de la OU es obligatorio.');
    }
    this.id = id;
    this.name = name.trim();
    this.description = description;
    this.parentId = parentId; // ID de la OU padre (null si es la raíz del dominio)
    this.childrenIds = Array.isArray(childrenIds) ? [...new Set(childrenIds)] : [];
    this.blockInheritance = Boolean(blockInheritance); // Bloquear herencia de GPOs en esta OU
    this.isDomainRoot = Boolean(isDomainRoot);
    this.createdAt = createdAt;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      parentId: this.parentId,
      childrenIds: this.childrenIds,
      blockInheritance: this.blockInheritance,
      isDomainRoot: this.isDomainRoot,
      createdAt: this.createdAt,
    };
  }
}

/**
 * Representa un Usuario de Active Directory perteneciente a una OU.
 */
export class User {
  constructor({
    id = generateGUID(),
    samAccountName,
    displayName,
    ouId,
    enabled = true,
    passwordNeverExpires = false,
    mustChangePassword = false,
    department = '',
    title = '',
    createdAt = new Date().toISOString(),
  }) {
    if (!samAccountName || !ouId) {
      throw new Error('El usuario requiere samAccountName y ouId.');
    }
    this.id = id;
    this.samAccountName = samAccountName.trim();
    this.displayName = (displayName || samAccountName).trim();
    this.ouId = ouId;
    this.enabled = Boolean(enabled);
    this.passwordNeverExpires = Boolean(passwordNeverExpires);
    this.mustChangePassword = Boolean(mustChangePassword);
    this.department = department;
    this.title = title;
    this.createdAt = createdAt;
  }

  toJSON() {
    return {
      id: this.id,
      samAccountName: this.samAccountName,
      displayName: this.displayName,
      ouId: this.ouId,
      enabled: this.enabled,
      passwordNeverExpires: this.passwordNeverExpires,
      mustChangePassword: this.mustChangePassword,
      department: this.department,
      title: this.title,
      createdAt: this.createdAt,
    };
  }
}

/**
 * Representa un Grupo de Active Directory.
 * Soporta ámbitos Global, DomainLocal y Universal para simular el modelo AGDLP / AUGDLP.
 */
export class Group {
  constructor({
    id = generateGUID(),
    name,
    description = '',
    ouId,
    scope = GroupScope.GLOBAL,
    category = GroupCategory.SECURITY,
    memberUserIds = [],
    memberGroupIds = [],
    permissions = [], // Permisos sobre recursos (ej. en grupos Domain Local: ["Read:\\\\SRV-FILE\\Ventas"])
    createdAt = new Date().toISOString(),
  }) {
    if (!name || !ouId) {
      throw new Error('El grupo requiere nombre y ouId.');
    }
    if (!Object.values(GroupScope).includes(scope)) {
      throw new Error(`Ámbito de grupo inválido: ${scope}. Usa Global, DomainLocal o Universal.`);
    }
    this.id = id;
    this.name = name.trim();
    this.description = description;
    this.ouId = ouId;
    this.scope = scope;
    this.category = category;
    this.memberUserIds = Array.isArray(memberUserIds) ? [...new Set(memberUserIds)] : [];
    this.memberGroupIds = Array.isArray(memberGroupIds) ? [...new Set(memberGroupIds)] : [];
    this.permissions = Array.isArray(permissions) ? [...new Set(permissions)] : [];
    this.createdAt = createdAt;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      ouId: this.ouId,
      scope: this.scope,
      category: this.category,
      memberUserIds: this.memberUserIds,
      memberGroupIds: this.memberGroupIds,
      permissions: this.permissions,
      createdAt: this.createdAt,
    };
  }
}

/**
 * Opciones predefinidas de configuración de GPO para el simulador GPMC
 */
export const GPO_PRESET_OPTIONS = Object.freeze({
  appLocker: [
    { value: null, label: 'No configurado' },
    { value: 'AuditOnly: Permitir todo y auditar en Visor de Eventos', label: 'Modo Auditoría (Solo registrar eventos)' },
    { value: 'Enforce: Bloquear ejecutables fuera de C:\\Program Files', label: 'Bloquear ejecutables fuera de Program Files' },
    { value: 'Strict: Bloquear scripts (.ps1, .bat) y ejecutables de usuario', label: 'Restricción Estricta (Ejecutables + Scripts PS1/BAT)' },
  ],
  wallpaper: [
    { value: null, label: 'No configurado' },
    { value: '\\\\adlab.local\\SYSVOL\\corp\\wallpaper_2026.jpg', label: 'Tapiz Corporativo General (wallpaper_2026.jpg)' },
    { value: '\\\\adlab.local\\SYSVOL\\ventas\\bg_comercial.jpg', label: 'Tapiz Departamento Ventas (bg_comercial.jpg)' },
    { value: '\\\\adlab.local\\SYSVOL\\sec\\aviso_seguridad.jpg', label: 'Tapiz Aviso de Seguridad TI (aviso_seguridad.jpg)' },
  ],
  proxy: [
    { value: null, label: 'No configurado' },
    { value: 'http://proxy.adlab.local:8080 (Bypass *.adlab.local)', label: 'Proxy Corporativo Estándar (proxy.adlab.local:8080)' },
    { value: 'http://proxy-dlp.adlab.local:3128 (Inspección SSL Estricta)', label: 'Proxy DLP Alta Seguridad (proxy-dlp.adlab.local:3128)' },
    { value: 'DirectAccess: Sin Proxy (Salida directa por Firewall)', label: 'Salida Directa (Sin Proxy)' },
  ],
  windowsUpdate: [
    { value: null, label: 'No configurado' },
    { value: 'WSUS Interno (http://wsus.adlab.local:8530) - Domingo 03:00', label: 'Servidor WSUS Interno (Domingo 03:00 AM)' },
    { value: 'Windows Update for Business - Anillo Diferido 14 días', label: 'Anillo Diferido (14 días tras Patch Tuesday)' },
    { value: 'Instalación Automática Inmediata + Reinicio Forzado 22:00', label: 'Crítico: Instalación Inmediata + Reinicio 22:00' },
  ],
});

/**
 * Catálogo de Retos Guiados / Exámenes Autocorregibles para clase
 */
export const LAB_CHALLENGES = Object.freeze([
  {
    id: 'challenge-gpo-inheritance',
    title: 'Reto 1: Resolución de Herencia GPO y Despliegue de Software',
    difficulty: 'Intermedio',
    scenarioDescription:
      'El departamento de Ventas no está recibiendo el paquete MSI "ERP_Cliente_2026.msi" desplegado desde la OU Corporativo, y además la directiva "GPO_Seguridad_Critica_CISO" vinculada en la raíz del dominio no se está imponiendo sobre las OUs con bloqueo.',
    objectives: [
      'Lograr que la usuaria Ana García (Ventas) reciba el paquete "ERP_Cliente_2026.msi" en su RSoP.',
      'Forzar (Enforced) el vínculo de "GPO_Seguridad_Critica_CISO" en la raíz del dominio para que su AppLocker estricto prevalezca en todas las OUs.',
      'Mantener el tapiz comercial ("bg_comercial.jpg") activo para los usuarios de Ventas.',
    ],
  },
  {
    id: 'challenge-agdlp-nesting',
    title: 'Reto 2: Implementación Completa de Permisos AGDLP',
    difficulty: 'Avanzado',
    scenarioDescription:
      'El usuario Carlos Martínez (Ventas) necesita obtener el permiso efectivo "Modify:\\\\SRV-FS01\\Auditorias$" siguiendo estrictamente el flujo de buenas prácticas de Microsoft AGDLP (Cuenta → Global → Universal → Domain Local → Permiso).',
    objectives: [
      'Crear o utilizar un grupo Domain Local con el permiso "Modify:\\\\SRV-FS01\\Auditorias$".',
      'Encadenar correctamente Cuenta (Carlos Martínez) → Grupo Global → Grupo Universal → Grupo Domain Local.',
      'No incurrir en ninguna asignación directa de usuario a grupo Domain Local o Universal.',
    ],
  },
  {
    id: 'challenge-security-filtering',
    title: 'Reto 3: Precedencia de Orden de Vínculo y Endurecimiento',
    difficulty: 'Intermedio',
    scenarioDescription:
      'En la OU Sistemas existen varias GPOs y la ingeniera Elena Rodríguez necesita tener bloqueado el Editor de Registro (regedit) y el Símbolo del sistema (cmd.exe), además de recibir el Anillo Diferido de Windows Update con prioridad #1.',
    objectives: [
      'Vincular "GPO_WindowsUpdate_Diferido" en la OU Sistemas y situarla en el Orden #1 de precedencia.',
      'Asegurar que Elena Rodríguez tenga "disableCmd" y "disableRegistryTools" activos en su RSoP final.',
    ],
  },
]);

/**
 * Representa un Objeto de Directiva de Grupo (GPO) almacenado en el contenedor central
 * "Objetos de directiva de grupo" (Group Policy Objects) del dominio.
 */
export class GPO {
  constructor({
    id = generateGUID(),
    name,
    description = '',
    gpoStatus = 'Enabled', // 'Enabled' | 'UserDisabled' | 'ComputerDisabled' | 'AllDisabled'
    settings = {},
    securityFiltering = ['Authenticated Users'], // Grupos/Usuarios a los que aplica la GPO
    createdAt = new Date().toISOString(),
    updatedAt = new Date().toISOString(),
  }) {
    if (!name || typeof name !== 'string') {
      throw new Error('El nombre de la GPO es obligatorio.');
    }
    this.id = id;
    this.name = name.trim();
    this.description = description;
    this.gpoStatus = gpoStatus;

    // Configuraciones simuladas GPMC (AppLocker, Wallpaper, Proxy, Windows Update + restricciones clásicas)
    this.settings = {
      appLocker: settings.appLocker ?? null,
      wallpaper: settings.wallpaper ?? null,
      proxy: settings.proxy ?? null,
      windowsUpdate: settings.windowsUpdate ?? null,
      disableControlPanel: Boolean(settings.disableControlPanel ?? false),
      disableCmd: Boolean(settings.disableCmd ?? false),
      disableRegistryTools: Boolean(settings.disableRegistryTools ?? false),
      deploySoftware: Array.isArray(settings.deploySoftware) ? [...settings.deploySoftware] : [],
      driveMaps: Array.isArray(settings.driveMaps) ? [...settings.driveMaps] : [],
      passwordMinLength: settings.passwordMinLength ?? null,
      ...settings,
    };

    this.securityFiltering = Array.isArray(securityFiltering) && securityFiltering.length > 0
      ? [...new Set(securityFiltering)]
      : ['Authenticated Users'];
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  updateSettings(partialSettings) {
    this.settings = {
      ...this.settings,
      ...partialSettings,
    };
    this.updatedAt = new Date().toISOString();
    return this.settings;
  }

  setSecurityFiltering(targets) {
    this.securityFiltering = Array.isArray(targets) && targets.length > 0
      ? [...new Set(targets)]
      : ['Authenticated Users'];
    this.updatedAt = new Date().toISOString();
    return this.securityFiltering;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      gpoStatus: this.gpoStatus,
      settings: this.settings,
      securityFiltering: this.securityFiltering,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

/**
 * Representa el vínculo (Link) entre una GPO y una OU (o raíz de Dominio).
 */
export class GPOLink {
  constructor({
    id = generateGUID(),
    gpoId,
    ouId,
    enforced = false,
    linkEnabled = true,
    blockInheritance = false,
    linkOrder = 1, // Precedencia: 1 tiene mayor prioridad que 2 dentro de la misma OU
    createdAt = new Date().toISOString(),
  }) {
    if (!gpoId || !ouId) {
      throw new Error('GPOLink requiere gpoId y ouId.');
    }
    this.id = id;
    this.gpoId = gpoId;
    this.ouId = ouId;
    this.enforced = Boolean(enforced); // No Override / Forzado
    this.linkEnabled = Boolean(linkEnabled);
    this.blockInheritance = Boolean(blockInheritance); // Reflejo de bloqueo de herencia en la OU vinculada
    this.linkOrder = Number(linkOrder) || 1;
    this.createdAt = createdAt;
  }

  toJSON() {
    return {
      id: this.id,
      gpoId: this.gpoId,
      ouId: this.ouId,
      enforced: this.enforced,
      linkEnabled: this.linkEnabled,
      blockInheritance: this.blockInheritance,
      linkOrder: this.linkOrder,
      createdAt: this.createdAt,
    };
  }
}

/**
 * Clase principal que gestiona el estado global del laboratorio Active Directory.
 * Compatible con serialización completa en localStorage y exportación JSON.
 */
export class ADEnvironment {
  static STORAGE_KEY = 'adlab_environment_state_v1';

  constructor({
    domainName = 'adlab.local',
    netbiosName = 'ADLAB',
    ous = {},
    users = {},
    groups = {},
    gpos = {},
    gpoLinks = {},
    rootOuId = null,
  } = {}) {
    this.domainName = domainName;
    this.netbiosName = netbiosName;

    // Diccionarios indexados por ID para acceso O(1) y serialización limpia en JSON
    this.ous = {};
    this.users = {};
    this.groups = {};
    this.gpos = {};
    this.gpoLinks = {};
    this.rootOuId = rootOuId;

    this._hydrateEntities({ ous, users, groups, gpos, gpoLinks });

    // Si no existe nodo raíz de dominio, inicializamos la estructura base de AD
    if (!this.rootOuId || !this.ous[this.rootOuId]) {
      this._initializeDefaultDomainStructure();
    }
  }

  /**
   * Hidrata instancias de clases ES6 a partir de objetos planos (ej. cargados de localStorage)
   */
  _hydrateEntities({ ous, users, groups, gpos, gpoLinks }) {
    Object.values(ous || {}).forEach((ouData) => {
      const ou = ouData instanceof OU ? ouData : new OU(ouData);
      this.ous[ou.id] = ou;
    });

    Object.values(users || {}).forEach((userData) => {
      const user = userData instanceof User ? userData : new User(userData);
      this.users[user.id] = user;
    });

    Object.values(groups || {}).forEach((groupData) => {
      const group = groupData instanceof Group ? groupData : new Group(groupData);
      this.groups[group.id] = group;
    });

    Object.values(gpos || {}).forEach((gpoData) => {
      const gpo = gpoData instanceof GPO ? gpoData : new GPO(gpoData);
      this.gpos[gpo.id] = gpo;
    });

    Object.values(gpoLinks || {}).forEach((linkData) => {
      const link = linkData instanceof GPOLink ? linkData : new GPOLink(linkData);
      this.gpoLinks[link.id] = link;
    });
  }

  /**
   * Crea el nodo raíz del dominio y la Default Domain Policy inicial
   */
  _initializeDefaultDomainStructure() {
    const domainRoot = new OU({
      name: this.domainName,
      description: `Raíz del dominio ${this.domainName}`,
      parentId: null,
      isDomainRoot: true,
    });
    this.ous[domainRoot.id] = domainRoot;
    this.rootOuId = domainRoot.id;

    // Crear Default Domain Policy como en un Windows Server real
    const defaultDomainPolicy = this.createGPO({
      name: 'Default Domain Policy',
      description: 'Directiva predeterminada vinculada al nivel raíz del dominio.',
      settings: {
        passwordMinLength: 8,
        disableControlPanel: false,
      },
    });

    this.linkGPOToOU(defaultDomainPolicy.id, domainRoot.id, {
      enforced: false,
      blockInheritance: false,
    });
  }

  // =========================================================================
  // GESTIÓN DE UNIDADES ORGANIZATIVAS (OUs)
  // =========================================================================

  /**
   * Crea una nueva OU (anidada dentro de parentId, o bajo la raíz del dominio por defecto)
   */
  createOU({ name, description = '', parentId = this.rootOuId, blockInheritance = false }) {
    const targetParentId = parentId || this.rootOuId;
    const parentOU = this.ous[targetParentId];

    if (!parentOU) {
      throw new Error(`La OU padre con ID "${targetParentId}" no existe.`);
    }

    // Validar que no exista una OU hermana con el mismo nombre
    const duplicate = parentOU.childrenIds
      .map((childId) => this.ous[childId])
      .find((sibling) => sibling && sibling.name.toLowerCase() === name.trim().toLowerCase());

    if (duplicate) {
      throw new Error(`Ya existe una sub-OU llamada "${name}" dentro de "${parentOU.name}".`);
    }

    const newOU = new OU({
      name,
      description,
      parentId: parentOU.id,
      blockInheritance,
      isDomainRoot: false,
    });

    this.ous[newOU.id] = newOU;
    parentOU.childrenIds.push(newOU.id);

    return newOU;
  }

  /**
   * Elimina una OU siempre que no sea la raíz del dominio y no tenga sub-OUs
   */
  deleteOU(ouId) {
    const ou = this.ous[ouId];
    if (!ou) throw new Error('OU no encontrada.');
    if (ou.isDomainRoot) {
      throw new Error('No se puede eliminar el contenedor raíz del dominio Active Directory.');
    }
    if (ou.childrenIds && ou.childrenIds.length > 0) {
      throw new Error(`La OU "${ou.name}" contiene sub-OUs anidadas. Elimina o vacía primero las sub-OUs.`);
    }

    const hasUsers = Object.values(this.users).some((u) => u.ouId === ouId);
    const hasGroups = Object.values(this.groups).some((g) => g.ouId === ouId);
    if (hasUsers || hasGroups) {
      throw new Error(
        `La OU "${ou.name}" está protegida contra eliminación accidental porque aún contiene usuarios o grupos.`
      );
    }

    if (ou.parentId && this.ous[ou.parentId]) {
      this.ous[ou.parentId].childrenIds = this.ous[ou.parentId].childrenIds.filter(
        (id) => id !== ouId
      );
    }

    Object.entries(this.gpoLinks).forEach(([linkId, link]) => {
      if (link.ouId === ouId) delete this.gpoLinks[linkId];
    });

    delete this.ous[ouId];
    return true;
  }

  /**
   * Activa o desactiva el bloqueo de herencia (Block Inheritance) en una OU
   * y sincroniza la propiedad en sus GPOLinks asociados.
   */
  setOUBlockInheritance(ouId, blockInheritance) {
    const ou = this.ous[ouId];
    if (!ou) {
      throw new Error(`OU con ID "${ouId}" no encontrada.`);
    }
    ou.blockInheritance = Boolean(blockInheritance);

    Object.values(this.gpoLinks)
      .filter((link) => link.ouId === ouId)
      .forEach((link) => {
        link.blockInheritance = ou.blockInheritance;
      });

    return ou;
  }

  /**
   * Devuelve la cadena jerárquica de OUs desde la raíz del dominio hasta la OU indicada.
   * Ejemplo: [DomainRoot, OU_Madrid, OU_Ventas]
   */
  getOUHierarchyPath(ouId) {
    const path = [];
    let current = this.ous[ouId];
    const visited = new Set();

    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      path.unshift(current);
      current = current.parentId ? this.ous[current.parentId] : null;
    }
    return path;
  }

  /**
   * Genera el Distinguished Name (DN) de un objeto ubicado en una OU
   * Ejemplo: "CN=Juan Perez,OU=Ventas,OU=Madrid,DC=adlab,DC=local"
   */
  getDistinguishedName(commonName, ouId) {
    const path = this.getOUHierarchyPath(ouId);
    const ouParts = path
      .filter((ou) => !ou.isDomainRoot)
      .reverse()
      .map((ou) => `OU=${ou.name}`);

    const dcParts = this.domainName.split('.').map((part) => `DC=${part}`);
    const prefix = commonName ? [`CN=${commonName}`] : [];

    return [...prefix, ...ouParts, ...dcParts].join(',');
  }

  // =========================================================================
  // GESTIÓN DE USUARIOS
  // =========================================================================

  createUser({
    samAccountName,
    displayName,
    ouId = this.rootOuId,
    enabled = true,
    department = '',
    title = '',
  }) {
    if (!this.ous[ouId]) {
      throw new Error(`La OU destino "${ouId}" no existe.`);
    }

    const normalizedSam = samAccountName.trim().toLowerCase();
    const exists = Object.values(this.users).some(
      (u) => u.samAccountName.toLowerCase() === normalizedSam
    );

    if (exists) {
      throw new Error(`El sAMAccountName "${samAccountName}" ya existe en el dominio.`);
    }

    const user = new User({
      samAccountName,
      displayName,
      ouId,
      enabled,
      department,
      title,
    });

    this.users[user.id] = user;
    return user;
  }

  moveUserToOU(userId, targetOuId) {
    const user = this.users[userId];
    if (!user) throw new Error(`Usuario "${userId}" no encontrado.`);
    if (!this.ous[targetOuId]) throw new Error(`OU destino "${targetOuId}" no encontrada.`);

    user.ouId = targetOuId;
    return user;
  }

  deleteUser(userId) {
    if (!this.users[userId]) return false;
    Object.values(this.groups).forEach((group) => {
      group.memberUserIds = group.memberUserIds.filter((id) => id !== userId);
    });
    delete this.users[userId];
    return true;
  }

  // =========================================================================
  // GESTIÓN DE GRUPOS Y MODELO AGDLP
  // =========================================================================

  createGroup({
    name,
    description = '',
    ouId = this.rootOuId,
    scope = GroupScope.GLOBAL,
    category = GroupCategory.SECURITY,
    permissions = [],
  }) {
    if (!this.ous[ouId]) {
      throw new Error(`La OU destino "${ouId}" no existe.`);
    }

    const normalizedName = name.trim().toLowerCase();
    const exists = Object.values(this.groups).some(
      (g) => g.name.toLowerCase() === normalizedName
    );

    if (exists) {
      throw new Error(`Ya existe un grupo llamado "${name}" en el dominio.`);
    }

    const group = new Group({
      name,
      description,
      ouId,
      scope,
      category,
      permissions,
    });

    this.groups[group.id] = group;
    return group;
  }

  deleteGroup(groupId) {
    if (!this.groups[groupId]) return false;
    Object.values(this.groups).forEach((g) => {
      g.memberGroupIds = g.memberGroupIds.filter((id) => id !== groupId);
    });
    delete this.groups[groupId];
    return true;
  }

  /**
   * Valida y añade un usuario a un grupo (Paso A -> G en AGDLP).
   */
  addUserToGroup(userId, groupId, { strictAGDLP = true } = {}) {
    const user = this.users[userId];
    const group = this.groups[groupId];

    if (!user) throw new Error(`El usuario con ID "${userId}" no existe.`);
    if (!group) throw new Error(`El grupo con ID "${groupId}" no existe.`);

    this.validateUserToGroupAGDLP(user, group, { strictAGDLP });

    if (!group.memberUserIds.includes(userId)) {
      group.memberUserIds.push(userId);
    }
    return group;
  }

  /**
   * Valida si un usuario puede añadirse a un grupo según el modelo AGDLP
   */
  validateUserToGroupAGDLP(user, group, { strictAGDLP = true } = {}) {
    if (strictAGDLP && group.scope === GroupScope.DOMAIN_LOCAL) {
      throw new AGDLPValidationError({
        code: 'AGDLP_ACCOUNT_TO_DL',
        title: 'Violación de Buenas Prácticas AGDLP (Cuenta directa en Domain Local)',
        ruleType: 'AGDLP_BEST_PRACTICE',
        message:
          `Has intentado meter al usuario "${user.displayName}" (${user.samAccountName}) directamente dentro del grupo Domain Local "${group.name}". ` +
          `Aunque Windows Server lo permite a nivel técnico, rompe el modelo AGDLP: las cuentas de usuario (A) deben agruparse primero por rol/departamento en un Grupo Global (G), y ese Grupo Global es el que se anida dentro del grupo Domain Local (DL) que posee los permisos.`,
      });
    }

    if (strictAGDLP && group.scope === GroupScope.UNIVERSAL) {
      throw new AGDLPValidationError({
        code: 'AGDLP_ACCOUNT_TO_UNIVERSAL',
        title: 'Violación de Buenas Prácticas AUGDLP (Cuenta directa en Grupo Universal)',
        ruleType: 'AGDLP_BEST_PRACTICE',
        message:
          `Has intentado añadir al usuario "${user.displayName}" directamente al grupo Universal "${group.name}". ` +
          `En entornos Active Directory empresariales, añadir usuarios individuales a grupos Universales provoca tráfico excesivo de replicación en el Catálogo Global (Global Catalog) cada vez que cambia un miembro. Debes meter al usuario en un Grupo Global (G) y anidar ese Grupo Global dentro del Grupo Universal (U).`,
      });
    }

    return true;
  }

  removeUserFromGroup(userId, groupId) {
    const group = this.groups[groupId];
    if (!group) throw new Error(`El grupo con ID "${groupId}" no existe.`);

    group.memberUserIds = group.memberUserIds.filter((id) => id !== userId);
    return group;
  }

  /**
   * Anida un grupo dentro de otro grupo validando las reglas técnicas de Active Directory
   * y las reglas pedagógicas del modelo AGDLP / AUGDLP.
   */
  addGroupToGroup(childGroupId, parentGroupId, { strictAGDLP = true } = {}) {
    if (childGroupId === parentGroupId) {
      throw new AGDLPValidationError({
        code: 'AD_SELF_NESTING',
        title: 'Auto-anidamiento no permitido',
        ruleType: 'CIRCULAR_NESTING',
        message: 'Un grupo de Active Directory no puede ser miembro de sí mismo.',
      });
    }

    const childGroup = this.groups[childGroupId];
    const parentGroup = this.groups[parentGroupId];

    if (!childGroup) throw new Error(`Grupo hijo "${childGroupId}" no encontrado.`);
    if (!parentGroup) throw new Error(`Grupo padre "${parentGroupId}" no encontrado.`);

    // Prevención de referencias circulares
    if (this._isGroupMemberOf(parentGroupId, childGroupId)) {
      throw new AGDLPValidationError({
        code: 'AD_CIRCULAR_NESTING',
        title: 'Bucle de Anidamiento Circular Detectado',
        ruleType: 'CIRCULAR_NESTING',
        message:
          `No se puede añadir "${childGroup.name}" dentro de "${parentGroup.name}" porque "${parentGroup.name}" ya es miembro (directo o transitivo) de "${childGroup.name}". ` +
          `Esto generaría un ciclo infinito durante la construcción del token de acceso Kerberos/LSA del usuario.`,
      });
    }

    // Validación de reglas de ámbito de Active Directory y AGDLP
    this._validateGroupNestingScope(childGroup, parentGroup, { strictAGDLP });

    if (!parentGroup.memberGroupIds.includes(childGroupId)) {
      parentGroup.memberGroupIds.push(childGroupId);
    }

    return parentGroup;
  }

  removeGroupFromGroup(childGroupId, parentGroupId) {
    const parentGroup = this.groups[parentGroupId];
    if (!parentGroup) throw new Error(`Grupo padre "${parentGroupId}" no encontrado.`);

    parentGroup.memberGroupIds = parentGroup.memberGroupIds.filter(
      (id) => id !== childGroupId
    );
    return parentGroup;
  }

  _validateGroupNestingScope(childGroup, parentGroup, { strictAGDLP = true } = {}) {
    // 1. Reglas duras de arquitectura Windows Server Active Directory
    if (parentGroup.scope === GroupScope.GLOBAL) {
      if (childGroup.scope === GroupScope.DOMAIN_LOCAL) {
        throw new AGDLPValidationError({
          code: 'AD_DL_INTO_GLOBAL',
          title: 'Error de Arquitectura AD: Domain Local dentro de Global',
          ruleType: 'AD_SCOPE_RULE',
          message:
            `Operación prohibida en Active Directory: Intentas meter el grupo Domain Local "${childGroup.name}" dentro del grupo Global "${parentGroup.name}". ` +
            `En el modelo AGDLP (A → G → DL → P), el flujo va desde Global hacia Domain Local, nunca al revés. Además, un grupo Global puede otorgar acceso en otros dominios del bosque, mientras que un grupo Domain Local solo es válido en su propio dominio.`,
        });
      }
      if (childGroup.scope === GroupScope.UNIVERSAL) {
        throw new AGDLPValidationError({
          code: 'AD_UNIVERSAL_INTO_GLOBAL',
          title: 'Error de Arquitectura AD: Universal dentro de Global',
          ruleType: 'AD_SCOPE_RULE',
          message:
            `Operación prohibida en Active Directory: Intentas meter el grupo Universal "${childGroup.name}" dentro del grupo Global "${parentGroup.name}". ` +
            `Un grupo Universal puede contener objetos de cualquier dominio del bosque, por lo que no puede encapsularse dentro de un grupo Global cuyo ámbito de miembros está restringido a un solo dominio. El orden correcto es Global → Universal → Domain Local.`,
        });
      }
    }

    if (parentGroup.scope === GroupScope.UNIVERSAL) {
      if (childGroup.scope === GroupScope.DOMAIN_LOCAL) {
        throw new AGDLPValidationError({
          code: 'AD_DL_INTO_UNIVERSAL',
          title: 'Error de Arquitectura AD: Domain Local dentro de Universal',
          ruleType: 'AD_SCOPE_RULE',
          message:
            `Operación prohibida en Active Directory: Intentas anidar el grupo Domain Local "${childGroup.name}" dentro del grupo Universal "${parentGroup.name}". ` +
            `Los grupos Universales se replican en el Catálogo Global de todo el bosque, por lo que jamás pueden contener grupos Domain Local (que solo tienen validez en el dominio local donde fueron creados).`,
        });
      }
    }

    // 2. Regla educativa adicional en modo estricto AGDLP
    if (
      strictAGDLP &&
      parentGroup.scope === GroupScope.DOMAIN_LOCAL &&
      childGroup.scope === GroupScope.DOMAIN_LOCAL
    ) {
      throw new AGDLPValidationError({
        code: 'AGDLP_DL_INTO_DL',
        title: 'Advertencia de Diseño AGDLP: Domain Local dentro de Domain Local',
        ruleType: 'AGDLP_BEST_PRACTICE',
        message:
          `Aunque Windows Server permite técnicamente anidar un grupo Domain Local ("${childGroup.name}") dentro de otro Domain Local ("${parentGroup.name}"), en el modelo AGDLP puro se desaconseja porque dificulta auditar qué roles organizativos tienen acceso a cada recurso. ` +
          `Asigna un único grupo Domain Local por permiso de recurso (ej. Lectura o Modificación) y nutre ese grupo con Grupos Globales o Universales.`,
      });
    }
  }

  /**
   * Verifica recursivamente si sourceGroupId pertenece a targetGroupId
   */
  _isGroupMemberOf(sourceGroupId, targetGroupId, visited = new Set()) {
    if (visited.has(targetGroupId)) return false;
    visited.add(targetGroupId);

    const targetGroup = this.groups[targetGroupId];
    if (!targetGroup) return false;

    if (targetGroup.memberGroupIds.includes(sourceGroupId)) {
      return true;
    }

    return targetGroup.memberGroupIds.some((nestedGroupId) =>
      this._isGroupMemberOf(sourceGroupId, nestedGroupId, visited)
    );
  }

  /**
   * Obtiene todos los grupos (directos y anidados vía AGDLP) a los que pertenece un usuario,
   * así como los permisos efectivos acumulados.
   */
  getUserEffectiveGroupsAndPermissions(userId) {
    const user = this.users[userId];
    if (!user) throw new Error(`Usuario "${userId}" no encontrado.`);

    const allGroups = Object.values(this.groups);
    const directGroups = allGroups.filter((g) => g.memberUserIds.includes(userId));

    const effectiveGroupMap = new Map();
    const queue = [...directGroups];

    while (queue.length > 0) {
      const currentGroup = queue.shift();
      if (!effectiveGroupMap.has(currentGroup.id)) {
        effectiveGroupMap.set(currentGroup.id, currentGroup);

        // Buscar grupos padres que contengan a currentGroup
        const parentGroups = allGroups.filter((g) =>
          g.memberGroupIds.includes(currentGroup.id)
        );
        queue.push(...parentGroups);
      }
    }

    const effectiveGroups = Array.from(effectiveGroupMap.values());
    const effectivePermissions = [
      ...new Set(effectiveGroups.flatMap((g) => g.permissions || [])),
    ];

    return {
      directGroups,
      effectiveGroups,
      effectivePermissions,
    };
  }

  // =========================================================================
  // GESTIÓN DE GPOs Y VÍNCULOS (GPOLinks)
  // =========================================================================

  createGPO({ name, description = '', settings = {}, securityFiltering = ['Authenticated Users'] }) {
    const normalizedName = name.trim().toLowerCase();
    const exists = Object.values(this.gpos).some(
      (gpo) => gpo.name.toLowerCase() === normalizedName
    );

    if (exists) {
      throw new Error(`Ya existe una GPO llamada "${name}".`);
    }

    const gpo = new GPO({
      name,
      description,
      settings,
      securityFiltering,
    });

    this.gpos[gpo.id] = gpo;
    return gpo;
  }

  /**
   * Vincula una GPO a una OU o al Dominio raíz.
   * Si ya existe el vínculo en esa OU, actualiza sus banderas.
   */
  linkGPOToOU(
    gpoId,
    ouId,
    { enforced = false, blockInheritance = null, linkEnabled = true, linkOrder = null } = {}
  ) {
    const gpo = this.gpos[gpoId];
    const ou = this.ous[ouId];

    if (!gpo) throw new Error(`La GPO con ID "${gpoId}" no existe.`);
    if (!ou) throw new Error(`La OU con ID "${ouId}" no existe.`);

    if (typeof blockInheritance === 'boolean') {
      ou.blockInheritance = blockInheritance;
    }

    const existingLinksInOU = Object.values(this.gpoLinks).filter(
      (link) => link.ouId === ouId
    );

    const existingLink = existingLinksInOU.find((link) => link.gpoId === gpoId);
    if (existingLink) {
      existingLink.enforced = Boolean(enforced);
      existingLink.linkEnabled = Boolean(linkEnabled);
      existingLink.blockInheritance = ou.blockInheritance;
      if (linkOrder !== null) existingLink.linkOrder = Number(linkOrder);
      return existingLink;
    }

    const nextOrder =
      linkOrder !== null ? Number(linkOrder) : existingLinksInOU.length + 1;

    const newLink = new GPOLink({
      gpoId,
      ouId,
      enforced,
      linkEnabled,
      blockInheritance: ou.blockInheritance,
      linkOrder: nextOrder,
    });

    this.gpoLinks[newLink.id] = newLink;
    this._normalizeLinkOrdersInOU(ouId);
    return newLink;
  }

  _normalizeLinkOrdersInOU(ouId) {
    const links = Object.values(this.gpoLinks)
      .filter((l) => l.ouId === ouId)
      .sort((a, b) => a.linkOrder - b.linkOrder);
    links.forEach((l, index) => {
      l.linkOrder = index + 1;
    });
  }

  /**
   * Cambia el orden de precedencia (linkOrder) de un vínculo GPO dentro de su OU.
   * direction: 'up' (mayor prioridad, ej. de #2 a #1) | 'down' (menor prioridad, ej. de #1 a #2)
   */
  moveGPOLinkOrder(linkId, direction) {
    const targetLink = this.gpoLinks[linkId];
    if (!targetLink) throw new Error('Vínculo GPO no encontrado.');

    const linksInOU = Object.values(this.gpoLinks)
      .filter((l) => l.ouId === targetLink.ouId)
      .sort((a, b) => a.linkOrder - b.linkOrder);

    const idx = linksInOU.findIndex((l) => l.id === linkId);
    if (idx === -1) return targetLink;

    if (direction === 'up' && idx > 0) {
      const prev = linksInOU[idx - 1];
      const temp = targetLink.linkOrder;
      targetLink.linkOrder = prev.linkOrder;
      prev.linkOrder = temp;
    } else if (direction === 'down' && idx < linksInOU.length - 1) {
      const next = linksInOU[idx + 1];
      const temp = targetLink.linkOrder;
      targetLink.linkOrder = next.linkOrder;
      next.linkOrder = temp;
    }

    this._normalizeLinkOrdersInOU(targetLink.ouId);
    return targetLink;
  }

  unlinkGPOFromOU(gpoId, ouId) {
    const linkEntry = Object.entries(this.gpoLinks).find(
      ([, link]) => link.gpoId === gpoId && link.ouId === ouId
    );
    if (!linkEntry) return false;

    const [linkId] = linkEntry;
    delete this.gpoLinks[linkId];
    this._normalizeLinkOrdersInOU(ouId);
    return true;
  }

  /**
   * Activa o desactiva la bandera "Forzar" (Enforced) en un vínculo GPO existente
   */
  setGPOLinkEnforced(linkId, enforced) {
    const link = this.gpoLinks[linkId];
    if (!link) throw new Error(`Vínculo GPO "${linkId}" no encontrado.`);
    link.enforced = Boolean(enforced);
    return link;
  }

  /**
   * Activa o desactiva el estado del vínculo (Link Enabled) en una OU
   */
  setGPOLinkEnabled(linkId, linkEnabled) {
    const link = this.gpoLinks[linkId];
    if (!link) throw new Error(`Vínculo GPO "${linkId}" no encontrado.`);
    link.linkEnabled = Boolean(linkEnabled);
    return link;
  }

  /**
   * Elimina una GPO del contenedor central "Objetos de directiva de grupo" y todos sus vínculos
   */
  deleteGPO(gpoId) {
    if (!this.gpos[gpoId]) return false;
    Object.entries(this.gpoLinks).forEach(([linkId, link]) => {
      if (link.gpoId === gpoId) {
        delete this.gpoLinks[linkId];
      }
    });
    delete this.gpos[gpoId];
    return true;
  }

  /**
   * Evalúa si una GPO pasa el Filtrado de Seguridad (Security Filtering) para un usuario dado
   */
  doesGPOApplyToUserBySecurityFiltering(gpo, user) {
    if (!gpo || !Array.isArray(gpo.securityFiltering) || gpo.securityFiltering.length === 0) {
      return true;
    }
    if (
      gpo.securityFiltering.includes('Authenticated Users') ||
      gpo.securityFiltering.includes('Usuarios autentificados')
    ) {
      return true;
    }

    const { effectiveGroups } = this.getUserEffectiveGroupsAndPermissions(user.id);
    const effectiveGroupNames = new Set(effectiveGroups.map((g) => g.name.toLowerCase()));

    return gpo.securityFiltering.some((filterTarget) => {
      const normalized = String(filterTarget).trim().toLowerCase();
      return (
        normalized === user.samAccountName.toLowerCase() ||
        normalized === user.displayName.toLowerCase() ||
        effectiveGroupNames.has(normalized)
      );
    });
  }

  /**
   * Calcula el Resultant Set of Policy (RSoP) para una OU dada
   */
  calculateEffectiveGPOsForOU(ouId) {
    const hierarchy = this.getOUHierarchyPath(ouId); // [DomainRoot, ..., TargetOU]
    if (hierarchy.length === 0) {
      throw new Error(`OU "${ouId}" no encontrada.`);
    }

    let regularQueue = []; // GPOs normales sujetas a BlockInheritance
    const enforcedQueue = []; // GPOs forzadas (inmunes a BlockInheritance y prevalecen al final)

    hierarchy.forEach((currentOU) => {
      if (currentOU.blockInheritance) {
        regularQueue = [];
      }

      const linksInOU = Object.values(this.gpoLinks)
        .filter((link) => link.ouId === currentOU.id && link.linkEnabled)
        .sort((a, b) => b.linkOrder - a.linkOrder);

      linksInOU.forEach((link) => {
        const gpo = this.gpos[link.gpoId];
        if (!gpo || gpo.gpoStatus === 'AllDisabled') return;

        const entry = { gpo, link, sourceOU: currentOU };
        if (link.enforced) {
          enforcedQueue.unshift(entry);
        } else {
          regularQueue.push(entry);
        }
      });
    });

    const appliedOrder = [...regularQueue, ...enforcedQueue];

    const resultantSettings = {
      appLocker: null,
      wallpaper: null,
      proxy: null,
      windowsUpdate: null,
      disableControlPanel: false,
      disableCmd: false,
      disableRegistryTools: false,
      deploySoftware: [],
      driveMaps: [],
      passwordMinLength: null,
    };

    const winningGPOs = {
      appLocker: null,
      wallpaper: null,
      proxy: null,
      windowsUpdate: null,
    };

    appliedOrder.forEach(({ gpo }) => {
      const s = gpo.settings;
      if (s.appLocker !== null && s.appLocker !== undefined && s.appLocker !== '') {
        resultantSettings.appLocker = s.appLocker;
        winningGPOs.appLocker = gpo.name;
      }
      if (s.wallpaper !== null && s.wallpaper !== undefined && s.wallpaper !== '') {
        resultantSettings.wallpaper = s.wallpaper;
        winningGPOs.wallpaper = gpo.name;
      }
      if (s.proxy !== null && s.proxy !== undefined && s.proxy !== '') {
        resultantSettings.proxy = s.proxy;
        winningGPOs.proxy = gpo.name;
      }
      if (s.windowsUpdate !== null && s.windowsUpdate !== undefined && s.windowsUpdate !== '') {
        resultantSettings.windowsUpdate = s.windowsUpdate;
        winningGPOs.windowsUpdate = gpo.name;
      }
      if (typeof s.disableControlPanel === 'boolean' && s.disableControlPanel) {
        resultantSettings.disableControlPanel = true;
      }
      if (typeof s.disableCmd === 'boolean' && s.disableCmd) {
        resultantSettings.disableCmd = true;
      }
      if (typeof s.disableRegistryTools === 'boolean' && s.disableRegistryTools) {
        resultantSettings.disableRegistryTools = true;
      }
      if (Array.isArray(s.deploySoftware) && s.deploySoftware.length > 0) {
        resultantSettings.deploySoftware = [
          ...new Set([...resultantSettings.deploySoftware, ...s.deploySoftware]),
        ];
      }
      if (Array.isArray(s.driveMaps) && s.driveMaps.length > 0) {
        resultantSettings.driveMaps = [...resultantSettings.driveMaps, ...s.driveMaps];
      }
      if (s.passwordMinLength !== null && s.passwordMinLength !== undefined) {
        resultantSettings.passwordMinLength = s.passwordMinLength;
      }
    });

    return {
      appliedGPOs: appliedOrder,
      resultantSettings,
      winningGPOs,
    };
  }

  /**
   * Motor principal educativo RSoP (Resultant Set of Policy) para un Usuario específico.
   * Evalúa el camino Dominio -> OUs anidadas hasta la OU del usuario aplicando:
   * 1. Herencia descendente (Dominio -> OU Padre -> OU Hija): la OU más cercana sobrescribe a la superior.
   * 2. Orden de precedencia local (linkOrder #1 gana sobre #2 dentro de la misma OU).
   * 3. Bloqueo de Herencia (Block Inheritance): descarta las GPOs superiores NO forzadas.
   * 4. Forzado (Enforced): inmune al Bloqueo de Herencia y con máxima prioridad sobre las directivas locales.
   * 5. Filtrado de Seguridad (Security Filtering): descarta GPOs donde el usuario/grupos no tengan permiso de aplicar.
   */
  calculateUserRSoP(userId) {
    const user = this.users[userId];
    if (!user) {
      throw new Error(`El usuario con ID "${userId}" no existe.`);
    }

    const hierarchy = this.getOUHierarchyPath(user.ouId); // [DomainRoot, ..., UserOU]
    if (hierarchy.length === 0) {
      throw new Error(`No se pudo resolver la jerarquía de OUs para el usuario "${user.displayName}".`);
    }

    let regularQueue = []; // GPOs normales (enforced = false)
    const enforcedQueue = []; // GPOs forzadas (enforced = true)
    const blockedGPOs = []; // GPOs descartadas por Block Inheritance o Security Filtering
    const hierarchySteps = []; // Traza nodo por nodo para mostrar en la UI

    hierarchy.forEach((currentOU) => {
      const blockedAtThisLevel = [];

      // Regla 2: Si esta OU tiene "Bloquear Herencia", descarta las GPOs normales heredadas de OUs superiores
      if (currentOU.blockInheritance && regularQueue.length > 0) {
        regularQueue.forEach((item) => {
          const blockedRecord = {
            ...item,
            blockedByOU: currentOU,
            reason: `Descartada porque la OU "${currentOU.name}" tiene activado "Bloquear herencia" (Block Inheritance) y este vínculo no está marcado como Forzado.`,
          };
          blockedGPOs.push(blockedRecord);
          blockedAtThisLevel.push(blockedRecord);
        });
        regularQueue = [];
      }

      // Obtener vínculos habilitados en esta OU.
      // En Windows Server, dentro de una misma OU, linkOrder 1 tiene mayor prioridad que linkOrder 2.
      // Por tanto, se procesa primero el número mayor y al final el #1 para que sobrescriba.
      const linksInOU = Object.values(this.gpoLinks)
        .filter((link) => link.ouId === currentOU.id && link.linkEnabled)
        .sort((a, b) => b.linkOrder - a.linkOrder);

      const stepLinks = [];

      linksInOU.forEach((link) => {
        const gpo = this.gpos[link.gpoId];
        if (!gpo || gpo.gpoStatus === 'AllDisabled') return;

        const passesSecurity = this.doesGPOApplyToUserBySecurityFiltering(gpo, user);

        const entry = {
          gpo,
          link,
          sourceOU: currentOU,
          enforced: Boolean(link.enforced),
          linkOrder: link.linkOrder,
          filteredBySecurity: !passesSecurity,
        };

        stepLinks.push(entry);

        if (!passesSecurity) {
          const secBlocked = {
            ...entry,
            blockedByOU: currentOU,
            reason: `Filtrado de Seguridad (Security Filtering): la GPO "${gpo.name}" solo aplica a [${gpo.securityFiltering.join(', ')}] y el usuario "${user.displayName}" no pertenece a dicho grupo.`,
          };
          blockedGPOs.push(secBlocked);
          blockedAtThisLevel.push(secBlocked);
          return;
        }

        if (link.enforced) {
          // Regla 3: Las GPOs Forzadas nunca se bloquean y tienen máxima prioridad
          enforcedQueue.unshift(entry);
        } else {
          // Regla 1: Las GPOs normales se apilan de arriba hacia abajo (la OU hija va después y sobrescribe)
          regularQueue.push(entry);
        }
      });

      hierarchySteps.push({
        ou: currentOU,
        blockInheritance: Boolean(currentOU.blockInheritance),
        linkedEntries: stepLinks,
        blockedHere: blockedAtThisLevel,
      });
    });

    const effectiveOrder = [...regularQueue, ...enforcedQueue];

    const settingDefinitions = [
      {
        key: 'appLocker',
        label: 'AppLocker (Control de Ejecución)',
        category: 'Seguridad / Directivas de Restricción',
        registryKey: 'HKLM\\Software\\Policies\\Microsoft\\Windows\\SrpV2\\Exe',
        isConfigured: (val) => val !== null && val !== undefined && val !== '',
        formatValue: (val) => val,
      },
      {
        key: 'wallpaper',
        label: 'Wallpaper (Tapiz de Escritorio)',
        category: 'Plantillas Administrativas / Active Desktop',
        registryKey: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System\\Wallpaper',
        isConfigured: (val) => val !== null && val !== undefined && val !== '',
        formatValue: (val) => val,
      },
      {
        key: 'proxy',
        label: 'Proxy Corporativo (WinHTTP / IE)',
        category: 'Configuración de Red / Proxy',
        registryKey: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings\\ProxyServer',
        isConfigured: (val) => val !== null && val !== undefined && val !== '',
        formatValue: (val) => val,
      },
      {
        key: 'windowsUpdate',
        label: 'Windows Update / WSUS',
        category: 'Componentes de Windows / Actualizaciones',
        registryKey: 'HKLM\\Software\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU',
        isConfigured: (val) => val !== null && val !== undefined && val !== '',
        formatValue: (val) => val,
      },
      {
        key: 'disableControlPanel',
        label: 'Bloquear Panel de Control y Configuración',
        category: 'Plantillas Administrativas / Panel de Control',
        registryKey: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer\\NoControlPanel',
        isConfigured: (val) => val === true,
        formatValue: (val) => (val ? 'Habilitado (Panel de Control Bloqueado)' : 'No configurado'),
      },
      {
        key: 'disableCmd',
        label: 'Bloquear Símbolo del Sistema (cmd.exe)',
        category: 'Plantillas Administrativas / Sistema',
        registryKey: 'HKCU\\Software\\Policies\\Microsoft\\Windows\\System\\DisableCMD',
        isConfigured: (val) => val === true,
        formatValue: (val) => (val ? 'Habilitado (CMD Bloqueado)' : 'No configurado'),
      },
      {
        key: 'disableRegistryTools',
        label: 'Deshabilitar Editor de Registro (regedit)',
        category: 'Plantillas Administrativas / Sistema',
        registryKey: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System\\DisableRegistryTools',
        isConfigured: (val) => val === true,
        formatValue: (val) => (val ? 'Habilitado (Regedit Bloqueado)' : 'No configurado'),
      },
      {
        key: 'deploySoftware',
        label: 'Despliegue de Software (Paquetes MSI)',
        category: 'Configuración de Software / Instalación',
        registryKey: 'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Group Policy\\AppMgmt',
        isConfigured: (val) => Array.isArray(val) && val.length > 0,
        formatValue: (val) => (Array.isArray(val) ? val.join(', ') : ''),
        isCumulative: true,
      },
    ];

    const settingsTable = settingDefinitions.map((def) => {
      const history = [];
      let winningEntry = null;
      let finalValue = null;

      const blockedContributors = blockedGPOs
        .filter(({ gpo }) => def.isConfigured(gpo.settings[def.key]))
        .map(({ gpo, sourceOU, blockedByOU, filteredBySecurity, linkOrder, enforced }) => ({
          gpoName: gpo.name,
          sourceOUName: sourceOU.name,
          linkOrder: linkOrder || 1,
          enforced: Boolean(enforced),
          value: def.formatValue(gpo.settings[def.key]),
          status: filteredBySecurity
            ? `Filtrada por Seguridad en "${sourceOU.name}"`
            : `Bloqueada por herencia en "${blockedByOU.name}"`,
        }));

      effectiveOrder.forEach((entry) => {
        const rawVal = entry.gpo.settings[def.key];
        if (!def.isConfigured(rawVal)) return;

        const formattedVal = def.formatValue(rawVal);

        if (def.isCumulative) {
          finalValue = finalValue
            ? `${finalValue}, ${formattedVal}`
            : formattedVal;
          winningEntry = entry;
          history.push({
            gpoName: entry.gpo.name,
            sourceOUName: entry.sourceOU.name,
            enforced: entry.enforced,
            linkOrder: entry.linkOrder,
            value: formattedVal,
          });
        } else {
          winningEntry = entry;
          finalValue = formattedVal;
          history.push({
            gpoName: entry.gpo.name,
            sourceOUName: entry.sourceOU.name,
            enforced: entry.enforced,
            linkOrder: entry.linkOrder,
            value: formattedVal,
          });
        }
      });

      const previousContributors = history.slice(0, -1);
      const totalCompetingGPOs = history.length + blockedContributors.length;
      const hasConflict =
        !def.isCumulative &&
        Boolean(winningEntry) &&
        (previousContributors.length > 0 || blockedContributors.length > 0);

      let conflictResolutionRule = null;
      let explanation = 'Ninguna GPO activa en la ruta del usuario configura esta directiva.';

      if (winningEntry) {
        if (winningEntry.enforced) {
          const bypassedBlock = hierarchy.some(
            (ou) => ou.blockInheritance && ou.id !== winningEntry.sourceOU.id
          );
          if (hasConflict) {
            conflictResolutionRule = `Gana por Vínculo Forzado (Enforced · Orden #${winningEntry.linkOrder})`;
          }
          explanation =
            `Ganó por tener vínculo FORZADO (Enforced) desde "${winningEntry.sourceOU.name}". ` +
            (bypassedBlock
              ? 'Traspasó el Bloqueo de Herencia activo en OUs inferiores y prevaleció sobre las directivas locales.'
              : previousContributors.length > 0
              ? `Se impuso por máxima prioridad sobre: ${previousContributors
                  .map((p) => `${p.gpoName} (${p.sourceOUName})`)
                  .join(', ')}.`
              : 'Tiene prioridad absoluta en la jerarquía.');
        } else if (previousContributors.length > 0) {
          const sameOUConflict = previousContributors.some(
            (p) => p.sourceOUName === winningEntry.sourceOU.name
          );
          conflictResolutionRule = sameOUConflict
            ? `Gana por Orden de Vínculo #${winningEntry.linkOrder} en "${winningEntry.sourceOU.name}"`
            : `Gana por Proximidad LSDOU (OU "${winningEntry.sourceOU.name}" · Orden #${winningEntry.linkOrder})`;
          explanation = sameOUConflict
            ? `Ganó por Orden de Vínculo #${winningEntry.linkOrder} dentro de "${winningEntry.sourceOU.name}", sobrescribiendo a: ${previousContributors
                .map((p) => `${p.gpoName} (Orden #${p.linkOrder} en ${p.sourceOUName})`)
                .join(', ')}.`
            : `Ganó por proximidad jerárquica al usuario (vinculada en "${winningEntry.sourceOU.name}"), sobrescribiendo el valor heredado de: ${previousContributors
                .map((p) => `${p.gpoName} (${p.sourceOUName})`)
                .join(', ')}.`;
        } else if (blockedContributors.length > 0) {
          conflictResolutionRule = `Gana tras descarte superior (${blockedContributors[0].status})`;
          explanation =
            `Aplicada desde "${winningEntry.sourceOU.name}". Las directivas superiores (${blockedContributors
              .map((b) => b.gpoName)
              .join(', ')}) fueron descartadas (${blockedContributors.map((b) => b.status).join('; ')}).`;
        } else {
          explanation = `Única directiva activa que configura este parámetro (heredada desde "${winningEntry.sourceOU.name}", Orden #${winningEntry.linkOrder}).`;
        }
      } else if (blockedContributors.length > 0) {
        explanation =
          `No se aplica ningún valor porque la directiva (${blockedContributors
            .map((b) => `${b.gpoName} en ${b.sourceOUName}: ${b.status}`)
            .join(', ')}) fue descartada.`;
      }

      // Construir cadena completa de competición cuando hay conflicto de registro
      const competingChain = [
        ...blockedContributors.map((b) => ({
          gpoName: b.gpoName,
          sourceOUName: b.sourceOUName,
          linkOrder: b.linkOrder,
          enforced: b.enforced,
          value: b.value,
          isWinner: false,
          outcomeLabel: b.status,
        })),
        ...previousContributors.map((p) => {
          const isSameOU = winningEntry && p.sourceOUName === winningEntry.sourceOU.name;
          return {
            gpoName: p.gpoName,
            sourceOUName: p.sourceOUName,
            linkOrder: p.linkOrder,
            enforced: p.enforced,
            value: p.value,
            isWinner: false,
            outcomeLabel: winningEntry?.enforced
              ? `Sobrescrita por GPO Forzada (${winningEntry.gpo.name})`
              : isSameOU
              ? `Sobrescrita por Orden #${winningEntry.linkOrder} en ${p.sourceOUName}`
              : `Sobrescrita por OU más cercana (${winningEntry?.sourceOU.name})`,
          };
        }),
        ...(winningEntry
          ? [
              {
                gpoName: winningEntry.gpo.name,
                sourceOUName: winningEntry.sourceOU.name,
                linkOrder: winningEntry.linkOrder,
                enforced: winningEntry.enforced,
                value: finalValue,
                isWinner: true,
                outcomeLabel: winningEntry.enforced
                  ? `GANADORA · Vínculo Forzado (Enforced · Orden #${winningEntry.linkOrder})`
                  : `GANADORA · OU "${winningEntry.sourceOU.name}" (Orden #${winningEntry.linkOrder})`,
              },
            ]
          : []),
      ];

      return {
        key: def.key,
        label: def.label,
        category: def.category,
        registryKey: def.registryKey,
        finalValue: finalValue || 'No configurado (Valor predeterminado de Windows)',
        isConfigured: Boolean(winningEntry),
        winningGPO: winningEntry ? winningEntry.gpo.name : null,
        winningOU: winningEntry ? winningEntry.sourceOU.name : null,
        winningOrder: winningEntry ? winningEntry.linkOrder : null,
        isEnforcedWinner: winningEntry ? winningEntry.enforced : false,
        hasConflict,
        totalCompetingGPOs,
        conflictResolutionRule,
        competingChain,
        explanation,
        overriddenHistory: previousContributors,
        blockedContributors,
      };
    });

    const agdlpSummary = this.getUserEffectiveGroupsAndPermissions(user.id);

    return {
      user,
      userDN: this.getDistinguishedName(user.displayName, user.ouId),
      hierarchyPath: hierarchy,
      hierarchySteps,
      appliedGPOs: effectiveOrder,
      blockedGPOs,
      settingsTable,
      agdlpSummary,
      calculatedAt: new Date().toISOString(),
    };
  }

  // =========================================================================
  // GENERADOR DE SCRIPTS WINDOWS POWERSHELL (.PS1) Y AUDITORÍA BPA
  // =========================================================================

  /**
   * Genera un script PowerShell real (Módulos ActiveDirectory y GroupPolicy)
   * que automatiza la creación completa de la infraestructura actual en Windows Server 2022/2025.
   */
  generatePowerShellDeploymentScript() {
    const lines = [
      '# ============================================================================',
      `# ADLab - Script de Despliegue Automatizado Windows Server PowerShell`,
      `# Dominio: ${this.domainName} (${this.netbiosName})`,
      `# Generado: ${new Date().toISOString()}`,
      '# Requisitos: Windows Server 2019/2022/2025 con rol AD DS y GPMC instalados',
      '# ============================================================================',
      '',
      'Import-Module ActiveDirectory',
      'Import-Module GroupPolicy',
      '',
      '$ErrorActionPreference = "Stop"',
      '',
      '# 1. CREACIÓN JERÁRQUICA DE UNIDADES ORGANIZATIVAS (OUs)',
    ];

    // Recorrer OUs en orden topológico (BFS desde rootOuId)
    const queue = [this.rootOuId];
    const visitedOUs = new Set();

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId || visitedOUs.has(currentId)) continue;
      visitedOUs.add(currentId);

      const ou = this.ous[currentId];
      if (!ou) continue;

      if (!ou.isDomainRoot) {
        const parentDN = this.getDistinguishedName('', ou.parentId);
        lines.push(
          `New-ADOrganizationalUnit -Name "${ou.name}" -Path "${parentDN}" -Description "${ou.description || ''}" -ProtectedFromAccidentalDeletion $true`
        );
        if (ou.blockInheritance) {
          const thisDN = this.getDistinguishedName('', ou.id);
          lines.push(`Set-GPInheritance -Target "${thisDN}" -IsBlocked Yes`);
        }
      } else if (ou.blockInheritance) {
        const rootDN = this.getDistinguishedName('', ou.id);
        lines.push(`Set-GPInheritance -Target "${rootDN}" -IsBlocked Yes`);
      }

      (ou.childrenIds || []).forEach((childId) => queue.push(childId));
    }

    lines.push('', '# 2. CREACIÓN DE CUENTAS DE USUARIO (Accounts - A)');
    Object.values(this.users).forEach((u) => {
      const ouDN = this.getDistinguishedName('', u.ouId);
      lines.push(
        `New-ADUser -Name "${u.displayName}" -SamAccountName "${u.samAccountName}" -UserPrincipalName "${u.samAccountName}@${this.domainName}" -Path "${ouDN}" -Department "${u.department || ''}" -Title "${u.title || ''}" -AccountPassword (ConvertTo-SecureString "P@ssw0rd2026!" -AsPlainText -Force) -Enabled $${u.enabled ? 'true' : 'false'}`
      );
    });

    lines.push('', '# 3. CREACIÓN DE GRUPOS DE SEGURIDAD (Global, Universal, DomainLocal)');
    Object.values(this.groups).forEach((g) => {
      const ouDN = this.getDistinguishedName('', g.ouId);
      lines.push(
        `New-ADGroup -Name "${g.name}" -GroupScope ${g.scope} -GroupCategory ${g.category} -Path "${ouDN}" -Description "${g.description || ''}"`
      );
    });

    lines.push('', '# 4. ANIDAMIENTO AGDLP (Add-ADGroupMember: A -> G -> U -> DL)');
    Object.values(this.groups).forEach((g) => {
      if (g.memberUserIds.length > 0) {
        const members = g.memberUserIds
          .map((uid) => this.users[uid]?.samAccountName)
          .filter(Boolean)
          .map((s) => `"${s}"`)
          .join(', ');
        if (members) {
          lines.push(`Add-ADGroupMember -Identity "${g.name}" -Members ${members}`);
        }
      }
      if (g.memberGroupIds.length > 0) {
        const nested = g.memberGroupIds
          .map((gid) => this.groups[gid]?.name)
          .filter(Boolean)
          .map((n) => `"${n}"`)
          .join(', ');
        if (nested) {
          lines.push(`Add-ADGroupMember -Identity "${g.name}" -Members ${nested}`);
        }
      }
    });

    lines.push('', '# 5. CREACIÓN DE OBJETOS DE DIRECTIVA DE GRUPO (GPOs) Y VÍNCULOS');
    Object.values(this.gpos).forEach((gpo) => {
      if (gpo.name !== 'Default Domain Policy') {
        lines.push(`New-GPO -Name "${gpo.name}" -Comment "${gpo.description || ''}"`);
      }
      if (gpo.settings.wallpaper) {
        lines.push(
          `Set-GPRegistryValue -Name "${gpo.name}" -Key "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" -ValueName "Wallpaper" -Type String -Value "${gpo.settings.wallpaper}"`
        );
      }
      if (gpo.settings.disableControlPanel) {
        lines.push(
          `Set-GPRegistryValue -Name "${gpo.name}" -Key "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer" -ValueName "NoControlPanel" -Type DWord -Value 1`
        );
      }
      if (gpo.settings.disableCmd) {
        lines.push(
          `Set-GPRegistryValue -Name "${gpo.name}" -Key "HKCU\\Software\\Policies\\Microsoft\\Windows\\System" -ValueName "DisableCMD" -Type DWord -Value 2`
        );
      }
      if (gpo.settings.disableRegistryTools) {
        lines.push(
          `Set-GPRegistryValue -Name "${gpo.name}" -Key "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" -ValueName "DisableRegistryTools" -Type DWord -Value 2`
        );
      }
    });

    lines.push('', '# 6. VINCULACIÓN DE GPOs A UNIDADES ORGANIZATIVAS (GPOLinks)');
    Object.values(this.gpoLinks)
      .sort((a, b) => a.linkOrder - b.linkOrder)
      .forEach((link) => {
        const gpo = this.gpos[link.gpoId];
        const ou = this.ous[link.ouId];
        if (!gpo || !ou) return;
        const targetDN = this.getDistinguishedName('', ou.id);
        const enforcedFlag = link.enforced ? 'Yes' : 'No';
        const enabledFlag = link.linkEnabled ? 'Yes' : 'No';
        lines.push(
          `New-GPLink -Name "${gpo.name}" -Target "${targetDN}" -LinkEnabled ${enabledFlag} -Enforced ${enforcedFlag} -Order ${link.linkOrder}`
        );
      });

    lines.push(
      '',
      '# 7. AUDITORÍA RSoP DE EJEMPLO',
      '# Get-GPResultantSetOfPolicy -User "agarcia" -ReportType Html -Path "C:\\RSoP_agarcia.html"'
    );

    return lines.join('\n');
  }

  /**
   * Analizador de Buenas Prácticas (Best Practices Analyzer - BPA) de Active Directory
   */
  runDomainHealthAudit() {
    const findings = [];

    // 1. Usuarios que no pertenecen a ningún grupo Global
    Object.values(this.users).forEach((u) => {
      const { directGroups } = this.getUserEffectiveGroupsAndPermissions(u.id);
      if (directGroups.length === 0) {
        findings.push({
          severity: 'warning',
          category: 'AGDLP',
          title: `Usuario huérfano sin grupo Global: ${u.displayName} (${u.samAccountName})`,
          recommendation: `Añade a "${u.displayName}" dentro de un Grupo Global departamental (ej. GG_Ventas) para gestionar sus permisos mediante AGDLP.`,
        });
      }
      const nonGlobalDirect = directGroups.filter((g) => g.scope !== GroupScope.GLOBAL);
      if (nonGlobalDirect.length > 0) {
        findings.push({
          severity: 'error',
          category: 'AGDLP',
          title: `Violación AGDLP en usuario ${u.displayName}`,
          recommendation: `El usuario está asignado directamente a [${nonGlobalDirect.map((g) => `${g.name} (${g.scope})`).join(', ')}]. Las cuentas (A) solo deben ser miembros directos de Grupos Globales (G).`,
        });
      }
    });

    // 2. Grupos Domain Local sin permisos NTFS/Share definidos
    Object.values(this.groups)
      .filter((g) => g.scope === GroupScope.DOMAIN_LOCAL)
      .forEach((dl) => {
        if (!dl.permissions || dl.permissions.length === 0) {
          findings.push({
            severity: 'info',
            category: 'Permisos ACL',
            title: `Grupo Domain Local "${dl.name}" sin ACL asignada`,
            recommendation: `En el modelo AGDLP, los grupos Domain Local representan permisos sobre recursos concretos (DL → P). Añade al menos una ACL en sus propiedades.`,
          });
        }
      });

    // 3. GPOs no vinculadas a ningún contenedor
    Object.values(this.gpos).forEach((gpo) => {
      const links = Object.values(this.gpoLinks).filter((l) => l.gpoId === gpo.id);
      if (links.length === 0) {
        findings.push({
          severity: 'info',
          category: 'GPMC',
          title: `GPO no vinculada: "${gpo.name}"`,
          recommendation: `La directiva existe en el contenedor "Objetos de directiva de grupo" pero no está vinculada a ninguna OU ni al Dominio.`,
        });
      }
    });

    // 4. OUs con Block Inheritance activo
    Object.values(this.ous).forEach((ou) => {
      if (ou.blockInheritance) {
        findings.push({
          severity: 'warning',
          category: 'Herencia GPO',
          title: `Bloqueo de Herencia activo en "${ou.name}"`,
          recommendation: `Microsoft recomienda usar "Block Inheritance" con moderación porque impide la propagación de directivas no forzadas desde niveles superiores.`,
        });
      }
    });

    return findings;
  }

  /**
   * Evalúa automáticamente el progreso del alumno en cualquiera de los 3 Retos Guiados
   */
  evaluateLabChallenge(challengeId) {
    if (challengeId === 'challenge-gpo-inheritance') {
      const ana = Object.values(this.users).find((u) => u.samAccountName === 'agarcia');
      const rsopAna = ana ? this.calculateUserRSoP(ana.id) : null;

      const softwareRow = rsopAna?.settingsTable.find((r) => r.key === 'deploySoftware');
      const appLockerRow = rsopAna?.settingsTable.find((r) => r.key === 'appLocker');
      const wallpaperRow = rsopAna?.settingsTable.find((r) => r.key === 'wallpaper');

      const check1 = Boolean(
        softwareRow && softwareRow.finalValue.includes('ERP_Cliente_2026.msi')
      );
      const check2 = Boolean(
        appLockerRow &&
          appLockerRow.winningGPO === 'GPO_Seguridad_Critica_CISO' &&
          appLockerRow.isEnforcedWinner
      );
      const check3 = Boolean(
        wallpaperRow && wallpaperRow.finalValue.includes('bg_comercial.jpg')
      );

      const checks = [
        {
          label: 'Ana García recibe el paquete "ERP_Cliente_2026.msi" en su RSoP final (desbloqueando herencia en Ventas o vinculando la GPO)',
          passed: check1,
        },
        {
          label: 'La directiva "GPO_Seguridad_Critica_CISO" está marcada como Forzada (Enforced) en la raíz del dominio y gana en AppLocker',
          passed: check2,
        },
        {
          label: 'Ana García conserva el tapiz comercial "bg_comercial.jpg" de la OU Ventas',
          passed: check3,
        },
      ];

      return {
        challengeId,
        completed: checks.every((c) => c.passed),
        score: `${checks.filter((c) => c.passed).length}/${checks.length}`,
        checks,
      };
    }

    if (challengeId === 'challenge-agdlp-nesting') {
      const carlos = Object.values(this.users).find((u) => u.samAccountName === 'cmartinez');
      const agdlp = carlos ? this.getUserEffectiveGroupsAndPermissions(carlos.id) : null;

      const hasTargetPerm = Boolean(
        agdlp?.effectivePermissions.some((p) =>
          p.toLowerCase().includes('auditorias$')
        )
      );

      const onlyDirectGlobal = Boolean(
        agdlp &&
          agdlp.directGroups.length > 0 &&
          agdlp.directGroups.every((g) => g.scope === GroupScope.GLOBAL)
      );

      const hasUniversalInChain = Boolean(
        agdlp?.effectiveGroups.some((g) => g.scope === GroupScope.UNIVERSAL)
      );

      const hasDLInChain = Boolean(
        agdlp?.effectiveGroups.some(
          (g) =>
            g.scope === GroupScope.DOMAIN_LOCAL &&
            g.permissions.some((p) => p.toLowerCase().includes('auditorias$'))
        )
      );

      const checks = [
        {
          label: 'Carlos Martínez tiene únicamente Grupos Globales como pertenencia directa (Paso A → G)',
          passed: onlyDirectGlobal,
        },
        {
          label: 'La cadena de anidamiento incluye un Grupo Universal intermedio y un Grupo Domain Local con el permiso sobre \\\\SRV-FS01\\Auditorias$',
          passed: hasUniversalInChain && hasDLInChain,
        },
        {
          label: 'Carlos Martínez obtiene efectivamente el permiso "Modify:\\\\SRV-FS01\\Auditorias$"',
          passed: hasTargetPerm,
        },
      ];

      return {
        challengeId,
        completed: checks.every((c) => c.passed),
        score: `${checks.filter((c) => c.passed).length}/${checks.length}`,
        checks,
      };
    }

    if (challengeId === 'challenge-security-filtering') {
      const elena = Object.values(this.users).find((u) => u.samAccountName === 'erodriguez');
      const rsopElena = elena ? this.calculateUserRSoP(elena.id) : null;

      const wuRow = rsopElena?.settingsTable.find((r) => r.key === 'windowsUpdate');
      const cmdRow = rsopElena?.settingsTable.find((r) => r.key === 'disableCmd');
      const regRow = rsopElena?.settingsTable.find((r) => r.key === 'disableRegistryTools');

      const check1 = Boolean(
        wuRow &&
          wuRow.winningGPO === 'GPO_WindowsUpdate_Diferido' &&
          wuRow.winningOrder === 1
      );
      const check2 = Boolean(cmdRow && cmdRow.isConfigured && regRow && regRow.isConfigured);

      const checks = [
        {
          label: '"GPO_WindowsUpdate_Diferido" está vinculada en la OU Sistemas con Orden de Vínculo #1 y gana en Windows Update para Elena Rodríguez',
          passed: check1,
        },
        {
          label: 'Elena Rodríguez tiene bloqueados tanto cmd.exe (disableCmd) como regedit.exe (disableRegistryTools) en su RSoP efectivo',
          passed: check2,
        },
      ];

      return {
        challengeId,
        completed: checks.every((c) => c.passed),
        score: `${checks.filter((c) => c.passed).length}/${checks.length}`,
        checks,
      };
    }

    return { challengeId, completed: false, score: '0/0', checks: [] };
  }

  // =========================================================================
  // PERSISTENCIA EN LOCALSTORAGE Y EXPORTACIÓN / IMPORTACIÓN DE SNAPSHOTS JSON
  // =========================================================================

  toJSON() {
    return {
      app: 'ADLab',
      version: 1,
      exportedAt: new Date().toISOString(),
      domainName: this.domainName,
      netbiosName: this.netbiosName,
      rootOuId: this.rootOuId,
      ous: Object.fromEntries(
        Object.entries(this.ous).map(([id, ou]) => [id, ou.toJSON()])
      ),
      users: Object.fromEntries(
        Object.entries(this.users).map(([id, user]) => [id, user.toJSON()])
      ),
      groups: Object.fromEntries(
        Object.entries(this.groups).map(([id, group]) => [id, group.toJSON()])
      ),
      gpos: Object.fromEntries(
        Object.entries(this.gpos).map(([id, gpo]) => [id, gpo.toJSON()])
      ),
      gpoLinks: Object.fromEntries(
        Object.entries(this.gpoLinks).map(([id, link]) => [id, link.toJSON()])
      ),
    };
  }

  /**
   * Guarda automáticamente todo el estado de ADEnvironment en localStorage
   */
  saveToLocalStorage(storageKey = ADEnvironment.STORAGE_KEY) {
    if (typeof localStorage === 'undefined') return false;
    const serialized = JSON.stringify(this.toJSON());
    localStorage.setItem(storageKey, serialized);
    return true;
  }

  /**
   * Restaura el estado desde localStorage al cargar la página
   */
  static loadFromLocalStorage(storageKey = ADEnvironment.STORAGE_KEY) {
    if (typeof localStorage === 'undefined') {
      return ADEnvironment.createSeededEnvironment();
    }
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      const seeded = ADEnvironment.createSeededEnvironment();
      seeded.saveToLocalStorage(storageKey);
      return seeded;
    }
    try {
      const parsed = JSON.parse(raw);
      return new ADEnvironment(parsed);
    } catch (error) {
      console.error('Error al deserializar ADEnvironment desde localStorage:', error);
      return ADEnvironment.createSeededEnvironment();
    }
  }

  /**
   * Devuelve el snapshot serializado y formateado en JSON
   */
  exportToSnapshotJSON() {
    return JSON.stringify(this.toJSON(), null, 2);
  }

  /**
   * Descarga el estado actual en el navegador como un archivo `adlab-snapshot.json`
   * utilizando Blob y URL.createObjectURL.
   */
  exportToFileDownload(filename = 'adlab-snapshot.json') {
    const jsonString = this.exportToSnapshotJSON();
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);

    return true;
  }

  /**
   * Descarga el script PowerShell generado como archivo `deploy-adlab.ps1`
   */
  exportPowerShellToFile(filename = 'deploy-adlab.ps1') {
    const ps1Content = this.generatePowerShellDeploymentScript();
    const blob = new Blob([ps1Content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);

    return true;
  }

  /**
   * Valida e importa un archivo `.json` de escenario o snapshot de ADLab,
   * sobrescribe localStorage y devuelve la nueva instancia de ADEnvironment.
   */
  static importFromSnapshotJSON(rawJsonOrObject, storageKey = ADEnvironment.STORAGE_KEY) {
    const parsed =
      typeof rawJsonOrObject === 'string'
        ? JSON.parse(rawJsonOrObject)
        : rawJsonOrObject;

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('El archivo JSON no contiene un objeto de estado válido.');
    }

    // Soportar tanto formato directo como formato envuelto { state: { ... } }
    const data = parsed.state && parsed.state.ous ? parsed.state : parsed;

    if (!data.ous || !data.rootOuId || !data.ous[data.rootOuId]) {
      throw new Error(
        'Estructura de snapshot inválida: falta el árbol de Unidades Organizativas (ous) o el nodo raíz (rootOuId).'
      );
    }

    const hydratedEnv = new ADEnvironment({
      domainName: data.domainName || 'adlab.local',
      netbiosName: data.netbiosName || 'ADLAB',
      ous: data.ous || {},
      users: data.users || {},
      groups: data.groups || {},
      gpos: data.gpos || {},
      gpoLinks: data.gpoLinks || {},
      rootOuId: data.rootOuId,
    });

    hydratedEnv.saveToLocalStorage(storageKey);
    return hydratedEnv;
  }

  /**
   * Escenario de reto docente preconfigurado con errores intencionados:
   * "Arregla el bloqueo de herencia en Ventas que impide que se despliegue el software corporativo"
   */
  static createTeacherChallengeEnvironment(challengeId = 'challenge-gpo-inheritance') {
    const env = ADEnvironment.createSeededEnvironment();

    const ouCorp = Object.values(env.ous).find((o) => o.name === 'Corporativo');
    const ouVentas = Object.values(env.ous).find((o) => o.name === 'Ventas');
    const ouSistemas = Object.values(env.ous).find((o) => o.name === 'Sistemas');
    const ouServidores = Object.values(env.ous).find((o) => o.name === 'Servidores');

    if (ouCorp && ouVentas) {
      const gpoSoftwareCorp = env.createGPO({
        name: 'GPO_Despliegue_ERP_Corporativo',
        description: 'Despliega el paquete ERP_Cliente_2026.msi y configura Proxy en toda la sede',
        settings: {
          deploySoftware: ['ERP_Cliente_2026.msi', 'Agente_Inventario.msi'],
          proxy: 'http://proxy.adlab.local:8080 (Bypass *.adlab.local)',
        },
      });
      env.linkGPOToOU(gpoSoftwareCorp.id, ouCorp.id, { enforced: false });

      if (challengeId === 'challenge-gpo-inheritance') {
        // Activar intencionadamente Block Inheritance en Ventas para que los alumnos lo diagnostiquen con RSoP
        env.setOUBlockInheritance(ouVentas.id, true);
      }
    }

    if (challengeId === 'challenge-agdlp-nesting' && ouServidores) {
      env.createGroup({
        name: 'DL_Share_Auditorias_Modify',
        description: 'Grupo Domain Local con permiso Modify sobre \\\\SRV-FS01\\Auditorias$',
        ouId: ouServidores.id,
        scope: GroupScope.DOMAIN_LOCAL,
        permissions: ['Modify:\\\\SRV-FS01\\Auditorias$'],
      });
    }

    if (challengeId === 'challenge-security-filtering' && ouSistemas) {
      const gpoHardeningTI = env.createGPO({
        name: 'GPO_Restriccion_Consolas_TI',
        description: 'Directiva para restringir CMD y Regedit en estaciones de soporte',
        settings: {
          disableCmd: false, // El alumno deberá activar disableCmd y disableRegistryTools o vincularla
          disableRegistryTools: true,
        },
      });
      env.linkGPOToOU(gpoHardeningTI.id, ouSistemas.id, { enforced: false });
    }

    env.saveToLocalStorage();
    return env;
  }

  /**
   * Crea un entorno inicial realista de Windows Server para prácticas educativas
   */
  static createSeededEnvironment() {
    const env = new ADEnvironment({
      domainName: 'adlab.local',
      netbiosName: 'ADLAB',
    });

    const defaultGpo = Object.values(env.gpos)[0];
    if (defaultGpo) {
      defaultGpo.updateSettings({
        windowsUpdate: 'WSUS Interno (http://wsus.adlab.local:8530) - Domingo 03:00',
        proxy: 'http://proxy.adlab.local:8080 (Bypass *.adlab.local)',
      });
    }

    // OUs principales
    const ouCorp = env.createOU({
      name: 'Corporativo',
      description: 'Sede central y unidades de negocio',
      parentId: env.rootOuId,
    });
    const ouVentas = env.createOU({
      name: 'Ventas',
      description: 'Departamento comercial y ejecutivos de cuenta',
      parentId: ouCorp.id,
    });
    const ouSistemas = env.createOU({
      name: 'Sistemas',
      description: 'Administradores de infraestructura y soporte TI',
      parentId: ouCorp.id,
    });
    const ouMarketing = env.createOU({
      name: 'Marketing',
      description: 'Comunicación y diseño digital',
      parentId: ouCorp.id,
      blockInheritance: true,
    });
    const ouServidores = env.createOU({
      name: 'Servidores',
      description: 'Servidores miembro de aplicaciones y ficheros',
      parentId: env.rootOuId,
    });

    // Usuarios iniciales
    const uAna = env.createUser({
      samAccountName: 'agarcia',
      displayName: 'Ana García',
      ouId: ouVentas.id,
      department: 'Ventas',
      title: 'Ejecutiva de Cuentas Senior',
    });
    const uCarlos = env.createUser({
      samAccountName: 'cmartinez',
      displayName: 'Carlos Martínez',
      ouId: ouVentas.id,
      department: 'Ventas',
      title: 'Representante Comercial',
    });
    const uElena = env.createUser({
      samAccountName: 'erodriguez',
      displayName: 'Elena Rodríguez',
      ouId: ouSistemas.id,
      department: 'Sistemas TI',
      title: 'Ingeniera de Windows Server',
    });
    const uDavid = env.createUser({
      samAccountName: 'dlopez',
      displayName: 'David López',
      ouId: ouMarketing.id,
      department: 'Marketing',
      title: 'Especialista de Campañas',
    });

    // Grupos para modelo AGDLP
    const ggVentas = env.createGroup({
      name: 'GG_Ventas',
      description: 'Grupo Global de usuarios del área comercial',
      ouId: ouVentas.id,
      scope: GroupScope.GLOBAL,
    });
    const ggSistemas = env.createGroup({
      name: 'GG_SysAdmins',
      description: 'Grupo Global de administradores de TI',
      ouId: ouSistemas.id,
      scope: GroupScope.GLOBAL,
    });
    const uComercial = env.createGroup({
      name: 'U_Comercial_Iberia',
      description: 'Grupo Universal comercial multi-sede',
      ouId: ouCorp.id,
      scope: GroupScope.UNIVERSAL,
    });
    const dlShareVentas = env.createGroup({
      name: 'DL_Share_Ventas_RW',
      description: 'Acceso Lectura/Escritura a \\\\SRV-FS01\\Ventas$',
      ouId: ouServidores.id,
      scope: GroupScope.DOMAIN_LOCAL,
      permissions: ['Modify:\\\\SRV-FS01\\Ventas$', 'Read:\\\\SRV-FS01\\Plantillas'],
    });
    const dlAdminSrv = env.createGroup({
      name: 'DL_Server_Operators',
      description: 'Permisos de administración en servidores miembro',
      ouId: ouServidores.id,
      scope: GroupScope.DOMAIN_LOCAL,
      permissions: ['FullControl:\\\\SRV-FS01\\Admin$', 'RDP:OU=Servidores'],
    });

    // Relaciones AGDLP: Usuarios (A) -> Global (G) -> Universal (U) -> Domain Local (DL)
    env.addUserToGroup(uAna.id, ggVentas.id);
    env.addUserToGroup(uCarlos.id, ggVentas.id);
    env.addUserToGroup(uElena.id, ggSistemas.id);
    env.addUserToGroup(uDavid.id, ggVentas.id);

    env.addGroupToGroup(ggVentas.id, uComercial.id);
    env.addGroupToGroup(uComercial.id, dlShareVentas.id);
    env.addGroupToGroup(ggSistemas.id, dlAdminSrv.id);

    // GPOs en el contenedor central "Objetos de directiva de grupo"
    const gpoCorpWallpaper = env.createGPO({
      name: 'GPO_Identidad_Corporativa',
      description: 'Define fondo corporativo y proxy estándar en Corporativo',
      settings: {
        wallpaper: '\\\\adlab.local\\SYSVOL\\corp\\wallpaper_2026.jpg',
        proxy: 'http://proxy.adlab.local:8080 (Bypass *.adlab.local)',
        appLocker: 'AuditOnly: Permitir todo y auditar en Visor de Eventos',
      },
    });

    const gpoHardeningVentas = env.createGPO({
      name: 'GPO_Estaciones_Ventas',
      description: 'Aplica tapiz comercial, AppLocker en Program Files y despliega CRM',
      settings: {
        wallpaper: '\\\\adlab.local\\SYSVOL\\ventas\\bg_comercial.jpg',
        appLocker: 'Enforce: Bloquear ejecutables fuera de C:\\Program Files',
        disableControlPanel: true,
        deploySoftware: ['DynamicsCRM_Client.msi'],
      },
    });

    const gpoSeguridadGlobal = env.createGPO({
      name: 'GPO_Seguridad_Critica_CISO',
      description: 'Directiva forzada (Enforced) de AppLocker estricto y proxy DLP',
      settings: {
        appLocker: 'Strict: Bloquear scripts (.ps1, .bat) y ejecutables de usuario',
        proxy: 'http://proxy-dlp.adlab.local:3128 (Inspección SSL Estricta)',
        disableRegistryTools: true,
      },
    });

    env.createGPO({
      name: 'GPO_WindowsUpdate_Diferido',
      description: 'GPO en almacén central lista para vincular a OUs de prueba',
      settings: {
        windowsUpdate: 'Windows Update for Business - Anillo Diferido 14 días',
      },
    });

    env.linkGPOToOU(gpoCorpWallpaper.id, ouCorp.id, { enforced: false });
    env.linkGPOToOU(gpoHardeningVentas.id, ouVentas.id, { enforced: false });
    env.linkGPOToOU(gpoSeguridadGlobal.id, env.rootOuId, { enforced: false });

    return env;
  }
}
