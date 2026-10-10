// A small example, embedded in the page, so that the viewer is never empty when
// no file can be loaded. It is the two-qubit Bell circuit, already compiled.

export const DEMO = {
  backend: "demo → iones (referencia Aria)",
  total_qubits: 2,
  initial_fidelity: 99.5,
  steps: [
    {
      step: 1, operation: "virtual_z", targets: [0], cumulative_fidelity: 99.5,
      states: [[0, 0, 1], [0, 0, 1]], vibration: [0, 0], cumulative_cost: 0,
      probabilities: [[1, 0], [1, 0]], virtual_z: [3.141593, 0],
      inactivity: [0, 0], fidelities: [100, 100],
    },
    {
      step: 2, operation: "gpi2", targets: [0], phases: [1.570796],
      cumulative_fidelity: 99.47, states: [[1, 0, 0], [0, 0, 1]],
      vibration: [0, 0], cumulative_cost: 0.0003, probabilities: [[0.5, 0.5], [1, 0]],
      virtual_z: [3.141593, 0], inactivity: [0, 1], fidelities: [99.98, 99.99],
    },
    {
      step: 3, operation: "ms", targets: [0, 1], phases: [0, 0], angle: 0.25,
      cumulative_fidelity: 98.94, states: [[0, 0, 0], [0, 0, 0]],
      vibration: [0, 0], cumulative_cost: 0.0018,
      probabilities: [[0.5, 0.5], [0.5, 0.5]], virtual_z: [3.141593, 0],
      inactivity: [0, 1], fidelities: [99.46, 99.48],
    },
  ],
};
