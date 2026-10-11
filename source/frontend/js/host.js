// The two services that need Python: compile a circuit and measure a step.
// Each one asks the host (Qollab) when it gives the service, and the local server
// (scripts/server.py, `make server`) otherwise. Both run the same Python code, so
// the results are the same. There is no JavaScript fallback: without Python the
// viewer cannot compile or measure, and it says so.

import { COMPILE_URL, HOST, SAMPLE_URL } from "./config.js";
import { t } from "./utils.js";

/** POST to the local server and return the parsed reply, or throw a readable error. */
async function post(url, body, what) {
  let response;
  try {
    response = await fetch(url, { method: "POST", body });
  } catch (error) {
    throw new Error(t(
      "no hay conexión con el servidor. Usá `make server`.",
      "there is no connection to the server. Run `make server`."
    ));
  }
  if ([404, 405, 501].includes(response.status)) {
    throw new Error(t(
      "este servidor no tiene Python (sin Qollab ni `make server`), no puede " + what + ".",
      "this server has no Python (neither Qollab nor `make server`), it cannot " + what + "."
    ));
  }
  const reply = await response.json();
  if (!response.ok) throw new Error(reply.error || "error " + response.status);
  return reply;
}

/** Compile a circuit written in OpenQASM 2 or 3; returns the visualization. */
export function compileQasm(text) {
  if (HOST.compileQasm) return HOST.compileQasm(text);
  return post(COMPILE_URL, text, t("compilar circuitos", "compile circuits"));
}

/** Measure a step of a visualization; returns [[bitstring, count], ...]. */
export function sampleStep(data, step, shots) {
  if (HOST.sample) return HOST.sample(data, step, shots);
  const query = `?step=${step}&shots=${shots}`;
  return post(SAMPLE_URL + query, JSON.stringify(data), t("medir", "measure"));
}
