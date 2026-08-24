// Toast global ultraligero: dispara un evento que escucha <Toaster/> en el layout.
export function toast(msg: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("arido-toast", { detail: msg }));
  }
}
