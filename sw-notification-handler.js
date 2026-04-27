/* global self, clients */
// Imported by the Workbox-generated SW (see vite.config.ts → workbox.importScripts).
// Adds a `notificationclick` handler so tapping a reminder while the app is
// closed brings Forgettie to the foreground (or opens it cold).

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      const winClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      for (const c of winClients) {
        if ('focus' in c) {
          try {
            await c.focus()
            return
          } catch {
            // fall through to openWindow
          }
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow('/')
      }
    })(),
  )
})
