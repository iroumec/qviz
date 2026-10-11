# Guion del video demo de QViz (≈ 3 min, español)

Formato: grabación de pantalla con voz en off. Total cerca de 2:50, unas 370 palabras habladas.
La versión en inglés es `demo_video_script_en.md`.

**Antes de grabar**

- Grabá con el **Built-in simulator** (instantáneo y gratis). Probá IonQ Aria o Forte una vez fuera de cámara para asegurarte de que anda, pero no esperes un job en el video.
- Tené listo un `.qasm` para cargar (`resources/examples/qasm/qft3.qasm` o `ghz4.qasm`).
- Zoom del navegador al 100 %, ventana en 16:9 y el selector de circuito en `bell` al empezar.

| Tiempo | En pantalla | Voz en off |
|---|---|---|
| 0:00–0:15 | Página del proyecto en Qollab: título, project card y el botón **Run on Qollab**. | "Los computadores cuánticos son difíciles de imaginar. QViz muestra qué hace de verdad un computador de iones atrapados con tu circuito, compuerta por compuerta, con una esfera de Bloch por cada qubit." |
| 0:15–0:35 | Clic en **Run on Qollab**. Se abre el diálogo *Select QPU*. Pasar el mouse por *Built-in simulator* y luego por *IonQ Aria* y *Forte*. Pulsar **Run**. | "Lo ejecutamos en Qollab. QViz funciona con dos tipos de máquina: el simulador local y los sistemas de iones atrapados de IonQ, Aria y Forte. Los demás proveedores se rechazan a propósito, porque el visor muestra las compuertas nativas de IonQ. Elijo el simulador integrado y pulso Run." |
| 0:35–0:55 | Se abre el visor. Corre la intro: el haz recorre la cadena y todos los iones destellan. Paneo lento por la escena y después por los paneles izquierdo y derecho. | "Este es el visor. Cada ion de la cadena es un qubit, dibujado como una esfera de Bloch. Abajo está el chip de la trampa y arriba los láseres. A la izquierda, los detalles de la simulación y la fidelidad. A la derecha, la probabilidad de medir uno en cada qubit y el detalle del paso actual." |
| 0:55–1:20 | Abrir el selector de circuito y pasar de `bell` a `ghz3`. Luego clic en **Cargar circuito** y elegir `qft3.qasm`. La escena se recarga. Mostrar la línea de tiempo de abajo. | "Elegí uno de los circuitos de ejemplo o cargá tu propio archivo OpenQASM. QViz lo compila a las compuertas nativas de la máquina y la línea de tiempo de abajo muestra cada paso: una línea por qubit y una columna por compuerta." |
| 1:20–1:40 | Cámara: arrastrar para rotar, rueda para zoom, `W A S D` para moverse, espacio y Ctrl izquierdo para subir y bajar, clic derecho y arrastre para desplazar. Mostrar los botones de cámara en pantalla. | "La cámara es libre. Arrastrá para rotar, la rueda para acercar, W, A, S y D para moverte, espacio y control para subir y bajar. Si preferís usar solo el mouse, hay botones en pantalla." |
| 1:40–2:15 | Recargar `bell`. Pulsar **Play**. Pausar en un paso de un qubit (un láser sobre un ion, el vector gira). Pausar en el paso de dos qubits (haz naranja sobre dos iones, bus de fonones entre ellos, halo al terminar). Señalar la fidelidad bajando. Usar las flechas para ir y volver. | "Le damos a Play. Una compuerta de un qubit dispara un láser y ves girar el vector. Una de dos qubits dispara dos láseres naranjas y un bus de fonones une a los iones: así se entrelazan. Fijate que los vectores se acortan, porque un qubit entrelazado ya no está solo en un estado puro. Con cada compuerta baja la fidelidad y los iones que esperan sin hacer nada se ponen rojos. Con las flechas recorrés los pasos." |
| 2:15–2:35 | Clic en **+** junto a shots varias veces y luego en **Medir**. Se enciende el haz de lectura, los iones en |1⟩ brillan y emiten fotones, aparecen los badges |0⟩ y |1⟩. Una ventana lista cada resultado (por ejemplo `00`, `11`) con su barra de porcentaje; mostrarla un momento. | "Ahora medimos. Un haz de lectura ilumina la cadena: los iones en uno fluorescen y los que están en cero quedan oscuros. El resultado lo calcula el backend con la cantidad de shots que elegiste." |
| 2:35–2:55 | Clic en **Vista y accesibilidad**. Cambiar el perfil a *Alto contraste*, luego a *Daltonismo* y a *Movimiento reducido*. Abrir una sección y mover un deslizador (tamaño del texto o grosor del vector). | "Y está pensado para que lo pueda leer cualquiera. Este panel trae perfiles de enfoque, alto contraste, daltonismo y movimiento reducido, además de paletas, tamaño de texto, grosor del vector y brillo, y podés ocultar cualquier capa de la escena." |
| 2:55–3:00 | Volver a la escena con un circuito corriendo. Mostrar en pantalla el enlace de GitHub o de Qollab. | "QViz: mirá el circuito cuántico como lo ejecutan los iones. Probalo en Qollab." |

**Notas de edición**

- Mové el cursor despacio y dejá cada control resaltado en pantalla cerca de un segundo.
- Si una escena se alarga, recortá primero la de la cámara y después el segundo circuito.
- **Medir** muestrea el paso que está en pantalla: dejá que Play llegue al último paso (o saltá a él) antes de medir un Bell, así el resultado queda cerca de 50 % `00` y 50 % `11`.
- El paso de dos qubits es el momento clave del video: dale el mayor tiempo.
