# Fedired ↔ Sushell / Ordo ID (join ecosistema)

Contacto: contacto.javieroficial@gmail.com · env=production · `/xd` solo join

## Objetivo

Un cliente inicia sesión en [sushell.com](https://sushell.com) (Ordo ID) y puede usar Fedired (`fedired.com`) con la misma identidad, junto a FELvus, Orbit_, Dominus y OriginLabs.

```
[Cliente]
    │  login Ordo ID / sesión Sushell
    ▼
[sushell.com hub]
    ├─ ProductPortal ticket ──▶ felvus.sushell.com / orbit.sushell.com
    ├─ Ordo ID / OIDC ─────────▶ fedired.com (identidad + red)
    ├─ Suite API (/api/suite/v1) ◀──▶ apps first-party
    ├─ API v1 Bearer sh_ ──────────▶ Dominus (AI / créditos)
    └─ MCP URL + sh_ ──────────────▶ OriginLabs
```

## Estado en Fedired (esta entrega)

- UI móvil estilo X + branding Fedired / Tangerine
- Botón **Continuar con Ordo ID** en login → `https://sushell.com/?ordo=fedired&return_to=…`
- Centro Ordo en bottom nav móvil (abre Sushell)
- **Pendiente (siguiente PR):** OIDC callback completo (`/.well-known` Sushell → crear/enlazar usuario Fedired, `public_id = Ordo sub`)

## Checklist join (cuando se cablee OIDC)

1. Cliente Ordo interno `ORDO_CLIENT_ID_FEDIRED` + redirect `https://fedired.com/ordo/callback`
2. Issuer: `https://sushell.com` · `ORDO_INTERNAL_ONLY=1` en hub
3. Fedired: exchange code → userinfo → `users.ensure` / link por `sub`
4. Smoke: login hub → Fedired sesión local → plan assert (si Suite) OK

## Secretos (prod)

- No mezclar canales: humano / suite / `sh_`
- SSO bridge solo para subdominios Sushell; Fedired usa OIDC first-party
- Contacto join: contacto.javieroficial@gmail.com

`/xd · solo join ecosistema · Fedired · 2026-11-14`
