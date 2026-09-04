/**
 * Se remonta en cada navegación dentro del panel (a diferencia de layout.tsx,
 * que persiste), y eso es lo que reinicia la animación de entrada.
 *
 * Envuelve sólo a {children}: el menú, el Toaster y la suscripción de tiempo
 * real viven en el layout y no se reinician al navegar.
 *
 * La animación es una clase de CSS (ver `.panel-entra` en globals.css), no un
 * componente de framer-motion — el motivo está explicado ahí.
 */
export default function PanelTemplate({ children }: { children: React.ReactNode }) {
  return <div className="panel-entra">{children}</div>;
}
