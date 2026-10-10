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

/** Write a message in the error line of the viewer. */
export function setError(message) {
  document.getElementById("error").textContent = message;
}
