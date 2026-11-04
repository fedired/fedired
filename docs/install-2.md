# Instalación rápida

Esta es una referencia resumida para servidores que **ya tienen** las dependencias instaladas. Si es tu primera instalación, sigue la [guía completa](./install.md), que explica cada paso.

## Requisitos

- Node.js **26** (LTS) o superior
- pnpm **9.15.0** (vía corepack)
- Rust **1.83** o superior
- Perl (con módulos core) y make, para compilar OpenSSL
- PostgreSQL 16 con la extensión PGroonga
- Redis
- FFmpeg

## Pasos

Como usuario `fedired`, en el directorio del proyecto:

```sh
# 1. Código y configuración
git clone --branch=main https://github.com/fedired/fedired.git
cd fedired
cp .config/example.yml .config/default.yml
nano .config/default.yml      # url, db.user, db.pass, db.db

# 2. Dependencias, build y migraciones
corepack prepare pnpm@9.15.0 --activate
pnpm install --frozen-lockfile
NODE_ENV=production NODE_OPTIONS='--max-old-space-size=3072' pnpm run build
pnpm run migrate

# 3. Iniciar
NODE_ENV=production pnpm run start
```

Para ejecutarlo como servicio systemd, sigue la sección 6 de la [guía completa](./install.md#6-ejecutar-fedired-como-servicio-systemd).

Para actualizar una instalación existente, sigue la guía [Actualizar Fedired](./upgrade.md).
