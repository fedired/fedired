# Actualizar Fedired

Esta guía explica cómo actualizar una instalación de Fedired en Linux que sigue la [guía de instalación](./install.md) (servicio systemd, usuario `fedired`, base de datos `fedired_db`).

> [!WARNING]
> Las migraciones de base de datos **no siempre se pueden revertir de forma segura**. Haz siempre un respaldo de la base de datos antes de actualizar (paso 1).

## Antes de empezar

1. Revisa los cambios de la versión en las [releases de Fedired](https://github.com/fedired/fedired/releases) o en el historial de commits de `main`. Busca notas sobre migraciones, cambios de configuración o cambios de requisitos.
2. Confirma que el servidor cumple los requisitos de la nueva versión:
   - Node.js **26** (LTS): `node --version`
   - pnpm **9.15.0**: `pnpm --version` (o `corepack prepare pnpm@9.15.0 --activate`)
   - Rust **1.83** o superior: `cargo --version`

Si Node es versión 20 o 22, actualízalo a 26 siguiendo el paso de Node.js de la [guía de instalación](./install.md#nodejs-26).

## 1. Respaldar la base de datos y la configuración

```sh
# crear la carpeta de respaldos (una sola vez)
sudo mkdir -p /home/fedired/backups
sudo chown fedired:fedired /home/fedired/backups

# volcar la base de datos en formato comprimido
sudo -u postgres pg_dump --format=custom --file=/tmp/fedired_db.dump fedired_db
sudo mv /tmp/fedired_db.dump /home/fedired/backups/fedired_db_$(date +%F).dump

# respaldar la configuración
sudo cp /home/fedired/fedired/.config/default.yml /home/fedired/backups/default_$(date +%F).yml
```

Confirma que el respaldo existe y no está vacío antes de continuar:

```sh
ls -lh /home/fedired/backups/
```

## 2. Detener el servicio

```sh
sudo systemctl stop fedired
```

## 3. Actualizar el código

Cambia al usuario `fedired` y ve al directorio del proyecto:

```sh
sudo su --login fedired
cd ~/fedired
```

Revisa si hay cambios locales:

```sh
git status
```

Si hay cambios que no reconoces, **no los descartes** sin revisarlos primero. Los archivos de `.config/` no aparecen aquí porque están en `.gitignore`.

Si el build modificó archivos en `packages/backend/assets`, restáuralos antes de actualizar:

```sh
git checkout -- packages/backend/assets
```

Descarga la nueva versión:

```sh
git fetch origin
git pull --ff-only origin main
```

`--ff-only` evita crear commits de merge por accidente. Si falla, hay cambios locales en conflicto; resuélvelos antes de continuar.

## 4. Instalar dependencias y construir

Sigue en el usuario `fedired`:

```sh
corepack prepare pnpm@9.15.0 --activate
pnpm install --frozen-lockfile
NODE_ENV=production NODE_OPTIONS='--max-old-space-size=3072' pnpm run rebuild
```

- `rebuild` ejecuta `clean` y luego `build`.
- La compilación de Rust puede tardar bastante la primera vez.

Sal del usuario `fedired`:

```sh
exit
```

## 5. Aplicar migraciones de base de datos

Si actualizaste el paquete de PGroonga, actualiza también la extensión en la base de datos (una sola vez):

```sh
sudo -u postgres psql --command='ALTER EXTENSION pgroonga UPDATE;' --dbname=fedired_db
```

Después, como el usuario `fedired`:

```sh
cd ~/fedired
pnpm run migrate
```

Revisa la salida: cada migración aplicada aparece listada. Si aparece un error, **no reinicies el servicio**; ve a la sección [Si algo falla](#si-algo-falla).

## 6. Iniciar el servicio

```sh
sudo systemctl start fedired
systemctl status fedired
```

Revisa los registros de arranque:

```sh
journalctl -u fedired -n 100 --no-pager
```

## 7. Verificar la actualización

- Abre `https://tu-dominio.example.com` y comprueba que carga.
- Inicia sesión con una cuenta existente.
- Comprueba la federación: `curl -s https://tu-dominio.example.com/.well-known/nodeinfo` debe devolver JSON con la versión nueva.

## Si algo falla

### El build o la instalación fallan

Limpia y vuelve a intentarlo, como el usuario `fedired`:

```sh
cd ~/fedired
pnpm run clean-all
pnpm install --frozen-lockfile
NODE_ENV=production NODE_OPTIONS='--max-old-space-size=3072' pnpm run build
```

### Las migraciones fallan o la base de datos quedó inconsistente

No vuelvas a ejecutar migraciones a ciegas. Vuelve a la versión anterior y restaura el respaldo:

```sh
sudo systemctl stop fedired

# como el usuario fedired: volver al commit anterior
cd ~/fedired
git log --oneline -5           # identifica el commit de la versión anterior
git checkout --detach <commit-anterior>
NODE_ENV=production NODE_OPTIONS='--max-old-space-size=3072' pnpm run rebuild
exit

# como root: restaurar la base de datos
sudo -u postgres pg_restore --clean --if-exists --dbname=fedired_db /home/fedired/backups/fedired_db_<fecha>.dump

sudo systemctl start fedired
```

> [!NOTE]
> La guía de downgrade (`downgrade.md`) es de una versión anterior y referencia recursos que ya no existen. Para volver atrás usa el respaldo de este procedimiento.
