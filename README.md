# 🛡️ ADLab — Simulador Educativo de Active Directory, AGDLP y Directivas de Grupo (GPO / RSoP)

<p align="left">
  <a href="https://www.unfantasmaenelsistema.com/" target="_blank" rel="noopener noreferrer">
    <img src="./public/assets/aistudio/icono_81a3db5b.png" alt="Un Fantasma en el Sistema" height="96" />
  </a>
</p>

**Un proyecto de [Un Fantasma en el Sistema — https://www.unfantasmaenelsistema.com/](https://www.unfantasmaenelsistema.com/)**

### [▶ Abrir ADLab en vivo](https://unfantasmaenelsistema.github.io/ADLab/)

![Windows Server](https://img.shields.io/badge/Windows_Server-2022_%2F_2025-0078D4?style=flat-square&logo=windows)
![Active Directory](https://img.shields.io/badge/Active_Directory-dsa.msc_%7C_gpmc.msc_%7C_rsop.msc-0284C7?style=flat-square)
[![En vivo](https://img.shields.io/badge/En_vivo-GitHub_Pages-059669?style=flat-square)](https://unfantasmaenelsistema.github.io/ADLab/)
![Web Oficial](https://img.shields.io/badge/Web-unfantasmaenelsistema.com-0284C7?style=flat-square)
[![Licencia](https://img.shields.io/badge/Licencia-Apache_2.0-slate?style=flat-square)](LICENSE)

**ADLab** es un laboratorio interactivo de administración de sistemas Windows Server que se ejecuta **100% en el navegador** (sin servidores backend ni máquinas virtuales pesadas). Permite a estudiantes y docentes de **Administración de Sistemas Informáticos en Red (ASIR)**, **Ingeniería Informática** y certificaciones **Microsoft (AZ-800 / MD-102)** practicar en tiempo real:

1. **Jerarquía de Unidades Organizativas (`dsa.msc`)** y generación automática de *Distinguished Names* (`DN`).
2. **Modelo de Anidamiento de Grupos AGDLP / AUGDLP** (`Account → Global → Universal → Domain Local → Permission`) con validación pedagógica en vivo y soporte *Drag & Drop*.
3. **Consola de Administración de Directivas de Grupo (`gpmc.msc`)** con almacén central de GPOs, *Orden de Precedencia Local (`Link Order #1, #2`)*, *Bloqueo de Herencia (`Block Inheritance`)*, *Vínculos Forzados (`Enforced / No Override`)* y *Filtrado de Seguridad (`Security Filtering`)*.
4. **Motor de Conjunto Resultante de Directivas (`rsop.msc` / RSoP)** que evalúa la herencia **LSDOU** paso a paso, justifica por qué gana cada directiva y simula el escritorio resultante de **Windows 11 Enterprise** del usuario.
5. **Generador en Vivo de Scripts Windows PowerShell (`deploy-adlab.ps1`)** y **Analizador de Buenas Prácticas (BPA)**.
6. **Retos Guiados Autocorregibles y Exportación/Importación de Escenarios (`.json`)** para exámenes y prácticas en el aula.

---

## 📸 Capturas de Pantalla de la Consola

Capturas reales de la aplicación.

### 1. Consola de Usuarios y Equipos (`dsa.msc`) y Validación Educativa AGDLP
Incluye árbol jerárquico de OUs, arrastrar y soltar (*Drag & Drop*) de usuarios/grupos y alertas pedagógicas cuando el alumno intenta vulnerar la arquitectura de ámbitos de Active Directory (por ejemplo, anidar un grupo `Domain Local` dentro de un grupo `Global`).

![Consola dsa.msc y Validación AGDLP](./docs/screenshots/01-dsa-msc-agdlp.png)

---

### 2. Administración de Directivas de Grupo (`gpmc.msc`) y Orden de Precedencia
Repositorio central *"Objetos de directiva de grupo"*, vinculación a OUs, reordenación de prioridad (`#1`, `#2`), activación de **Forzar (`Enforced`)**, **Bloquear Herencia (`Block Inheritance`)**, **Filtrado de Seguridad** y despliegue de paquetes `.msi`.

![Consola GPMC y Vínculos GPO](./docs/screenshots/02-gpmc-vinculos.png)

---

### 3. Motor de Simulación RSoP (`rsop.msc`) y Vista Previa de Cliente Windows 11
Calcula qué directivas se aplican finalmente a cualquier usuario del dominio siguiendo estrictamente el orden **Dominio → OU Padre → OU Hija**, mostrando la GPO ganadora, las directivas descartadas y el estado final de la estación de trabajo.

![Simulador RSoP por Usuario](./docs/screenshots/03-rsop-simulacion.png)

---

### 4. Retos Guiados Autocorregibles y Generador de Scripts PowerShell (`.ps1`)
Los alumnos pueden resolver escenarios con fallos reales verificados en tiempo real y exportar toda su infraestructura como un script oficial de **Windows PowerShell (`ActiveDirectory` & `GroupPolicy`)** listo para ejecutarse en un controlador de dominio real.

![Retos Autocorregibles](./docs/screenshots/04-retos-autocorregibles.png)

![Generador PowerShell y Analizador de Buenas Prácticas](./docs/screenshots/05-powershell-bpa.png)

### 5. Versión móvil

<img src="./docs/screenshots/06-movil.png" alt="ADLab en un móvil" width="300" />

---

## 🧠 Reglas de Arquitectura Simuladas con Precisión

### 1. Reglas de Anidamiento AGDLP / AUGDLP
El motor valida tanto las **reglas técnicas duras de Active Directory** como las **buenas prácticas de diseño de Microsoft**:

| Origen \ Destino | Grupo Global (`G`) | Grupo Universal (`U`) | Grupo Domain Local (`DL`) |
| :--- | :---: | :---: | :---: |
| **Usuario (`Account - A`)** | ✅ **Recomendado (A → G)** | ⚠️ *Advertencia AGDLP (replicación GC)* | ⚠️ *Advertencia AGDLP (asignación directa)* |
| **Grupo Global (`G`)** | ✅ Permitido (mismo dominio) | ✅ **Recomendado (G → U)** | ✅ **Recomendado (G → DL)** |
| **Grupo Universal (`U`)** | ❌ **Prohibido por AD** | ✅ Permitido | ✅ **Recomendado (U → DL)** |
| **Grupo Domain Local (`DL`)** | ❌ **Prohibido por AD** | ❌ **Prohibido por AD** | ⚠️ *Permitido en AD / Desaconsejado en AGDLP* |

> 💡 **Detección de Ciclos Kerberos/LSA**: El motor incluye un algoritmo de búsqueda en grafos (`DFS`) que impide referencias circulares entre grupos (ej. `Grupo A → Grupo B → Grupo A`).

---

### 2. Algoritmo de Resolución de Directivas de Grupo (RSoP / LSDOU)
Cuando se pulsa **"Calcular RSoP"** sobre un usuario, `ADEnvironment.calculateUserRSoP(userId)` ejecuta el flujo exacto de Windows Server:

1. **Herencia Descendente (`Dominio → OU Padre → OU Hija`)**: Las directivas se procesan desde la raíz `adlab.local` bajando por cada sub-OU hasta la OU donde reside el usuario. En caso de conflicto entre GPOs normales, **gana la más cercana al usuario**.
2. **Precedencia de Orden de Vínculo (`Link Order`)**: Si una misma OU tiene múltiples GPOs vinculadas, se evalúan de mayor a menor número (`#3 → #2 → #1`), de modo que el **Orden `#1`** sobrescribe al resto dentro de esa OU.
3. **Bloqueo de Herencia (`Block Inheritance`)**: Si una OU intermedia o final tiene activado `blockInheritance = true`, se vacía la cola de GPOs normales heredadas de niveles superiores.
4. **Vínculos Forzados (`Enforced / No Override`)**: Cualquier vínculo GPO con `enforced = true` es **inmune al Bloqueo de Herencia** y se aplica al final del procesamiento, teniendo máxima prioridad sobre cualquier directiva local de las OUs hijas. Entre varias forzadas gana la **más cercana a la raíz** y, dentro de la misma OU, la de **Orden de vínculo #1**.
5. **Filtrado de Seguridad (`Security Filtering`)**: Si una GPO restringe su ámbito a un grupo de seguridad concreto (ej. `GG_Ventas`), el motor comprueba si el usuario pertenece directa o transitivamente a dicho grupo antes de aplicar la directiva. Los grupos de **distribución** no cuentan (no forman parte del token de seguridad).
6. **Estado de GPO (`GPO Status`)**: como en GPMC, se puede deshabilitar la configuración de usuario (tapiz, proxy, cmd, regedit, Panel de control), la del equipo (AppLocker, Windows Update, software) o toda la GPO.
7. **Directivas de cuenta**: la longitud mínima de contraseña solo surte efecto desde GPOs vinculadas al dominio, igual que en Active Directory.

---

## 🎓 Flujo de Trabajo para Profesores y Alumnos

### Exportar e Importar Escenarios (`adlab-snapshot.json`)
1. El **profesor** diseña un escenario en la consola (o modifica uno existente introduciendo un fallo de herencia, un filtrado de seguridad incorrecto o una cadena AGDLP incompleta).
2. Desde el menú superior **Archivo → Exportar Laboratorio**, descarga el archivo `adlab-snapshot.json` y lo comparte con sus alumnos (Moodle, Classroom o GitHub).
3. El **alumno** abre ADLab en su navegador, pulsa **Archivo → Importar Laboratorio**, selecciona el archivo `.json`, diagnostica el problema con la herramienta **RSoP**, lo corrige y exporta su solución entregable.

### Retos Guiados Incluidos de Serie
En la pestaña **"Retos Guiados"**, la aplicación incluye **3 laboratorios autocorregibles**:
- **Reto 1 (Herencia GPO y Despliegue MSI)**: Diagnosticar por qué `Ana García` (`OU=Ventas`) no recibe el paquete `ERP_Cliente_2026.msi` debido a un bloqueo de herencia y forzar la directiva crítica del CISO desde la raíz del dominio.
- **Reto 2 (Arquitectura Completa AGDLP)**: Construir la cadena `Carlos Martínez (A) → Grupo Global (G) → Grupo Universal (U) → Grupo Domain Local (DL) → Modify:\\SRV-FS01\Auditorias$ (P)` sin romper las reglas de ámbito.
- **Reto 3 (Precedencia de Vínculo y Endurecimiento)**: Configurar el orden de vínculo `#1` para el anillo diferido de Windows Update en la OU `Sistemas` y bloquear `cmd.exe` y `regedit.exe` para `Elena Rodríguez`.

---

## 🚀 Instalación Local y Despliegue en GitHub Pages

### Uso en línea
Abre **[unfantasmaenelsistema.github.io/ADLab](https://unfantasmaenelsistema.github.io/ADLab/)**. El laboratorio se guarda en el navegador (`localStorage`); el menú **Archivo** permite exportarlo, importarlo o restaurarlo.

### Ejecución en Entorno Local
El proyecto usa [Bun](https://bun.sh/) (hay `bun.lock`):

```bash
git clone https://github.com/unfantasmaenelsistema/ADLab.git
cd ADLab
bun install
bun run dev          # servidor de desarrollo en http://localhost:3000
bun run lint         # comprobación de tipos
bun run build        # compilación estática en dist/
```

### Despliegue en GitHub Pages
El workflow [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) instala con Bun (`--frozen-lockfile`), comprueba los tipos, compila con `GITHUB_PAGES=true` (la app vive en `/ADLab/`) y publica `dist/` en cada `push` a `main`. En un *fork* basta con activar **Settings → Pages → Source → GitHub Actions** (y ajustar `base` en `vite.config.ts` si cambias el nombre del repositorio).

---

## 📂 Estructura del Proyecto

```text
├── .github/
│   └── workflows/
│       └── deploy.yml                  # CI/CD automático para GitHub Pages
├── docs/
│   └── screenshots/                    # Capturas reales de la aplicación (PNG)
├── src/
│   ├── adModel.js                      # Motor Vanilla JS (ES6): ADEnvironment, OU, User, Group, GPO, GPOLink, RSoP y PowerShell
│   ├── App.tsx                         # Interfaz de consolas MMC (dsa.msc, gpmc.msc, rsop.msc, Retos y BPA)
│   ├── index.css                       # Estilos base Tailwind CSS v4 y tipografía técnica
│   └── main.tsx                        # Punto de entrada de la aplicación
├── public/assets/aistudio/             # Logo de Un Fantasma en el Sistema
├── index.html
├── LICENSE                             # Apache 2.0
├── package.json / bun.lock
└── README.md
```

---

## 💻 Uso Programático desde la Consola del Navegador (DevTools)

Para fines didácticos avanzados, la instancia activa del laboratorio está expuesta globalmente en `window.adLab`:

```javascript
// Inspeccionar el estado completo en JSON
console.log(window.adLab.toJSON());

// Calcular el RSoP de cualquier usuario por ID
const ana = Object.values(window.adLab.users).find(u => u.samAccountName === 'agarcia');
console.table(window.adLab.calculateUserRSoP(ana.id).settingsTable);

// Generar por consola el script de despliegue en PowerShell
console.log(window.adLab.generatePowerShellDeploymentScript());
```

---

## 🆕 Novedades de la versión 2

- **Publicada en GitHub Pages** dentro de la organización: el despliegue fallaba siempre (el workflow usaba la caché de npm sin `package-lock.json`); ahora usa Bun y comprueba los tipos antes de publicar.
- **RSoP más fiel:** entre GPOs forzadas en la misma OU gana el Orden #1 (antes ganaba el último); se respeta el *Estado de GPO*; los grupos de distribución ya no cuentan para el filtrado de seguridad ni dan permisos; la longitud de contraseña solo se aplica desde el dominio.
- **Script PowerShell utilizable:** ya no intenta volver a vincular la *Default Domain Policy* (con `$ErrorActionPreference = "Stop"` se detenía); pide la contraseña inicial con `Read-Host` y obliga a cambiarla en el primer inicio de sesión, en lugar de llevar una fija; exporta el filtrado de seguridad (`Set-GPPermission`), el estado de cada GPO y la directiva de contraseñas del dominio; escapa comillas y `$` en los nombres, e indica los ajustes que hay que terminar en GPMC.
- **Retos:** el reto cargado se recuerda al recargar y la app avisa si consultas un reto cuyo escenario no está cargado.
- **Interfaz:** diseño adaptable a móvil, `Escape` cierra selectores y modales, y el aviso de error ya no muestra el flujo AGDLP cuando no viene al caso.
- Licencia Apache 2.0 incluida (antes solo se citaba) y eliminados los restos de la plantilla de AI Studio (Gemini, Express, `metadata.json`).

---

## 📄 Licencia

Distribuido bajo la licencia **Apache 2.0** (ver [LICENSE](LICENSE)). Libre para uso educativo en institutos, universidades y laboratorios de formación técnica.
