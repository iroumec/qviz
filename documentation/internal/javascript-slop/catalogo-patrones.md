# Catálogo de patrones de AI slop en JavaScript / TypeScript

Cada patrón indica la **clase de riesgo** por defecto (A seguro, B con riesgo, C estructural; ver SKILL.md) y cuándo **no** es slop. Si el patrón es la convención del proyecto, no se reporta. Los patrones marcados (TS) aplican solo a TypeScript.

Contenido:
1. Comentarios y JSDoc
2. Manejo de errores y promesas
3. Tipado (TS)
4. Sobreingeniería
5. Código muerto y placeholders
6. Imports, APIs y dependencias
7. Nombres y estilo
8. React / frontend
9. Node / backend
10. Tests
11. Estructura de archivos y arquitectura
12. Señales de bugs y seguridad (reportar, no "limpiar")

---

## 1. Comentarios y JSDoc

| Patrón | Clase | Cuándo NO es slop |
|---|---|---|
| Comentario de una línea que repite el código (`// incrementa el contador` sobre `count++`) | A | Explica el *por qué*, una restricción o un workaround |
| Comentario "narrativo" de varias líneas que describe en prosa lo que la firma ya dice | A | |
| JSDoc que repite nombres y tipos (`@param {string} name - the name`) en un archivo TS ya tipado | A | La librería exige JSDoc para generar docs o el proyecto usa JS puro con JSDoc como tipado |
| Separadores decorativos (`// ----- Helpers -----`, `// === Section ===`) | A | Convención del proyecto |
| Comentarios de "cambio" (`// removed X`, `// updated`, `// nuevo`) | A | |
| Lenguaje de relleno: "robusto", "gracefully", "asegura que", "enhanced", "optimized" | A | |
| Comentarios de duda o disculpa (`// no estoy seguro`, `// esto debería funcionar`) | B: puede esconder un bug, reportar | |
| Emojis en código, logs o comentarios | A | El proyecto los usa de forma consistente |
| TODO sin dueño, ticket ni contexto | B: preguntar antes de borrar | Referencia un ticket o es el estilo del equipo |
| Código comentado | A | Es un ejemplo referenciado en el spec |

Regla práctica: si borrar el comentario no hace perder información, sobra. Si el código necesita el comentario para entenderse, quizás el arreglo es renombrar, no comentar.

## 2. Manejo de errores y promesas

| Patrón | Clase | Cuándo NO es slop |
|---|---|---|
| `catch {}` vacío o solo con un comentario | B | Caso documentado (por ejemplo `JSON.parse` de entrada opcional) |
| `catch (e) { console.log(e) }` y seguir, devolviendo `null`/valor por defecto | B | Es una frontera (handler, job, listener) con política definida |
| `catch` que reemplaza el error real por uno genérico (`throw new Error("Algo salió mal")`), perdiendo causa y stack | B | Se define un error de dominio y se conserva `cause` |
| `try/catch` que solo loguea y re-lanza sin agregar contexto | B | |
| `try/catch` envolviendo código que no puede lanzar | A/B | |
| `.catch(() => defaultValue)` que oculta fallos de red o de datos | B | El fallback es requisito del spec |
| `.catch(console.error)` al final de promesas cuyo resultado importa | B | |
| Convertir errores a string sin saber su tipo (`String(e)`, `e.message` sobre `unknown`) | B | |
| Pirámide de `try/catch` anidados donde todos hacen lo mismo | B | Cada nivel trata un caso distinto |
| Chequeos de `null`/`undefined`/tipo sobre valores que los tipos o la validación previa ya garantizan | B | La entrada viene de afuera (HTTP, formularios, JSON, storage) |
| Operador `?.` / `??` / `\|\|` por todos lados "por las dudas" en datos garantizados | B | Datos opcionales de verdad; `\|\|` vs `??` cambia comportamiento con `0`, `""`, `false` |
| Promesas sin `await` ni manejo (flotantes), `async` sin `await` interno | B: puede ser un bug, reportar | La interfaz del framework exige `async` |
| `await` dentro de `for` cuando las operaciones son independientes (o `Promise.all` donde el orden importa) | B | Se requiere ejecución secuencial |
| `new Promise` envolviendo algo que ya devuelve promesa | A/B | |
| Mensajes de error muy largos y repetidos en vez de dejar propagar el original | B | |
| `try/catch` + `finally` redundante para recursos que ya se liberan solos | B | |

Principio: manejar errores en las **fronteras** del sistema y dejar propagar dentro del código confiable. Quitar un `try/catch` o un fallback cambia qué errores ve el llamador: siempre es clase B.

## 3. Tipado (TS)

| Patrón | Clase | Cuándo NO es slop |
|---|---|---|
| `as any`, o `: any` como atajo para silenciar al compilador | B | Frontera genuinamente dinámica, con comentario |
| Doble aserción `as unknown as T` sin validar | B | Test utilities puntuales |
| `@ts-ignore`, `@ts-nocheck` o `@ts-expect-error` sin motivo | B | Con explicación y referencia al problema |
| Aserciones `as T` o `!` (non-null) que ocultan casos reales de `null`/`undefined` | B | Invariante comprobada justo antes |
| `Record<string, any>`, `object`, `{}` o `Function` como tipo "comodín" | B | |
| Sobres genéricos (`{ status, data, error }`) inventados para respuestas que ya tienen tipo propio | B/C | El contrato HTTP del proyecto los usa |
| Tipos duplicados que replican otro tipo casi idéntico en vez de derivarlo (`Pick`, `Omit`, `ReturnType`, `z.infer`) | B/C | Separa capas (DTO vs dominio) por diseño |
| Enums/uniones/interfaces para un solo valor, o interfaces con una sola implementación | C | Está en el spec o se usa para tests/DI |
| Anotaciones redundantes donde la inferencia basta (`const n: number = 5`) | A | El proyecto exige tipos explícitos (regla de lint) |
| Tipos que contradicen lo que devuelve el código real | B: es un bug, reportar | |
| Tipado desparejo (partes exhaustivas, partes en `any`) | A/B | Migración gradual documentada |

Alinear con el `strict` real del `tsconfig`. No endurezcas tipos en masa: puede romper el build en archivos fuera del alcance.

## 4. Sobreingeniería

| Patrón | Clase | Cuándo NO es slop |
|---|---|---|
| Wrapper "pass-through" que solo reenvía argumentos a otra función | B | Aísla una librería externa por decisión de arquitectura |
| Helper de una línea usado una sola vez | A/B | Da un nombre útil a algo opaco |
| Clase con un solo método o sin estado (podría ser una función) | B/C | El proyecto usa clases para inyección de dependencias (Nest, etc.) |
| Factory/Builder/Strategy/Singleton que construye un solo tipo | C | |
| Interfaz/clase abstracta con una única implementación y sin segunda a la vista | C | Está en el spec o hay fakes en tests |
| Configuración, constantes o flags para valores que nunca varían | B | Vienen del spec o del entorno |
| Parámetros u opciones "por si acaso" que nadie usa | B | Parte de una API pública |
| Capas extra (service → manager → handler → util) que solo se delegan entre sí | C | Arquitectura declarada |
| `utils` / `helpers` / `common` que crece como cajón de sastre | C | Funciones realmente transversales y pequeñas |
| Re-exports, alias y shims de compatibilidad hacia atrás sin consumidores | B | API pública o paquete publicado |
| Reimplementar a mano lo que ya ofrece el lenguaje, la plataforma o una dependencia del proyecto (`lodash` para cosas nativas, o al revés) | B | |
| Dos librerías para lo mismo (`axios` y `fetch`, `moment` y `dayjs`, `jest` y `vitest`) | C: preguntar | |
| Lógica duplicada con variaciones menores en lugar de una función compartida | C | |

Antes de calificar algo como sobreingeniería, buscá los usos reales (`grep`, referencias del editor). Una abstracción con un solo uso hoy puede ser deliberada: si el spec o la arquitectura la mencionan, es clase D.

## 5. Código muerto y placeholders

| Patrón | Clase | Cuándo NO es slop |
|---|---|---|
| Imports sin usar | A | Efectos secundarios intencionales (`import "./polyfill"`), tipos importados solo para declaración |
| Variables, funciones o exports sin referencias | B | Se usan por convención de framework, reflexión, plugins, scripts, config o desde otro paquete del monorepo (verificar) |
| `console.log`/`debugger` de depuración olvidados | A | CLI/servidor que usa `console` como salida; logger del proyecto distinto |
| Código inalcanzable (después de `return`/`throw`) | A | |
| Condiciones constantes (`if (true)`, `while (false)`) | A | Feature flag deliberado |
| Funciones vacías o stubs (`() => {}`, `throw new Error("not implemented")`) | B: puede ser trabajo pendiente del spec | Callbacks no-op requeridos |
| `else` tras `return`/`throw` | A | Convención del proyecto |
| Ramas con cuerpos idénticos | A/B | |
| Variables intermedias que no aclaran nada | A | |
| Estados, props o parámetros que se reciben y nunca se leen | B | Parte de una interfaz pública |

Cuidado con falsos positivos en frameworks (Next, Nest, Express, Vue): muchos archivos y exports se cargan por convención o por decoradores, no por `import` explícito.

## 6. Imports, APIs y dependencias

| Patrón | Clase | Cuándo NO es slop |
|---|---|---|
| Importar paquetes o símbolos que no existen (nombre inventado o ruta de alias que el proyecto no tiene) | B: es un bug, reportar | |
| Métodos, hooks, props u opciones de config inventados que suenan plausibles | B: bug, reportar | |
| Paquete importado y no declarado en `package.json` (dependencia fantasma / transitiva) | B | |
| Dependencia declarada y no usada | B/C: preguntar | Se usa solo en config, scripts o en runtime por convención |
| Mezcla CJS/ESM en el mismo módulo (`require` junto a `import`) o extensiones inconsistentes en rutas relativas | B | El proyecto lo resuelve con un bundler |
| APIs o patrones obsoletos para la versión instalada (`var`, callbacks anidados, `substr`, `new Buffer`, `moment`, `request`, Pages Router en un proyecto App Router) | B | La versión mínima o la migración en curso los requiere |
| Imports profundos o relativos largos (`../../../`) donde el proyecto usa alias | A/B | |
| Imports circulares | C | |
| Importar toda una librería para usar una función (`import _ from "lodash"`) donde el proyecto importa por función | A/B | |
| Barrels (`index.ts`) que re-exportan todo sin criterio | C | Barrels deliberados de la API pública |

Para detectar imports inventados: verificá contra `node_modules`, `package.json` y `tsc --noEmit`. No asumas que algo no existe por no conocerlo; confirmá en la versión instalada.

## 7. Nombres y estilo

| Patrón | Clase | Cuándo NO es slop |
|---|---|---|
| Nombres genéricos o inflados: `data`, `result`, `temp`, `info`, `handleData`, `processItem`, `enhancedX`, `optimizedX`, `Manager`, `Helper` | B (renombrar toca llamadores) | Nombres del dominio del spec |
| Nombres inconsistentes con el vocabulario del proyecto/spec | B/D | |
| Estilo distinto al del resto del archivo (comillas, `function` vs flechas, `then` vs `async/await`, default vs named exports) | A | |
| Números y strings mágicos repetidos | A/B | |
| `if (x === true)`, `x ? true : false`, `return !!x` sobre booleanos | A | |
| Funciones largas, anidamiento profundo, muchos parámetros, muchos `if/else` | C: reportar, no refactorizar sin pedido | |
| Líneas en blanco excesivas, funciones minúsculas que fragmentan la lectura | A | |
| `var`, `==` en lugar de `===`, `for (let i...)` donde el proyecto usa `for...of`/métodos de array (o viceversa) | A | |
| Spread, copias y `JSON.parse(JSON.stringify())` innecesarios | A/B | La copia protege contra mutación |
| Mutación de argumentos o de estado compartido | B | |

## 8. React / frontend

| Patrón | Clase | Cuándo NO es slop |
|---|---|---|
| `useEffect` para calcular estado derivado (guardar en `useState` lo que se puede calcular en el render) | B | Hay sincronización real con algo externo |
| `useEffect` para trabajo disparado por un evento (clic, submit) que pertenece al handler | B | |
| Data fetching en `useEffect` al montar, con estados manuales de loading/error, cuando el proyecto usa React Query/SWR/loaders/Server Components | B/C | Es el patrón vigente del proyecto |
| Efectos sin cleanup, con dependencias de función inestables, `// eslint-disable-next-line react-hooks/exhaustive-deps` sin motivo | B: puede ser bug (closures viejos, carreras) | |
| `useMemo`/`useCallback`/`React.memo` por todos lados sin medición | B | Hay un problema de rendimiento comprobado o React Compiler no está activo y el proyecto lo exige |
| Estado duplicado o que se puede derivar de props/otro estado; estado global para algo local | B/C | |
| Prop drilling profundo "arreglado" con contexto de un solo consumidor, o contexto para algo que cambia seguido | C | |
| Componentes enormes que mezclan datos, lógica y presentación | C: reportar | |
| `key={index}` en listas dinámicas | B | Lista estática, sin reordenar |
| Mutación directa de estado o de props | B: bug | |
| Custom hooks de una línea que solo envuelven otro hook | B | Convención del proyecto |
| `any` en props/eventos (`(e: any)`), o `React.FC` en un proyecto que no lo usa | A/B | |
| Estilos inline o clases utilitarias distintas al sistema de diseño del proyecto; colores y espaciados hardcodeados | A/B | |
| Accesibilidad perdida: `div` clickeable en vez de `button`, imágenes sin `alt`, inputs sin `label` | B: reportar | |
| Código de servidor en componentes de cliente (o al revés), `"use client"` agregado "por las dudas" | B/C | Necesario por hooks o eventos |
| Fuentes, gradientes y componentes por defecto sin adaptar al diseño existente | B: reportar como observación de diseño, no tocar sin pedido | |

React: antes de quitar un efecto o un memo, confirmá que el comportamiento (orden de render, frecuencia de llamadas, parpadeos) no cambia. Es clase B aunque parezca trivial.

## 9. Node / backend

| Patrón | Clase | Cuándo NO es slop |
|---|---|---|
| Validación ausente o duplicada en distintos niveles de la misma ruta | B | Cada nivel valida algo diferente |
| `process.env.X` inventadas o sin validar al arrancar; defaults que ocultan configuración faltante | B | El spec define el default |
| Rutas, handlers o middlewares duplicados con variaciones menores | C | |
| Lógica de negocio dentro de los handlers/controladores en un proyecto con capa de servicios (o al revés) | C/D | |
| Consultas por concatenación de strings, `eval`, `child_process` con entrada externa | B: seguridad, reportar | |
| Operaciones de red/DB sin timeout, reintentos infinitos o sin backoff | B: reportar | |
| Callbacks anidados o `util.promisify` manual donde el proyecto usa `async/await` | B | |
| Manejo de errores distinto del resto del servidor (middleware de errores ignorado, `res.status(500)` repetido en cada ruta) | B/C | |
| Logging inconsistente (`console.log` en un proyecto con logger; logs ruidosos con emojis) | A/B | |
| Estado mutable a nivel de módulo (cachés, singletons) sin necesidad | B/C | |
| Scripts de `package.json` duplicados o inventados que no existen | B | |

## 10. Tests

| Patrón | Clase | Cuándo NO es slop |
|---|---|---|
| Asserts triviales (`toBeTruthy`, `toBeDefined`, `not.toThrow`) que no verifican el comportamiento | B: reportar, proponer mejora | |
| Tests que prueban el mock, no el comportamiento real | B | Test de integración con dependencia externa aislada a propósito |
| Tests que replican la implementación (mismo cálculo en el test y en el código) | B | |
| Snapshots masivos de componentes triviales | B | El proyecto los usa como convención |
| Mocks y setup duplicados en cada archivo en vez de compartirse | A/B | |
| Tests con `try/catch` que tragan el fallo, sin asserts, o `.skip`/`.only` olvidados | B: bug | |
| Nombres vagos (`it("works")`) | A | |
| Fixtures y helpers de test sin uso | A | |

No borres ni debilites tests para que "pasen". Si un test es slop, proponé qué debería verificar y esperá aprobación.

## 11. Estructura de archivos y arquitectura

Revisá el árbol completo del alcance, no solo los archivos sueltos.

| Patrón | Clase | Cuándo NO es slop |
|---|---|---|
| Archivos duplicados o casi iguales (`Foo.tsx`, `Foo.new.tsx`, `Foo2.tsx`, `foo-old.ts`, `foo.backup.js`, `*.copy.*`) | C | Versionado deliberado documentado |
| Archivos huérfanos: sin imports, sin referencias, sin ruta ni entry point | C | Rutas por convención del framework, scripts, config, plugins |
| Módulos "dios": un archivo enorme con muchas responsabilidades | C | |
| `utils.ts` / `helpers.ts` / `common.ts` / `misc.ts` en la raíz mezclando temas | C | Funciones realmente transversales y pequeñas |
| Un archivo por cada función/componente mínimo, con carpetas anidadas de un solo archivo | C | Estructura definida por el spec |
| `index.ts` que re-exporta todo sin criterio, o con lógica | C | Barrel deliberado de la API pública |
| Documentación suelta generada (`NOTES.md`, `SUMMARY.md`, `IMPLEMENTATION_PLAN.md`, `CHANGES.md`) fuera de `docs/` | C | Lo pide el spec |
| Scripts o páginas de prueba/demo sueltos (`test.js`, `tmp.js`, `scratch.ts`, `demo.html`, `playground/`) | C | |
| Tests fuera del árbol de tests, o árbol de tests que no espeja el código | C | Convención distinta del proyecto (co-ubicados) |
| Configuración duplicada o solapada (`config.js`, `settings.ts`, `constants.ts`, varios `.eslintrc`/`tsconfig` sin razón) | C | Monorepo con config por paquete |
| Violaciones de capas: UI importando infraestructura, componentes llamando directo a la DB, dominio importando framework | C/D | Es el patrón establecido del proyecto |
| Imports circulares entre módulos | C | |
| Layout inconsistente con el resto (mitad `src/` y mitad raíz; mezcla de `features/` y `components/` + `pages/`) | C | |
| Mezcla de JS y TS, o de CJS y ESM, sin plan de migración | C | Migración en curso documentada |
| Dependencias o tooling que el proyecto no pidió (segundo gestor de paquetes, otro linter/formatter, lockfiles múltiples) | C: preguntar | |
| Artefactos commiteados (`node_modules`, `dist`, `build`, `.next`, `.env`, `.DS_Store`, `coverage`) | C | Verificar `.gitignore`; si hay secretos, reportar urgente |

Reglas para proponer cambios estructurales:
- Respetá la arquitectura declarada en el spec/README/ADRs. Si algo la contradice, es clase D.
- Mover/renombrar es siempre aprobación individual y debe actualizar imports, alias de paths, barrels, config de herramientas, CI, Docker y docs. En frameworks con routing por archivos, mover cambia las URLs.
- Antes de borrar un archivo "huérfano", verificá referencias por nombre de módulo, strings, config y rutas del framework; algunos se cargan dinámicamente.
- Proponé el árbol destino en el reporte (antes → después) para que el usuario lo valide.

## 12. Señales de bugs y seguridad (reportar aparte, no "limpiar")

Si aparecen, se listan en una sección separada del reporte porque arreglarlos **sí** cambia el comportamiento:

- Imports, métodos, hooks, props o variables de entorno inexistentes; código que parece correcto pero falla en runtime.
- Secretos o credenciales hardcodeadas, `eval`/`new Function`, SQL por concatenación, `dangerouslySetInnerHTML` con entrada externa, CORS `*` con credenciales, verificación TLS desactivada (`rejectUnauthorized: false`).
- Mutación de estado de React, claves de lista inestables, closures viejos en efectos, promesas flotantes, carreras en data fetching.
- Operaciones de red sin timeout, listeners o intervalos sin limpiar, fugas de memoria evidentes.
- Tipos o JSDoc que contradicen lo que hace el código.

Estos no se corrigen dentro del flujo de limpieza salvo que el usuario lo apruebe explícitamente como cambio de comportamiento.
