// Isomorphic slug helper — usable en server y client (sin imports de servidor).
// Convierte el título de un beat en un slug para la URL: /beat/<slug>
export function slugify(title: string): string {
  return (
    title
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // quita acentos
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-") // todo lo no alfanumérico → guion
      .replace(/^-+|-+$/g, "") // sin guiones al inicio/fin
      .slice(0, 60) || "beat"
  );
}
