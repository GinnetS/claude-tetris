# Tetris

Implementación del clásico **Tetris** en JavaScript vanilla, usando HTML5 Canvas y CSS. Sin dependencias externas, sin frameworks, sin proceso de build: solo abrir y jugar.

![Tech](https://img.shields.io/badge/HTML5-Canvas-orange)
![Tech](https://img.shields.io/badge/CSS3-blueviolet)
![Tech](https://img.shields.io/badge/JavaScript-Vanilla-yellow)

---

## Tabla de contenidos

- [Tetris](#tetris)
  - [Tabla de contenidos](#tabla-de-contenidos)
  - [Qué hace el proyecto](#qué-hace-el-proyecto)
  - [Cómo ejecutar el juego](#cómo-ejecutar-el-juego)
    - [Opción 1: abrir el archivo directamente](#opción-1-abrir-el-archivo-directamente)
    - [Opción 2: servidor local (recomendado)](#opción-2-servidor-local-recomendado)
  - [Controles](#controles)
  - [Cómo funciona](#cómo-funciona)
    - [1. `index.html`](#1-indexhtml)
    - [2. `style.css`](#2-stylecss)
    - [3. `game.js`](#3-gamejs)
    - [Flujo del juego](#flujo-del-juego)
  - [Tecnologías](#tecnologías)
  - [Estructura del proyecto](#estructura-del-proyecto)
  - [Personalización](#personalización)
  - [Automatización de issues](#automatización-de-issues)
  - [Licencia](#licencia)

---

## Qué hace el proyecto

Es una versión jugable del Tetris clásico con todas las mecánicas que esperarías:

- Tablero de **10 × 20** celdas.
- Las **7 piezas estándar** (I, O, T, S, Z, J, L) con colores diferenciados.
- **Rotación** con _wall kicks_ básicos (pequeños desplazamientos para que la pieza pueda rotar pegada a la pared).
- **Soft drop** (bajada acelerada) y **hard drop** (caída instantánea).
- **Pieza fantasma** (_ghost piece_): muestra dónde aterrizará la pieza actual.
- **Vista previa** de la siguiente pieza.
- **Sistema de puntuación** clásico de Tetris (100 / 300 / 500 / 800 multiplicado por nivel).
- **Niveles** que aumentan cada 10 líneas y aceleran la caída.
- **Menú de pausa** con opciones para reanudar, reiniciar, ver los controles y elegir el nivel inicial de la próxima partida.
- **Game Over** con opción de reinicio.
- **Tabla de récords local** (top 5 con nombre del jugador, mejor combo y líneas máximas) guardada en `localStorage`.

---

## Cómo ejecutar el juego

No hay nada que instalar ni compilar. Tienes dos opciones:

### Opción 1: abrir el archivo directamente

```bash
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```

### Opción 2: servidor local (recomendado)

Cualquier servidor estático funciona. Algunos ejemplos:

```bash
# Con Python 3
python3 -m http.server 8000

# Con Node.js (npx)
npx serve .

# Con PHP
php -S localhost:8000
```

Después abre `http://localhost:8000` en el navegador.

---

## Controles

| Tecla     | Acción                            |
| --------- | --------------------------------- |
| `←` / `→` | Mover la pieza horizontalmente    |
| `↑` o `X` | Rotar la pieza en sentido horario |
| `↓`       | Soft drop (bajar más rápido)      |
| `Espacio` | Hard drop (caída instantánea)     |
| `P` o `Esc` | Abrir / cerrar el menú de pausa |

---

### En el menú de pausa

| Tecla              | Acción                                   |
| ------------------ | ---------------------------------------- |
| `↑` / `↓`          | Moverse entre las opciones               |
| `Enter` o `Espacio` | Elegir la opción seleccionada           |
| `←` / `→`          | Cambiar el nivel inicial (sobre el selector) |
| `P` o `Esc`        | Reanudar la partida                      |

Mientras el menú está abierto el juego no recibe ninguna tecla. Además, las teclas que se pulsaron dentro del menú se ignoran hasta que se sueltan, para que una tecla mantenida al volver no mueva la pieza.

---

## Cómo funciona

El juego se compone de tres archivos que cooperan:

### 1. `index.html`

Define la estructura visual:

- Un `<canvas id="board">` de **300 × 600** píxeles donde se renderiza el tablero.
- Un panel lateral con `SCORE`, `LINES`, `LEVEL`, vista de la siguiente pieza y la lista de controles.
- Un overlay para la **pantalla de inicio** y **GAME OVER**, con la tabla de **RÉCORDS** (y el formulario de nombre en game over), y otro (`#pause-menu`) con el menú de pausa. La lista de controles del menú se copia desde la del panel lateral al cargar, así que solo hay que mantener una.

### 2. `style.css`

Aporta el aspecto visual con estética _dark / retro arcade_: fondo oscuro, tipografía monoespaciada para los marcadores y _backdrop blur_ en los overlays. Los colores son variables CSS en `:root` (tema oscuro por defecto) y `:root[data-theme="light"]` las sobrescribe para el tema claro. El interruptor del panel lateral (`setTheme()` en `game.js`) cambia entre ambos y redibuja los canvas, cuyos colores de rejilla y brillo viven en la constante `THEMES`.

### 3. `game.js`

Contiene toda la lógica del juego. A grandes rasgos:

- **Modelo del tablero**: una matriz `ROWS × COLS` donde cada celda guarda `0` (vacía) o un índice de color (1–7) que identifica la pieza.
- **Piezas**: definidas como matrices cuadradas. Para rotar se calcula la transposición + reverso de filas (`rotateCW`).
- **Detección de colisiones** (`collide`): comprueba que ninguna celda de la pieza salga del tablero ni se solape con bloques ya fijados.
- **Wall kicks** (`tryRotate`): si la rotación choca, intenta desplazar la pieza ±1 y ±2 columnas antes de descartar el giro.
- **Game loop** (`loop`): basado en `requestAnimationFrame`, acumula el tiempo transcurrido y baja la pieza una fila cuando se supera `dropInterval`.
- **Limpieza de líneas** (`clearLines`): recorre el tablero de abajo hacia arriba; cada fila completa se elimina y se inserta una vacía en la cima.
- **Puntuación**: usa la tabla clásica `[0, 100, 300, 500, 800]` multiplicada por el nivel actual; el hard drop suma 2 puntos por celda recorrida y el soft drop 1 punto por fila.
- **Nivel y velocidad**: la partida empieza en el nivel inicial elegido en el menú de pausa (`startLevel`, guardado en `localStorage`) y sube uno cada 10 líneas: `level = nivel inicial + floor(lines / 10)`. La velocidad de caída se calcula en `dropIntervalFor(level)` como `max(100, 1000 − (level − 1) × 90)` milisegundos.
- **Menú de pausa** (`openPauseMenu`, `closePauseMenu`, `handleMenuKey`): detiene el bucle, captura todas las teclas para navegar el menú y, al reanudar, ignora las teclas que sigan pulsadas (`heldKeys`) hasta que se suelten. El nivel inicial se cambia con `setStartLevel` y se aplica en la siguiente llamada a `init()`.
- **Ghost piece** (`ghostY`): proyecta la posición final de la pieza actual hacia abajo y la dibuja con `globalAlpha = 0.2`.
- **Combo**: `clearLines` cuenta cuántas piezas seguidas eliminan al menos una línea; `maxCombo` guarda la mejor racha de la partida.
- **Récords** (`loadRecords`, `saveRecords`, `recordRank`, `commitPendingRecord`, `renderRecords`, `resetRecords`): se guardan en `localStorage` bajo la clave `tetris.records` como `{ scores, bestCombo, maxLines }`. `scores` es el top 5 (`{ name, score, lines, combo, date }`), ordenado de mayor a menor; un empate con el 5.º puesto no entra. `bestCombo` y `maxLines` se actualizan con **cada** partida, entre o no en el top. El último nombre usado se recuerda en `tetris.playerName`.
- **Game over** (`endGame`): si la puntuación entra en el top 5 aparece un campo de nombre y la fila de la partida se resalta en la tabla mientras se escribe. El récord se guarda con **Guardar** / `Enter`, o automáticamente al pulsar **Reiniciar** (como «Anónimo» si el nombre está vacío). **Borrar récords** pide confirmación y vacía la tabla.

### Flujo del juego

```
showStartScreen()                   → overlay con récords y botón «Jugar»
  ↓ (click en Jugar)
init()
  ├─ createBoard()                  → matriz vacía
  ├─ next = randomPiece()
  ├─ spawn()                        → mueve next a current y genera nueva next
  └─ requestAnimationFrame(loop)
        ↓
   loop(timestamp)
     ├─ acumula dt
     ├─ si dt ≥ dropInterval → baja la pieza o llama a lockPiece()
     ├─ draw()  (grid + tablero + ghost + pieza actual)
     └─ requestAnimationFrame(loop)

   keydown → mover / rotar / soft-drop / hard-drop / menú de pausa
   menú abierto → handleMenuKey() (el juego no recibe teclas)
```

Cuando una pieza recién generada ya colisiona al aparecer (`spawn`), se dispara `endGame()` y se muestra el overlay de **Game Over** con la tabla de récords.

---

## Tecnologías

- **HTML5** — marcado y dos elementos `<canvas>` (tablero y vista previa).
- **CSS3** — _flexbox_, variables de color, `backdrop-filter` y `box-shadow`.
- **JavaScript (ES6+) vanilla** — `const`/`let`, _arrow functions_, _spread operator_, `Array.from`, _template literals_…
- **Canvas 2D API** — para todo el renderizado del juego.
- **`requestAnimationFrame`** — para el bucle de juego sincronizado con el navegador.

**Sin dependencias.** No hay `package.json`, ni bundler, ni transpilador.

---

## Estructura del proyecto

```
03-tetris/
├── index.html      # Estructura del DOM y canvas
├── style.css       # Estilos del juego (tema oscuro/claro)
├── game.js         # Toda la lógica del Tetris (~500 líneas)
└── README.md
```

---

## Personalización

Algunos parámetros fáciles de tunear en `game.js`:

| Constante      | Significado                              | Por defecto           |
| -------------- | ---------------------------------------- | --------------------- |
| `COLS`         | Columnas del tablero                     | `10`                  |
| `ROWS`         | Filas del tablero                        | `20`                  |
| `BLOCK`        | Tamaño en píxeles de cada celda          | `30`                  |
| `COLORS`       | Paleta de colores por tipo de pieza      | 7 colores             |
| `LINE_SCORES`  | Puntos por 1, 2, 3 o 4 líneas eliminadas | `[0,100,300,500,800]` |
| `dropIntervalFor` | Velocidad de caída en ms según el nivel | `max(100, 1000 − (level − 1) × 90)` |
| `MAX_START_LEVEL` | Nivel inicial máximo seleccionable en el menú | `10`          |
| `MAX_RECORDS`  | Puestos de la tabla de récords           | `5`                   |
| `NAME_MAX_LENGTH` | Longitud máxima del nombre del jugador | `12`                  |
| `RECORDS_KEY`  | Clave de `localStorage` de los récords   | `'tetris.records'`    |

> Si cambias `COLS`, `ROWS` o `BLOCK`, recuerda ajustar también `width` y `height` del `<canvas id="board">` en `index.html` para que coincida (`COLS × BLOCK` × `ROWS × BLOCK`).
> Si cambias `NAME_MAX_LENGTH`, ajusta también el `maxlength` de `<input id="player-name">` en `index.html`.

---

## Automatización de issues

El workflow `.github/workflows/claude-issue-triage.yml` se ejecuta cada vez que se **crea** un issue o se **edita** su título o descripción. Claude:

1. Lee el issue y el código del juego.
2. Asigna labels: un tipo (`bug`, `enhancement`, `documentation`, `question`), una o más áreas (`area: gameplay`, `area: ui`, `area: controls`, `area: scoring`) y una prioridad (`priority: high`, `priority: medium`, `priority: low`).
3. Publica un comentario con un **diagnóstico general** (resumen, archivos y funciones afectados, causa probable, enfoque de implementación sugerido, riesgos y criterios de verificación). Si el issue se edita, se actualiza ese mismo comentario.

Usa el secret `CLAUDE_CODE_OAUTH_TOKEN`, el mismo que ya usan los demás workflows de Claude.

---

## Licencia

Proyecto de uso libre con fines educativos y de práctica.
