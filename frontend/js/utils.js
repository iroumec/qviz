// Small helpers shared by the viewer.

const SUBSCRIPTS = "\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089";

/** The label of a qubit, with the index as a subscript (like LaTeX `q_0`): q₀. */
export function qubitLabel(index) {
  const digits = String(index).split("").map((digit) => SUBSCRIPTS[Number(digit)]).join("");
  return "q" + digits;
}

/** A ket, like LaTeX `|0\rangle`: |0⟩. */
export function ket(bit) {
  return "|" + bit + "\u27e9";
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
