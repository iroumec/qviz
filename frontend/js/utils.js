// Small helpers shared by the viewer.

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
