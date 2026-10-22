// The language of the viewer. The choice is kept in the browser and applied by
// reloading the page, because the texts of every module are built when the
// module is evaluated (see `isEnglish` in utils.js).

import { isEnglish } from "./utils.js";

const STORAGE_KEY = "qviz.lang";

/** Wire the language button in the header: Spanish <-> English. */
export function initLanguage() {
  const button = document.getElementById("langToggle");
  if (!button) return;
  const english = isEnglish();
  button.lang = english ? "es" : "en";
  button.textContent = english ? "Español" : "English";
  button.setAttribute(
    "aria-label",
    english ? "Cambiar a español" : "Switch to English"
  );
  button.title = button.getAttribute("aria-label");
  button.addEventListener("click", () => {
    const next = english ? "es" : "en";
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch (error) {
      // The storage can be blocked (private window, sandboxed frame).
    }
    document.documentElement.lang = next;
    window.location.reload();
  });
}
