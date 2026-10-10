// Quantum Fourier transform of 3 qubits, applied to |101>.
OPENQASM 3.0;
include "stdgates.inc";

qubit[3] q;

x q[0];
x q[2];

h q[2];
cp(pi/2) q[1], q[2];
cp(pi/4) q[0], q[2];
h q[1];
cp(pi/2) q[0], q[1];
h q[0];
swap q[0], q[2];
