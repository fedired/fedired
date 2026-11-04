<div align="center">
  <img src="./title.svg" alt="Logo de Fedired" style="border-radius:50%" width="400"/>
</div>

# 🌎 **Fedired: Plataforma social descentralizada, de código abierto y gratuita para siempre** 🚀

<p align="center">
  <em>Open-source, decentralized social media platform – Free forever!</em>
</p>

<p align="center">
  <a href="https://github.com/fedired/fedired/actions/workflows/ci.yml"><img src="https://github.com/fedired/fedired/actions/workflows/ci.yml/badge.svg" alt="Estado del CI"/></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/licencia-AGPL--3.0-blue" alt="Licencia AGPL-3.0"/></a>
  <br/>
  <img src="https://img.shields.io/badge/Node.js-26-339933?logo=nodedotjs&logoColor=white" alt="Node.js 26"/>
  <img src="https://img.shields.io/badge/Rust-1.83%2B-DEA584?logo=rust&logoColor=white" alt="Rust 1.83 o superior"/>
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL 16"/>
  <img src="https://img.shields.io/badge/Redis-reciente-DC382D?logo=redis&logoColor=white" alt="Redis"/>
</p>

<p align="center">
  <a href="https://help.fedired.com/project/install.html" target="_blank" style="text-decoration: none;">
    <img src="https://img.shields.io/badge/🔧%20Instalación%20Fedired-Iniciar-blue?style=for-the-badge" alt="Botón de instalación de Fedired"/>
  </a>
</p>

<div align="center">
  <img src="./fedired-banner.png" alt="Banner de Fedired"/>
</div>

---

## 🤔 ¿Qué es Fedired?

**Fedired** es una plataforma de redes sociales libre y descentralizada. En lugar de depender de una única empresa que almacena y controla todos los datos, Fedired funciona como un conjunto de **instancias** (servidores) independientes que se comunican entre sí.

Gracias al protocolo **ActivityPub**, una persona con cuenta en una instancia puede seguir, responder y compartir contenido con personas de otras instancias del **Fediverso**. Tú decides cómo se administra tu servidor, qué reglas aplica y qué software ejecuta.

> [!WARNING]
> ⚠️ Actualmente enfrentamos algunos problemas con las actualizaciones de Fedired. Agradecemos tu paciencia mientras trabajamos para resolverlos.
>
> **¿Cómo puedes ayudar?** Si tienes experiencia en desarrollo o administración de sistemas, tu apoyo es muy valioso. La colaboración es voluntaria. 🙌

## 🧭 Navegación

- 🌐 [Instancia oficial](https://fedired.com)
- 📚 [Documentación](https://help.fedired.com)
- 💻 [Repositorio oficial](https://github.com/fedired/fedired)
## ✨ Características

- 🎨 **Interfaz personalizable:** ajusta la apariencia y el diseño de tu instancia para que refleje tu estilo.
- 😄 **Reacciones con emoji:** expresa tus emociones en cada publicación o comentario.
- 💬 **Mensajería flexible:** chats en tiempo real, grupos y conversaciones privadas.
- 🔓 **Descentralizada y abierta:** tú controlas tus datos y puedes contribuir al desarrollo de la plataforma.
- 🌐 **Integración con el Fediverso:** intercambia contenido con otras instancias que usan ActivityPub.

## 📦 Instalación

Fedired está pensado para ejecutarse en un servidor **Linux** con PostgreSQL (con la extensión PGroonga), Redis y un proxy inverso con HTTPS. Como resumen:

1. 🧱 Instala las dependencias del sistema (Node.js 26, pnpm 9.15.0, Rust 1.83+, PostgreSQL 16, Redis, FFmpeg, Perl y make).
2. 🗄️ Crea la base de datos y su usuario.
3. ⚙️ Clona el repositorio, copia `.config/example.yml` a `.config/default.yml` y ajusta la URL pública y la conexión a la base de datos.
4. 🛠️ Compila y crea las tablas.
5. 🚀 Ejecuta Fedired como servicio y colócalo detrás de un proxy con HTTPS.

Las guías detalladas están en la documentación:

- 📖 **Guía completa:** [docs/install.md](docs/install.md), con cada paso, firewall, proxy y servicio systemd.
- ⚡ **Referencia rápida:** [docs/install-2.md](docs/install-2.md), para servidores con las dependencias ya instaladas.
- ⬆️ **Actualizar:** [docs/upgrade.md](docs/upgrade.md). Para revertir una actualización, consulta [docs/downgrade.md](docs/downgrade.md).

### 🧰 Requisitos

| Componente | Versión |
|---|---|
| 🐧 Sistema operativo | **Linux** (la guía está escrita para Ubuntu Server 22.04 o 24.04) |
| 🟢 Node.js | 26 (LTS) |
| 📦 pnpm | 9.15.0 |
| 🦀 Rust | 1.83 o superior |
| 🐘 PostgreSQL | 16, con la extensión [PGroonga](https://pgroonga.github.io/) |
| 🔴 Redis | Reciente |
| 🎞️ FFmpeg | Reciente |
| 🐪 Perl (con módulos core) y make | Para compilar OpenSSL |

> [!NOTE]
> 🐧 Fedired solo es compatible con Linux. Los scripts de `package.json` usan sintaxis de shell POSIX, así que no funcionan directamente en Windows (en ese sistema solo sería posible con WSL).

## 🛠️ Desarrollo local

Estos pasos compilan y arrancan Fedired desde el código fuente. Necesitas PostgreSQL y Redis en funcionamiento.

```sh
# 1. 📦 Instalar dependencias exactamente como en pnpm-lock.yaml
pnpm install --frozen-lockfile

# 2. ⚙️ Crear la configuración (ajusta url, db.* y el resto de valores)
cp .config/example.yml .config/default.yml

# 3. 🔨 Compilar TypeScript, el cliente y el módulo nativo de Rust
NODE_ENV=production NODE_OPTIONS='--max-old-space-size=3072' pnpm run build

# 4. 🗃️ Crear las tablas en la base de datos
pnpm run migrate

# 5. 🚀 Arrancar
NODE_ENV=production pnpm run start
```

### ✅ Comprobaciones

| Comando | Qué verifica |
|---|---|
| `pnpm exec biome check packages/backend/src packages/client/src packages/fedired-js/src packages/sw/src` | 🧹 Lint y formato de TypeScript |
| `cargo fmt --all -- --check` | 🦀 Formato de Rust |
| `cargo test --workspace --no-run` | 🧪 Que las pruebas de Rust compilan (sin ejecutarlas) |

> [!TIP]
> 💡 Algunas pruebas de Rust necesitan servicios externos (Redis y PostgreSQL), por eso el CI solo verifica que compilan.

## 🤖 Integración continua

El CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) se ejecuta en cada push y pull request, y revisa:

- 🔍 La sintaxis de los propios workflows (actionlint).
- 🧹 El lint y el formato de TypeScript y Rust.
- 🏗️ Que el proyecto compile: TypeScript, cliente y el módulo nativo de Rust.
- 🔐 La ausencia de secretos en el código (gitleaks).
- 🛡️ La auditoría de dependencias (pnpm audit).

## 🤝 ¡Únete a Nosotros!

**Fedired** es más que una plataforma: es un movimiento hacia una red social más privada y descentralizada. ¡Ayúdanos a dar forma al futuro de las redes sociales! 🌱

- 🐞 **Reporta errores o propón mejoras** en los [issues](https://github.com/fedired/fedired/issues).
- 🔀 **Envía un pull request** con tus cambios.
## 👤 Autor y mantenimiento

**Fedired** es desarrollado y mantenido por **Javier Caceres** ([@srnovus](https://github.com/srnovus)) y se publica en la organización de GitHub [fedired](https://github.com/fedired). Para dudas o reportes, consulta [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) y [SECURITY.md](./SECURITY.md).

## 📄 Licencia

Fedired se distribuye bajo la [GNU Affero General Public License v3.0](./LICENSE) (AGPL-3.0). Puedes usarlo, estudiarlo, modificarlo y redistribuirlo bajo sus términos.

## ❓ Preguntas frecuentes (FAQs)

**🤑 ¿Es Fedired realmente gratis?**
Sí, **Fedired** es completamente gratuito y siempre lo será.

**🔒 ¿Cómo se protege mi privacidad en Fedired?**
**Fedired** se compromete a proteger la privacidad de sus usuarios y no vende datos personales.

**🌐 ¿Puedo hablar con personas de otras plataformas?**
Sí, siempre que la otra plataforma use ActivityPub, el protocolo del Fediverso.

## 🌱 Origen del proyecto

> [!IMPORTANT]
> Fedired es una bifurcación del proyecto **Firefish**, que a su vez era un fork de **Misskey**. Como Firefish ya no tiene mantenimiento, hemos decidido tomar el código y continuar su desarrollo para perfeccionarlo y adaptarlo a nuestras necesidades. 🛠️

<p align="center">
  <img src="https://app.greenweb.org/api/v3/greencheckimage/fedired.com?nocache=true" alt="Este sitio usa hosting verde, verificado por thegreenwebfoundation.org" width="200px" height="95px"/>
</p>
