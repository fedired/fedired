import { acct } from "fedired-js";
import type { PushNotificationDataMap } from "@/types";
import {
  closeNotificationsByTags,
  createEmptyNotification,
  createNotification,
} from "@/scripts/create-notification";
import { swLang } from "@/scripts/lang";
import * as swos from "@/scripts/operations";

// Event listener para la instalación del service worker
globalThis.addEventListener("install", () => {
  // Si es necesario, activar el control inmediato del SW
  // ev.waitUntil(globalThis.skipWaiting());
});

// Event listener para la activación del service worker
globalThis.addEventListener("activate", (ev) => {
  ev.waitUntil(cleanUpOldCaches());
});

// Función para limpiar las caches obsoletas
async function cleanUpOldCaches() {
  try {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((cacheName) => cacheName !== swLang.cacheName)
        .map((cacheName) => caches.delete(cacheName))
    );
    await globalThis.clients.claim();
  } catch (error) {
    console.error("Error during cache cleanup: ", error);
  }
}

// Función que devuelve el contenido HTML cuando el usuario está offline
function offlineContentHTML(): string {
  return `
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Desconectado</title>
    <style>
      *{font-family:BIZ UDGothic,Roboto,HelveticaNeue,Arial,sans-serif}
      body,html{background-color:#191724;color:#e0def4;justify-content:center;margin:auto;padding:10px;text-align:center}
      button{border-radius:999px;padding:0 12px;border:none;cursor:pointer;margin-bottom:12px}.button-big{background:linear-gradient(90deg,#c4a7e7,#ebbcba);line-height:50px}
      .button-big:hover{background:#31748f}.button-label-big{color:#191724;font-weight:700;font-size:20px;padding:12px}
      p{font-size:16px}#msg,.dont-worry{font-size:18px}.icon-warning{color:#f6c177;height:4rem;padding-top:2rem}
      h1{font-size:32px}code{font-family:Fira,FiraCode,monospace}@media screen and (max-width:500px){details{width:50%}}
    </style>
  </head>
  <body>
    <svg class="icon-warning" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
      <path d="M0 0h24v24H0z" fill="none" stroke="none"></path>
      <path d="M12 9v2m0 4v.01"></path>
      <path d="M5 19h14a2 2 0 0 0 1.84 -2.75l-7.1 -12.25a2 2 0 0 0 -3.5 0l-7.1 12.25a2 2 0 0 0 1.75 2.75"></path>
    </svg>
    <h1>¡Parece que estás desconectado!</h1>
    <button class="button-big" onclick="location.reload()"><span class="button-label-big">Recargar</span></button>
    <p class="dont-worry">Parece que Fedired no pudo conectarse al servidor, probablemente porque tu dispositivo no está conectado a internet o a la red.</p>
    <p>El Servidor Fedired instalado es la versión <code>${_VERSION_}</code></p>
  </body>
</html>
  `;
}

// Manejo de eventos de fetch
globalThis.addEventListener("fetch", (ev) => {
  if (isHTMLRequest(ev.request)) {
    ev.respondWith(fetchWithOfflineFallback(ev.request));
  }
});

// Función para determinar si la solicitud es HTML
function isHTMLRequest(request: Request): boolean {
  const fetchDest = request.headers.get("sec-fetch-dest");
  const acceptHeader = request.headers.get("accept");
  return fetchDest === "document" || acceptHeader?.includes("html") || request.url.endsWith("/");
}

// Función para manejar la respuesta de la solicitud de fetch con fallback offline
async function fetchWithOfflineFallback(request: Request): Promise<Response> {
  try {
    return await fetch(request);
  } catch (error) {
    return new Response(offlineContentHTML(), {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  }
}

// El cliente envía el idioma al registrar el SW (ver client/src/scripts/initialize-sw.ts).
// Sin esto, las notificaciones usaban el idioma por defecto en vez del del usuario.
globalThis.addEventListener("message", (ev) => {
  const data = (ev as MessageEvent).data;
  if (data?.msg === "initialize" && typeof data.lang === "string") {
    swLang.setLang(data.lang).catch((err) => console.error("Could not set SW language", err));
  }
});

// Event listener para notificaciones push
(globalThis as unknown as ServiceWorkerGlobalScope).addEventListener("push", (ev) => {
  ev.waitUntil(handlePushNotification(ev));
});

// Manejo de las notificaciones push
// Regla: cada push DEBE terminar mostrando una notificación (Chrome lo exige con userVisibleOnly).
async function handlePushNotification(ev: PushEvent): Promise<void> {
  try {
    const data: PushNotificationDataMap[keyof PushNotificationDataMap] | null = ev.data?.json() ?? null;
    if (!data) return createEmptyNotification();

    switch (data.type) {
      case "notification":
        // Ignorar notificaciones antiguas
        if (Date.now() - data.dateTime > 1000 * 60 * 60 * 24) return createEmptyNotification();
        return createNotification(data);
      case "unreadAntennaNote":
      case "unreadMessagingMessage":
        return createNotification(data);
      case "readAllNotifications":
        await closeNotifications();
        return createEmptyNotification();
      case "readAllMessagingMessages":
        await closeNotificationsByTags(await messagingTags());
        return createEmptyNotification();
      case "readAllMessagingMessagesOfARoom": {
        const body = data.body as { userId?: string; groupId?: string };
        const tag = body.userId ? `messaging:user:${body.userId}` : `messaging:group:${body.groupId}`;
        await closeNotificationsByTags([tag]);
        return createEmptyNotification();
      }
      default:
        return createEmptyNotification();
    }
  } catch (err) {
    console.error("Failed to handle push notification", err);
    return createEmptyNotification();
  }
}

// Tags de las notificaciones de chat (ver composeNotification en create-notification.ts)
async function messagingTags(): Promise<string[]> {
  const scope = globalThis as unknown as ServiceWorkerGlobalScope;
  const notifications = await scope.registration.getNotifications();
  return notifications
    .map((n) => n.tag)
    .filter((tag) => tag.startsWith("messaging:"));
}

// Cerrar todas las notificaciones
async function closeNotifications() {
  const notifications = await globalThis.registration.getNotifications();
  notifications.forEach((n) => {
    if (n.tag !== "read_notification") n.close();
  });
}

// Manejo de eventos de clic en notificación
(globalThis as unknown as ServiceWorkerGlobalScope).addEventListener("notificationclick", (ev) => {
  ev.waitUntil(handleNotificationClick(ev));
});

// Función para manejar el clic en la notificación
async function handleNotificationClick(ev: NotificationEvent) {
  const { action, notification } = ev;
  const data: PushNotificationDataMap[keyof PushNotificationDataMap] = notification.data ?? {};
  const { userId: loginId } = data;

  let client: WindowClient | null = null;
  
  switch (data.type) {
    case "notification":
      await handleNotificationAction(action, data, loginId);
      break;
    case "unreadAntennaNote":
      client = await swos.openAntenna(data.body.antenna.id, loginId);
      break;
    default:
      await handleDefaultAction(action, data, loginId);
  }

  if (client) client.focus();
  if (data.type === "notification") await swos.sendMarkAllAsRead(loginId);
  
  notification.close();
}

// Manejo de las acciones de la notificación
async function handleNotificationAction(action: string, data: any, loginId: string) {
  switch (action) {
    case "follow":
      if ("userId" in data.body) await swos.api("following/create", loginId, { userId: data.body.userId });
      break;
    case "showUser":
      if ("user" in data.body) await swos.openUser(acct.toString(data.body.user), loginId);
      break;
    case "reply":
      if ("note" in data.body) await swos.openPost({ reply: data.body.note }, loginId);
      break;
    case "renote":
      if ("note" in data.body) await swos.api("notes/create", loginId, { renoteId: data.body.note.id });
      break;
    case "accept":
      await handleAcceptAction(data, loginId);
      break;
    case "reject":
      await handleRejectAction(data, loginId);
      break;
    default:
      await swos.openClient("push", "/my/follow-requests", loginId);
  }
}

// Aceptar solicitud de seguimiento
async function handleAcceptAction(data: any, loginId: string) {
  if (data.body.type === "receiveFollowRequest") {
    await swos.api("following/requests/accept", loginId, { userId: data.body.userId });
  }
}

// Rechazar solicitud de seguimiento
async function handleRejectAction(data: any, loginId: string) {
  if (data.body.type === "receiveFollowRequest") {
    await swos.api("following/requests/reject", loginId, { userId: data.body.userId });
  }
}

// Manejo de acciones por defecto de la notificación
async function handleDefaultAction(action: string, data: any, loginId: string) {
  if (action === "close") return;
  await swos.openClient("push", "/my/notifications", loginId);
}
