import type { Metadata } from "next";
import { AridoNavbar } from "@/components/arido/Navbar";
import { AridoFooter } from "@/components/arido/Footer";
import { SOCIALS } from "@/lib/site";

export const metadata: Metadata = {
  title: "Política de Privacidad",
  description:
    "Política de privacidad de Árido Music Group / Latino Gang Beats: cómo recopilamos, usamos y protegemos tus datos, incluida la mensajería de Instagram.",
  alternates: { canonical: "https://aridomusicgroup.com/privacidad" },
  openGraph: {
    title: "Política de Privacidad — Árido Music Group",
    description:
      "Cómo recopilamos, usamos y protegemos tus datos, incluida la mensajería de Instagram.",
    url: "https://aridomusicgroup.com/privacidad",
    locale: "es_MX",
    type: "website",
  },
};

const LAST_UPDATED = "8 de julio de 2026";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-xl sm:text-2xl font-bold text-[var(--fg)] mb-3">
        {title}
      </h2>
      <div className="space-y-3 text-[var(--fg-2)] leading-relaxed text-sm sm:text-base">
        {children}
      </div>
    </section>
  );
}

export default function PrivacidadPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <AridoNavbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-8 pt-28 pb-24">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[var(--fg)]">
          Política de Privacidad
        </h1>
        <p className="mt-3 text-sm text-[var(--fg-2)]">
          Última actualización: {LAST_UPDATED}
        </p>

        <p className="mt-6 text-[var(--fg-2)] leading-relaxed text-sm sm:text-base">
          En Árido Music Group y Latino Gang Beats (&ldquo;nosotros&rdquo;,
          &ldquo;nuestro&rdquo;) respetamos tu privacidad. Esta política explica
          qué datos recopilamos, cómo los usamos y cuáles son tus derechos cuando
          interactúas con nuestro sitio web{" "}
          <a
            className="text-[#c42f42] hover:underline"
            href="https://aridomusicgroup.com"
          >
            aridomusicgroup.com
          </a>{" "}
          y con nuestros canales de mensajería, incluido Instagram Direct.
        </p>

        <Section title="1. Información que recopilamos">
          <p>Podemos recopilar los siguientes datos:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Datos de mensajería de Instagram:</strong> cuando nos
              escribes por mensaje directo (DM) en{" "}
              <a
                className="text-[#c42f42] hover:underline"
                href={SOCIALS.instagramLGB}
              >
                @latinogangbeats
              </a>
              , recibimos el contenido de tus mensajes, tu identificador de
              usuario de Instagram y el nombre de usuario público, con el fin de
              responder a tus consultas.
            </li>
            <li>
              <strong>Datos de contacto:</strong> nombre, correo electrónico,
              teléfono o usuario de redes sociales que nos proporciones
              voluntariamente al cotizar o contactarnos.
            </li>
            <li>
              <strong>Datos de compra:</strong> al adquirir beats o servicios, el
              procesamiento de pagos lo realiza Stripe; nosotros no almacenamos
              datos completos de tarjetas.
            </li>
            <li>
              <strong>Datos de uso del sitio:</strong> estadísticas de
              navegación, clics e interacción mediante herramientas de analítica
              y, con tu consentimiento, grabación de sesión (una reproducción de
              cómo usas la página, con los campos sensibles enmascarados
              automáticamente). Ver la sección 9.
            </li>
          </ul>
        </Section>

        <Section title="2. Cómo usamos tu información">
          <ul className="list-disc pl-6 space-y-2">
            <li>
              Responder tus mensajes y consultas, incluido el uso de un asistente
              de inteligencia artificial que genera respuestas automáticas a tus
              DMs de Instagram.
            </li>
            <li>Procesar cotizaciones, pedidos y licencias de beats.</li>
            <li>Brindar soporte y atención al cliente.</li>
            <li>Mejorar nuestros servicios y la experiencia del sitio.</li>
          </ul>
        </Section>

        <Section title="3. Asistente de IA en la mensajería">
          <p>
            Para agilizar la atención, los mensajes que envías por Instagram
            Direct pueden ser procesados por un asistente de inteligencia
            artificial que genera respuestas automáticas. El contenido del
            mensaje se envía de forma segura al proveedor de IA únicamente para
            generar la respuesta. No usamos tus mensajes para entrenar modelos de
            IA ni para fines distintos a atender tu solicitud.
          </p>
        </Section>

        <Section title="4. Con quién compartimos tu información">
          <p>
            No vendemos tus datos. Compartimos información estrictamente
            necesaria con proveedores que nos ayudan a operar:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Meta Platforms (Instagram):</strong> para recibir y
              responder mensajes a través de la API oficial de Instagram.
            </li>
            <li>
              <strong>Proveedores de inteligencia artificial:</strong> para
              generar respuestas automáticas a tus mensajes.
            </li>
            <li>
              <strong>Stripe:</strong> para procesar pagos de forma segura.
            </li>
            <li>
              <strong>
                Herramientas de analítica (PostHog, Microsoft Clarity y Vercel):
              </strong>{" "}
              para medir el uso del sitio y mejorar la experiencia. Ver la
              sección 9.
            </li>
            <li>
              <strong>Proveedores de infraestructura y bases de datos:</strong>{" "}
              para almacenar de forma segura las conversaciones y los pedidos.
            </li>
          </ul>
        </Section>

        <Section title="5. Conservación de datos">
          <p>
            Conservamos tus mensajes y datos de contacto solo durante el tiempo
            necesario para atender tu solicitud y cumplir obligaciones legales o
            contables. Puedes solicitar su eliminación en cualquier momento.
          </p>
        </Section>

        <Section title="6. Tus derechos">
          <p>
            Tienes derecho a acceder, corregir o eliminar tus datos personales, y
            a retirar tu consentimiento. Para ejercerlos, escríbenos a{" "}
            <a
              className="text-[#c42f42] hover:underline"
              href={`mailto:${SOCIALS.email}`}
            >
              {SOCIALS.email}
            </a>
            . También puedes dejar de interactuar con nuestra cuenta de Instagram
            en cualquier momento.
          </p>
        </Section>

        <Section title="7. Eliminación de datos">
          <p>
            Si deseas que eliminemos los datos asociados a tus conversaciones de
            Instagram u otros datos personales, envía un correo a{" "}
            <a
              className="text-[#c42f42] hover:underline"
              href={`mailto:${SOCIALS.email}`}
            >
              {SOCIALS.email}
            </a>{" "}
            con el asunto &ldquo;Eliminación de datos&rdquo; e incluye tu usuario
            de Instagram. Procesaremos tu solicitud en un plazo razonable.
          </p>
        </Section>

        <Section title="8. Seguridad">
          <p>
            Aplicamos medidas técnicas y organizativas razonables para proteger
            tu información contra accesos no autorizados, pérdida o alteración.
          </p>
        </Section>

        <Section title="9. Cookies y analítica de comportamiento">
          <p>
            Usamos cookies propias y de terceros y herramientas de analítica
            para entender cómo se usa el sitio y mejorarlo. Estas herramientas{" "}
            <strong>
              no se activan hasta que aceptas el aviso de cookies
            </strong>{" "}
            que aparece al entrar; puedes rechazarlas y el sitio funciona igual.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>PostHog</strong> y <strong>Microsoft Clarity:</strong>{" "}
              analítica de producto, mapas de calor y grabación de sesión. La
              grabación de sesión reproduce tu interacción con la página
              (movimientos, clics y desplazamiento) para detectar problemas de
              usabilidad. Los campos sensibles (como los datos de pago) se
              enmascaran automáticamente y el pago se procesa en Stripe fuera de
              nuestra grabación.
            </li>
            <li>
              <strong>Vercel Web Analytics:</strong> estadísticas de tráfico
              agregadas, sin cookies y sin identificarte personalmente.
            </li>
          </ul>
          <p>
            <strong>Tu control:</strong> puedes rechazar la analítica desde el
            aviso de cookies. Si aceptaste y quieres revertirlo, borra los datos
            del sitio (cookies y almacenamiento local) en tu navegador y el aviso
            volverá a preguntarte. También puedes usar el modo de no rastreo o
            los bloqueadores de tu navegador.
          </p>
        </Section>

        <Section title="10. Cambios a esta política">
          <p>
            Podemos actualizar esta política ocasionalmente. Publicaremos la
            versión vigente en esta página con su fecha de actualización.
          </p>
        </Section>

        <Section title="11. Contacto">
          <p>
            Si tienes dudas sobre esta política o sobre el tratamiento de tus
            datos, contáctanos:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              Correo:{" "}
              <a
                className="text-[#c42f42] hover:underline"
                href={`mailto:${SOCIALS.email}`}
              >
                {SOCIALS.email}
              </a>
            </li>
            <li>
              Instagram:{" "}
              <a
                className="text-[#c42f42] hover:underline"
                href={SOCIALS.instagramLGB}
              >
                @latinogangbeats
              </a>
            </li>
            <li>WhatsApp: {SOCIALS.whatsappDisplay}</li>
          </ul>
        </Section>
      </div>
      <AridoFooter />
    </main>
  );
}
