// Small helpers shared by the viewer.

const SUBSCRIPTS = "\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089";

/** The label of a qubit as text, with the index as a subscript: q₀. Used on the
 * canvas textures, where MathML cannot be drawn. */
export function qubitLabel(index) {
  const digits = String(index).split("").map((digit) => SUBSCRIPTS[Number(digit)]).join("");
  return "q" + digits;
}

/** A ket as text: |0⟩. Used on the canvas textures. */
export function ket(bit) {
  return "|" + bit + "\u27e9";
}

/** The label of a qubit as inline MathML: q with its index as a subscript. */
export function qubitMath(index) {
  return `<math><msub><mi>q</mi><mn>${index}</mn></msub></math>`;
}

/** A ket as inline MathML. */
export function ketMath(bit) {
  return `<math><mo>|</mo><mn>${bit}</mn><mo>\u27e9</mo></math>`;
}

/** The probability of measuring 1, as inline MathML: p(|1⟩). */
export function probOneMath() {
  return `<math><mi>p</mi><mo>(</mo><mo>|</mo><mn>1</mn><mo>\u27e9</mo><mo>)</mo></math>`;
}

/** The readout correction, as inline MathML: p' = 0.5 + (p − 0.5)·f. */
export function probCorrectionMath() {
  return "<math><msup><mi>p</mi><mo>\u2032</mo></msup><mo>=</mo><mn>0.5</mn><mo>+</mo>" +
    "<mo>(</mo><mi>p</mi><mo>\u2212</mo><mn>0.5</mn><mo>)</mo><mo>\u22c5</mo><mi>f</mi></math>";
}

/** Show a plain message in the stage, when the scene cannot be built. */
export function showStageMessage(text) {
  document.getElementById("stage").innerHTML =
    `<p class="hint" style="padding:20px">${text}</p>`;
}

/** Escape a string before it is inserted into the document as HTML. */
export function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
}

/** Write a message in the error line of the viewer (red). */
export function setError(message) {
  const line = document.getElementById("error");
  line.classList.remove("status");
  line.textContent = message;
}

/** Write a progress message in the same line, in the accent color, not red. */
export function setStatus(message) {
  const line = document.getElementById("error");
  line.classList.add("status");
  line.textContent = message;
}

/** True when the page language (`<html lang>`) is English. */
export function isEnglish() {
  const lang = (typeof document !== "undefined" && document.documentElement
    && document.documentElement.lang) || "es";
  return lang.toLowerCase().startsWith("en");
}

/** Hide the error card of the stage, if there is one. */
export function clearErrorCard() {
  const card = document.getElementById("errorCard");
  if (card) card.remove();
}

/**
 * Tell that a circuit could not be shown: the red line of the viewer, and a
 * card over the stage that cannot be missed. A machine that is not supported
 * (`error.kind`, set by the Qollab prelude) gets its own title and a hint.
 */
export function reportError(error) {
  const unsupported = error && error.kind === "UnsupportedProviderError";
  const title = unsupported ? "Máquina no soportada" : "No se pudo mostrar el circuito";
  const hint = unsupported
    ? "Elegí un backend de IonQ (Aria o Forte) o el simulador integrado y ejecutá de nuevo."
    : "Revisá el circuito o elegí otro de la lista.";
  const message = error && error.message ? error.message : String(error);
  // The text of a machine that is not supported is Spanish; the message of the
  // backend (with the detected machine) goes below it, as the detail.
  const lead = unsupported ? "Esta máquina todavía no está soportada por QViz." : message;
  setError(title);

  clearErrorCard();
  const card = document.createElement("div");
  card.id = "errorCard";
  card.className = "error-card";
  card.setAttribute("role", "alert");
  card.innerHTML = `<button type="button" class="close" aria-label="Cerrar">&times;</button>` +
    `<h2>${escapeHtml(title)}</h2><p>${escapeHtml(lead)}</p>` +
    `<p class="error-hint">${escapeHtml(hint)}</p>` +
    (unsupported ? `<p class="error-detail">${escapeHtml(message)}</p>` : "");
  card.querySelector(".close").addEventListener("click", clearErrorCard);
  document.querySelector(".stage-wrap").appendChild(card);
}
