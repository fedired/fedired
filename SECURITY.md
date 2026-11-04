# Política de seguridad de Fedired

La seguridad es una prioridad para Fedired y para las personas que usan nuestras instancias. Este documento explica cómo reportar una vulnerabilidad, qué esperar de nuestro proceso de respuesta y qué medidas puedes tomar para mantener tu instancia segura.

Si crees que has encontrado una vulnerabilidad, **no la publiques** en issues, redes sociales ni foros. Repórtala de forma privada como se describe a continuación.

## Índice

1. [Versiones compatibles](#1-versiones-compatibles)
2. [Cómo reportar una vulnerabilidad](#2-cómo-reportar-una-vulnerabilidad)
3. [Alcance](#3-alcance)
4. [Proceso de respuesta](#4-proceso-de-respuesta)
5. [Lineamientos para investigadores](#5-lineamientos-para-investigadores)
6. [Recomendaciones para usuarios y administradores](#6-recomendaciones-para-usuarios-y-administradores)
7. [Contacto y actualizaciones](#7-contacto-y-actualizaciones)

## 1. Versiones compatibles

Solo se publican correcciones de seguridad para la versión más reciente.

| Versión | Soporte de seguridad |
|---|---|
| `0.0.1-beta.1` (actual) | ✅ Sí |
| Versiones anteriores | ❌ No |

Si tu instancia usa una versión anterior, actualízala siguiendo la [guía de actualización](./docs/upgrade.md).

## 2. Cómo reportar una vulnerabilidad

Envía tu reporte a **[fedired@sushell.com](mailto:fedired@sushell.com)** con el asunto `[SEGURIDAD] Breve descripción`.

Incluye, en la medida de lo posible:

- **Descripción:** qué vulnerabilidad es y en qué componente se encuentra (ruta, endpoint, módulo o función).
- **Versión afectada:** la versión de Fedired o el commit en el que la encontraste.
- **Pasos para reproducirla:** una secuencia clara y, si es posible, una prueba de concepto mínima.
- **Impacto:** qué podría hacer un atacante (acceso no autorizado, divulgación de datos, ejecución de código, denegación de servicio, etc.).
- **Entorno:** sistema operativo, navegador y configuración relevante.
- **Mitigación:** si ya identificaste una solución o una medida temporal, compártela.

Nunca pruebes una vulnerabilidad contra cuentas, datos o servicios que no sean tuyos.

## 3. Alcance

### Dentro del alcance

- El código de este repositorio (`fedired/fedired`), incluidos el backend, el cliente, el módulo nativo de Rust y el proceso de instalación.
- La instancia oficial de Fedired.
- Las dependencias propias del proyecto cuando el problema se origina en nuestra configuración o en nuestro uso de ellas.

### Fuera del alcance

- Spam, ingeniería social o ataques dirigidos contra personas.
- Denegación de servicio volumétrica o pruebas de carga sin autorización.
- Escaneos automatizados sin un análisis que demuestre el impacto real.
- Vulnerabilidades en instancias de terceros: repórtalas a sus administradores. Si el origen está en el código de Fedired, también debes informarnos.
- Problemas en dependencias de terceros: repórtalos primero a su proyecto upstream y, si afectan a Fedired, avísanos.
- Problemas sin impacto demostrable, como encabezados HTTP opcionales, versiones de software sin vulnerabilidad conocida o autoataques (self-XSS).

## 4. Proceso de respuesta

1. **Acuse de recibo:** confirmaremos la recepción de tu reporte en un plazo razonable (normalmente en 72 horas).
2. **Evaluación:** verificaremos la vulnerabilidad, reproduciremos el problema y determinaremos su gravedad.
3. **Corrección:** prepararemos una solución y, cuando sea necesario, publicaremos una nueva versión con la corrección.
4. **Divulgación coordinada:** te pedimos que no hagas pública la vulnerabilidad hasta que exista una corrección o hasta 90 días después de tu reporte, lo que ocurra primero. Si necesitamos más tiempo, te lo comunicaremos con antelación.
5. **Reconocimiento:** si lo deseas, podemos acreditar tu contribución en las notas de la versión o en el aviso de seguridad correspondiente, sin revelar tu identidad si no lo autorizas.

Te mantendremos informado del progreso durante el proceso.

## 5. Lineamientos para investigadores

Si investigas de buena fe y sigues estos lineamientos, no iniciaremos acciones legales contra ti por tu investigación:

- Prueba solo en tus propias cuentas e instancias, o en una instancia de prueba que te pertenezca.
- No accedas, modifiques ni elimines datos de otras personas. Si los encuentras accidentalmente, detente y repórtalo.
- No degrades el servicio ni afectes a otros usuarios.
- Deja de investigar en cuanto confirmes la vulnerabilidad y repórtala.
- No extraigas más datos de los necesarios para demostrar el problema, y elimina cualquier dato que hayas obtenido.
- No divulgues la vulnerabilidad a terceros antes de la divulgación coordinada.

## 6. Recomendaciones para usuarios y administradores

Estas medidas ayudan a proteger tu cuenta y tu instancia:

- **Mantén Fedired actualizado** y aplica las actualizaciones de seguridad lo antes posible.
- **Mantén el sistema al día:** Node.js, PostgreSQL, Redis, Caddy o Nginx y el sistema operativo.
- **Protege los secretos:** el archivo `.config/default.yml` contiene contraseñas. Limita sus permisos (por ejemplo, `chmod 600`) y no lo subas a ningún repositorio.
- **No expongas servicios internos a Internet:** PostgreSQL y Redis deben escuchar solo en `localhost` o en una red privada.
- **Usa un firewall** y permite únicamente los puertos necesarios (SSH, HTTP y HTTPS).
- **Haz copias de seguridad** de la base de datos y de la configuración, y prueba periódicamente su restauración.
- **Usa contraseñas fuertes y únicas** para tus cuentas.
- **Activa la autenticación de dos factores (2FA)** si está disponible.
- **Mantente informado** sobre las actualizaciones de seguridad y las buenas prácticas.

## 7. Contacto y actualizaciones

Para cualquier duda sobre esta política, escribe a **[fedired@sushell.com](mailto:fedired@sushell.com)**.

Este documento puede actualizarse para reflejar cambios en nuestras políticas de seguridad o a partir de la retroalimentación de la comunidad.

Gracias por ayudarnos a mantener Fedired seguro.
