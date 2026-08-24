/* Service Worker del panel ARIDO — Web Push para notificaciones de asignación. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "ARIDO", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "ARIDO";
  const options = {
    body: data.body || "",
    icon: "/icon-arido.png",
    badge: "/icon-arido.png",
    tag: data.tag,
    data: { url: data.url || "/admin/produccion" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

/**
 * Tocar la notificación tiene que llevarte a LO QUE TE AVISÓ.
 *
 * Antes esto hacía `return c.focus()` en cuanto encontraba una ventana abierta
 * y la `url` se tiraba a la basura: como el panel casi siempre está abierto,
 * tocar cualquier notificación solo traía al frente lo que ya tenías en
 * pantalla. Parecía que el enlace no servía; en realidad nunca se navegaba.
 *
 * Ahora: enfocar Y navegar. Si `navigate()` no está disponible (o lo bloquea el
 * navegador), se le manda un mensaje a la página para que navegue ella sola.
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/admin/produccion";

  event.waitUntil(
    (async () => {
      const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

      for (const c of list) {
        try {
          if ("focus" in c) await c.focus();
        } catch (e) { /* la ventana pudo cerrarse entre medias */ }

        if ("navigate" in c) {
          try {
            await c.navigate(url);
            return;
          } catch (e) { /* algunos navegadores lo bloquean: se usa el mensaje */ }
        }
        // Plan B: que la propia app navegue (router del cliente).
        try {
          c.postMessage({ type: "arido-navegar", url: url });
          return;
        } catch (e) { /* sigue con la siguiente ventana */ }
      }

      if (self.clients.openWindow) await self.clients.openWindow(url);
    })()
  );
});
