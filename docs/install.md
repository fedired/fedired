# Instalar Fedired

Esta guía instala Fedired en un servidor **Ubuntu Server 22.04 o 24.04**, con PostgreSQL, Redis y un proxy inverso con HTTPS.

> [!WARNING]
> Fedired se prueba sólo en Linux. En otros sistemas operativos no hay soporte: instálalo sólo si puedes resolver los problemas por tu cuenta.

## Requisitos

| Componente | Versión / recurso |
|---|---|
| Node.js | **26** (LTS) o superior |
| pnpm | **9.15.0** (vía corepack) |
| Rust (rustup) | **1.83** o superior (recomendado: `stable`) |
| Perl, con módulos core, y make | Necesarios para compilar OpenSSL (dependencia vendored de Rust) |
| PostgreSQL | 16, con la extensión **PGroonga** |
| Redis | cualquier versión reciente |
| FFmpeg | cualquier versión reciente |
| Servidor | 1 CPU, **4 GB de RAM** recomendados (el build necesita memoria; con 2 GB agrega swap) |
| Dominio | Un nombre de dominio que apunte a la IP del servidor |

Necesitas acceso `sudo` en el servidor.

## 1. Instalar dependencias del sistema

### Utilidades

```sh
sudo apt update
sudo apt install -y build-essential perl make python3 curl wget git lsb-release ca-certificates
```

### Node.js 26

```sh
NODE_MAJOR=26
curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
sudo apt install -y nodejs

# verificar: debe mostrar v26.x
node --version
```

### pnpm (vía corepack)

```sh
sudo corepack enable
corepack prepare pnpm@9.15.0 --activate

# verificar: debe mostrar 9.15.0
pnpm --version
```

### PostgreSQL 16 y PGroonga

Instrucciones oficiales de PostgreSQL: <https://www.postgresql.org/download/>

```sh
sudo install -d /usr/share/keyrings
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" | sudo tee /etc/apt/sources.list.d/pgdg.list

sudo apt update
sudo apt install -y postgresql-16
sudo systemctl enable --now postgresql
```

Instala PGroonga desde los paquetes precompilados (instrucciones oficiales: <https://pgroonga.github.io/install/ubuntu.html>):

```sh
wget https://packages.groonga.org/ubuntu/groonga-apt-source-latest-$(lsb_release --codename --short).deb
sudo apt install -y ./groonga-apt-source-latest-$(lsb_release --codename --short).deb
rm -f groonga-apt-source-latest-$(lsb_release --codename --short).deb
sudo apt update
sudo apt install -y postgresql-16-pgdg-pgroonga

# verificar: deben aparecer archivos pgroonga*
ls /usr/share/postgresql/16/extension/pgroonga*
```

### Redis

```sh
curl -fsSL https://packages.redis.io/gpg | sudo gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/redis.list
sudo apt update
sudo apt install -y redis

sudo systemctl enable --now redis-server
redis-cli ping   # debe responder PONG
```

### FFmpeg

```sh
sudo apt install -y ffmpeg
```

## 2. Crear la base de datos

Ejecuta estos comandos como administrador de la base de datos (`postgres`):

```sh
# 1. Usuario (te pedirá la contraseña)
sudo -u postgres createuser --no-createdb --no-createrole --no-superuser --encrypted --pwprompt fedired

# 2. Base de datos
sudo -u postgres createdb --encoding='UTF8' --owner=fedired fedired_db

# 3. Extensión PGroonga
sudo -u postgres psql --command='CREATE EXTENSION pgroonga;' --dbname=fedired_db
```

Si olvidaste la contraseña, restablécela con:

```sh
sudo -u postgres psql -c "ALTER USER fedired PASSWORD 'nueva-contraseña';"
```

## 3. Crear el usuario de Fedired y descargar el código

Fedired no debe ejecutarse como root. Crea un usuario dedicado:

```sh
sudo useradd --create-home --user-group --shell /bin/bash fedired
sudo su --login fedired

# debe mostrar /home/fedired
pwd
```

Los siguientes pasos se ejecutan **como usuario `fedired`**.

### Rust

```sh
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
. "${HOME}/.cargo/env"

# verificar: debe ser 1.83 o superior
cargo --version
```

### Clonar el repositorio

```sh
git clone --branch=main https://github.com/fedired/fedired.git
cd fedired
```

### Configuración

```sh
cp .config/example.yml .config/default.yml
nano .config/default.yml
```

Como mínimo, ajusta estos valores:

```yaml
url: https://tu-dominio.example.com  # URL pública final
port: 3000

db:
  host: localhost
  port: 5432
  db: fedired_db
  user: fedired
  pass: tu-contraseña-de-base-de-datos
```

> [!IMPORTANT]
> Una vez que el servidor esté en funcionamiento, **no cambies `url`**. Hacerlo rompe la federación con otros servidores.

El archivo `.config/default.yml` no se sube a git (está en `.gitignore`), así que sobrevive a las actualizaciones.

## 4. Construir Fedired e inicializar la base de datos

```sh
pnpm install --frozen-lockfile
NODE_ENV=production NODE_OPTIONS='--max-old-space-size=3072' pnpm run build
pnpm run migrate
```

- `pnpm install --frozen-lockfile` instala exactamente las versiones del `pnpm-lock.yaml`.
- El build tarda varios minutos (compila el módulo nativo en Rust).
- `pnpm run migrate` crea las tablas en `fedired_db`.

Cuando termine, cierra la sesión del usuario `fedired`:

```sh
exit
```

## 5. Preparar el servidor para publicarlo

### Firewall

Usamos [ufw](https://launchpad.net/ufw). Permite SSH antes de activarlo para no perder el acceso:

```sh
sudo apt install -y ufw
sudo ufw limit 22/tcp
sudo ufw default deny
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

# verificar
sudo ufw status
```

### Proxy inverso con Caddy

Caddy gestiona HTTPS automáticamente. También puedes usar Nginx con el [archivo de ejemplo](./fedired.nginx.conf).

```sh
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy

caddy version
```

Reemplaza el archivo de configuración:

```sh
sudo mv /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak
sudo nano /etc/caddy/Caddyfile
```

```Caddyfile
tu-dominio.example.com {
	# Timeouts largos: subida/procesado de imágenes (sharp) puede tardar.
	# Sin esto, Cloudflare muestra 502 Bad gateway mientras el origen aún trabaja
	# o cuando un worker se reinicia a mitad de la petición.
	reverse_proxy http://127.0.0.1:3000 {
		transport http {
			read_timeout 5m
			write_timeout 5m
			dial_timeout 10s
		}
	}

	request_body {
		max_size 100MB
	}

	log {
		output file /var/log/caddy/fedired.log
	}
}
```

```sh
sudo systemctl restart caddy
```

## 6. Ejecutar Fedired como servicio systemd

Antes de crear el servicio, confirma la ruta de `pnpm`, que se usa en `ExecStart`:

```sh
which pnpm   # normalmente /usr/bin/pnpm
```

Crea el archivo del servicio:

```sh
sudo nano /etc/systemd/system/fedired.service
```

```service
[Unit]
Description=Fedired daemon
Requires=redis.service caddy.service postgresql.service
After=redis.service caddy.service postgresql.service network-online.target

[Service]
Type=simple
User=fedired
Group=fedired
UMask=0027
ExecStart=/usr/bin/pnpm run start
WorkingDirectory=/home/fedired/fedired
Environment="NODE_ENV=production"
Environment="npm_config_cache=/tmp"
Environment="NODE_OPTIONS=--max-old-space-size=3072"
# Descomenta si usas jemalloc (la ruta varía según el sistema)
# Environment="LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libjemalloc.so.2"
StandardOutput=journal
StandardError=journal
SyslogIdentifier=fedired
TimeoutSec=60
Restart=always

CapabilityBoundingSet=
DevicePolicy=closed
NoNewPrivileges=true
LockPersonality=true
PrivateDevices=true
PrivateIPC=true
PrivateMounts=true
PrivateUsers=true
ProtectClock=true
ProtectControlGroups=true
ProtectHostname=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectKernelLogs=true
ProtectProc=invisible
RestrictNamespaces=true
RestrictRealtime=true
RestrictSUIDSGID=true
SecureBits=noroot-locked
SystemCallArchitectures=native
SystemCallFilter=~@chown @clock @cpu-emulation @debug @ipc @keyring @memlock @module @mount @obsolete @privileged @raw-io @reboot @resources @setuid @swap
SystemCallFilter=capset pipe pipe2 setpriority

[Install]
WantedBy=multi-user.target
```

Activa e inicia el servicio:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now fedired
```

## 7. Verificar la instalación

```sh
# estado del servicio
systemctl status fedired

# registros en tiempo real
journalctl -u fedired -f

# nodeinfo debe responder con JSON
curl -s https://tu-dominio.example.com/.well-known/nodeinfo
```

Abre `https://tu-dominio.example.com` en el navegador.

Si algo falla, revisa los registros con `journalctl -u fedired -n 200 --no-pager`.

## Actualizar

Consulta la guía [Actualizar Fedired](./upgrade.md).

## Alternativa: Docker (experimental)

Existe un [`docker-compose.example.yml`](../docker-compose.example.yml) y un [`Dockerfile`](../Dockerfile), pero **no está validado para producción**. Antes de usarlo ten en cuenta:

- El archivo de ejemplo monta el código fuente del host sobre `/fedired`, lo que tapa los archivos compilados dentro de la imagen.
- Su `command` reemplaza el arranque de la imagen (`start:container`), por lo que **las migraciones no se ejecutan automáticamente**. Debes ejecutar `pnpm run migrate` a mano.
- Requiere copiar `.config/docker_example.env` a `.config/docker.env` y `.config/example.yml` a `.config/default.yml`.

Si no tienes una razón concreta para usar Docker, sigue la instalación en Linux descrita arriba.
