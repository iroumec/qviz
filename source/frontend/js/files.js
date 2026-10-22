// Pure helpers for the files of the viewer: which names are circuits and which
// entry of a manifest to show. They have no DOM and no network, so they are easy
// to test and to reuse.

/** True when the name has the extension of an OpenQASM circuit. */
export function isCircuitFile(name) {
  return /\.(qasm|qasm3|txt)$/i.test(name || "");
}

/** The usable entries of a manifest (or an empty list). */
export function manifestEntries(manifest) {
  if (!manifest || !Array.isArray(manifest.files)) return [];
  return manifest.files.filter((entry) => entry && typeof entry.file === "string" && entry.file);
}

/** True when the object follows the minimum contract of the viewer. */
export function isVisualization(obj) {
  return Boolean(obj) && Array.isArray(obj.steps)
    && Number.isInteger(obj.total_qubits) && obj.total_qubits >= 1;
}

/** The entry to load: the preferred one when it exists, or the first one. */
export function defaultFile(entries, preferred) {
  const names = (entries || []).map((entry) => entry.file);
  return names.includes(preferred) ? preferred : names[0] || "";
}
