# Banco de Puntos (NFC), versión 6

Sistema tipo tarjeta de transporte para dar, cobrar y canjear puntos en clase con tarjetas o stickers NFC. La tarjeta es la base de datos principal y el teléfono lleva un registro de respaldo.

## Estructura del repositorio

Cada app vive en su propia carpeta. Así Android las reconoce como apps distintas y se pueden instalar las cuatro en el mismo teléfono.

```
index.html          Portada con enlaces a las cuatro apps (no se instala)
saldo.html          Redirige a Mis Puntos; las tarjetas apuntan aquí
banco/              Banco de Puntos (docente)
asistencia/         Asistencia (docente)
informes/           Informes (docente, celular o computador)
mis-puntos/         Mis Puntos (estudiantes y familias)
nucleo.js, nucleo.css, qrcode.js, catalogo.json, sw.js, icon-*.png   Compartidos
```

Cada carpeta tiene su `index.html` y su `manifest.webmanifest`. No muevas `saldo.html` de la raíz: es la dirección que llevan las tarjetas.

Solo el Banco y la Asistencia escriben en las tarjetas; Mis Puntos e Informes solo leen. En el mismo teléfono, las cuatro apps comparten los estudiantes, la clave del banco, tu número de docente, la lista de cursos y el PIN del docente, porque el navegador guarda los datos por sitio y no por carpeta. Se configuran una vez, en el Banco.

`nucleo.js` repite el formato de la tarjeta de `banco/index.html`. Si algún día se cambia el formato, hay que cambiarlo en los dos. `qrcode.js` es el generador de QR de Kazuhiko Arase (licencia MIT), incluido para funcionar sin internet.

## Publicar en GitHub Pages

1. Sube todo el contenido de la carpeta, con sus subcarpetas, a la raíz del repositorio (en el computador, "Add file" → "Upload files" y arrastra las carpetas).
2. Settings → Pages → "Deploy from a branch", rama `main`, carpeta `/ (root)`.
3. Abre `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/` en **Chrome para Android**. Desde la portada, abre cada app y en el menú de Chrome toca "Agregar a pantalla principal" o "Instalar app".

## Modo simple y funciones opcionales

Al empezar solo se pide la clave del banco. Todo lo demás se activa en **Ajustes**:

- **PIN del docente**: si existe, siempre se pide para entrar a Ajustes. Opcionalmente también al abrir la app y en cada movimiento.
- **PIN de estudiantes**: para cobros y canjes. Si un estudiante aún no tiene, el que escriba en su primer cobro queda como su PIN. Tras 3 intentos fallidos, los cobros a esa tarjeta se bloquean 5 minutos. El docente puede quitar el PIN desde la ficha del estudiante.
- **Tope por movimiento** y **confirmación** para montos grandes.
- **Deshacer**: hasta 10 minutos después, si la tarjeta no ha tenido otro movimiento. No borra nada: registra el movimiento inverso.
- **Pantalla "No retires la tarjeta"** (siempre activa): aparece mientras se escribe y termina con una vibración larga. Si la tarjeta se detectó pero no se alcanzó a leer, aparece un aviso para acercarla otra vez.
- **Confirmar con un segundo toque**: vuelves a acercar la tarjeta para comprobar que quedó bien escrita.
- **Lista del curso** en el modo por lotes: muestra quién falta.
- **Catálogo de canjes** con precio fijo.
- **Cierre de periodo**: los saldos se conservan, vuelven a 0 o conservan un porcentaje. Cada tarjeta se ajusta sola la próxima vez que se acerque.
- **Recordatorio semanal** de respaldo.

## Banco de Puntos: novedades de esta versión

- **Mis cursos** (Ajustes → Tus datos): lista separada por comas que aparece como sugerencia al escribir el curso, y la usa Asistencia.
- **Mostrar QR para el estudiante** en Consultar: el mismo enlace de la tarjeta como QR, para quien no tiene NFC.
- **Otras apps del sistema** en Ajustes: enlaces a Asistencia, Informes y Mis Puntos.
- Si Asistencia cambia datos con el Banco abierto en el mismo teléfono, el Banco se actualiza solo.

## Cuentas: modelo mixto

Cada tarjeta guarda una **cuenta por docente** y una **cuenta institucional** (común). El saldo grande de la tarjeta es la suma de todas.

- Cada docente solo da, cobra y canjea en **su propia cuenta** y en la **institucional**. Las cuentas de los demás docentes las ve, pero no las puede mover.
- En Transferir, el selector "Desde la cuenta" elige entre "Mi cuenta" e "Institucional". En Ajustes se puede apagar el uso de la institucional.
- Cada docente se identifica con su **número de docente** (Ajustes → Tus datos). Debe ser único y no cambiar: si lo cambias, tu cuenta anterior queda a nombre de "otro docente".
- Si al leer una tarjeta tu cuenta cambió sin un movimiento hecho desde tu teléfono, la app muestra el aviso "Tu cuenta cambió fuera de este teléfono".
- Caben hasta 8 cuentas con saldo por tarjeta. Las cuentas en cero no ocupan espacio.
- El cierre de periodo se aplica a todas las cuentas por igual.
- El saldo inicial al registrar una tarjeta va a la cuenta del docente que la registra.

Las tarjetas de versiones anteriores (un solo saldo) se leen sin problema: ese saldo pasa a la cuenta institucional.

## Asistencia

1. Abre una sesión: curso (de "Mis cursos" o de los estudiantes registrados) y, si quieres, la clase o franja.
2. Los estudiantes pasan la tarjeta uno tras otro. Cada uno ve su nombre, emoji y un saludo; si ya estaba registrado, solo se avisa.
3. "Faltan" y "Registrados" se actualizan en vivo. Toca un nombre para marcarlo a mano: a tiempo, tarde, justificada o ausente.
4. Al cerrar, quienes falten quedan como ausentes.
5. Historial: tabla por curso con P, T, J y A por fecha y el porcentaje de asistencia (sin contar justificadas). Se comparte en CSV.

En Ajustes de Asistencia: puntos por asistir (0 = no dar puntos; así solo lee y la fila avanza más rápido), si quien llega tarde también recibe puntos, el motivo, la cuenta y a los cuántos minutos se marca "tarde". Las asistencias seguidas se suman en una sola línea del historial de la tarjeta.

Si una tarjeta tiene datos con problemas, Asistencia registra la presencia sin dar puntos y avisa que se revise en el Banco. Restaurar tarjetas es tarea del Banco.

## Informes

- **Datos:** "Usar los datos de este dispositivo" toma el Banco y la Asistencia de ese navegador. En computador, importa los CSV que comparten el Banco (saldos y movimientos) y Asistencia, de uno o varios docentes: se combinan sin duplicar.
- **Filtros:** curso, periodo y rango de fechas.
- **Resumen:** cifras, puntos dados y gastados por semana, saldo promedio por curso y puntos por cuenta.
- **Cursos y Estudiantes:** tablas que se pueden ordenar y descargar. Alertas de estudiantes inactivos (30 días sin movimientos), con saldo alto (más del doble del promedio de su curso) o asistencia bajo el 80 %.
- **Motivos y canjes:** qué da más puntos, qué se cobra, qué se canjea y cuánto da cada docente.
- **Hoja de QR:** una ficha por estudiante con su saldo y un QR, lista para imprimir. La familia lo escanea con cualquier celular y lo ve en Mis Puntos. Es una foto del registro en ese momento. Para que el QR apunte bien, abre Informes desde la dirección de GitHub Pages, no desde un archivo descargado.

## Mis Puntos (estudiantes y familias)

- Se abre al acercar la tarjeta o al escanear un QR (el docente lo muestra con "Mostrar QR para el estudiante" en Consultar, o lo imprime desde Informes).
- **Tarjeta:** saldo, cuentas, totales y últimos movimientos, con el cambio desde la consulta anterior.
- **Canjes:** cada canje del catálogo con una barra de avance y cuánto falta, según la cuenta con que se paga.
- **Evolución:** gráfica con las consultas guardadas en ese celular.
- **Más:** personalizar color y emoji solo en ese celular, y guardar varias tarjetas (modo familia).
- En iPhone conviene usarla en Safari sin instalarla: iOS abre los enlaces de la tarjeta en Safari, y la app instalada no compartiría las consultas guardadas.

## Consultar y Transferir

- **Consultar** solo lee: muestra saldo, totales e historial, y nunca escribe en la tarjeta. Si hay un cierre de periodo pendiente, se aplica en el siguiente movimiento.
- **Transferir** es el único lugar donde se dan, cobran o canjean puntos. Desde la ficha de un estudiante, "Dar, cobrar o canjear" abre Transferir con ese estudiante fijado: solo su tarjeta será aceptada.

## Apariencia de las tarjetas

La tarjeta se dibuja en tiempo real. En Ajustes eliges si su color sale del curso (automático), lo elige cada estudiante o es el mismo para todas, y si se permite un emoji. El estudiante elige en la ficha, en el teléfono del docente, y la elección queda guardada en su tarjeta (2 bytes), así que se ve igual en su celular. Las listas de colores y emojis solo se amplían al final; nunca se reordenan.

## Qué guarda la tarjeta (entre 70 y 110 bytes de los 504 del NTAG215)

Saldo, número de movimiento, total ganado, total gastado, fecha de registro, periodo, huella del PIN, color, emoji, las cuentas con saldo (4 bytes cada una), nombre (24 bytes), curso (8 bytes) y los **últimos 5 movimientos** (fecha, tipo, código del motivo, puntos y número de docente). Todo va firmado con la clave del banco y el número de serie de la tarjeta.

Las observaciones escritas a mano no van en la tarjeta. Quedan en el teléfono y en el CSV de movimientos.

## catalogo.json

- Los códigos tienen 2 caracteres (letras mayúsculas o números).
- **Nunca reutilices un código con otro significado.** Las tarjetas guardan solo el código; si cambias su significado, los historiales viejos mostrarán el nombre nuevo. Si un motivo deja de usarse, déjalo y agrega uno nuevo.
- Los códigos de motivos y de canjes no deben repetirse entre sí.
- `tipo` del motivo: `dar`, `cobrar` o `ambos`.
- `nombreInstitucional`: cómo se llama la cuenta común (por ejemplo, "Colegio").
- `cuenta` de cada canje:
  - `"docente"`: lo cobra cualquier docente, con su propia cuenta.
  - `"docente"` junto con `"docente": 3`: solo lo cobra el docente 3, con su cuenta. Sirve para canjes propios de una materia, como "Medio punto en Matemáticas".
  - `"institucional"`: lo cobra cualquier docente, de la cuenta común. Sirve para salidas, eventos o premios del colegio.

  Cada docente solo ve en Transferir los canjes que puede cobrar.
- Cada docente pone su número en Ajustes. Debe coincidir con su entrada en `docentes`.

## Varios docentes y cambio de teléfono

- Todos deben usar la **misma clave del banco** y la misma regla de cierre de periodo.
- Si un docente mueve una tarjeta, el teléfono de otro acepta el saldo nuevo al leerla y la agrega a su lista.
- **Cambio de teléfono**: instala la app, pon la misma clave y las tarjetas se reconstruyen solas a medida que se acercan. Para traer también el historial completo y las observaciones, usa "Compartir respaldo" en el teléfono viejo e importa los dos CSV en el nuevo.

## Tarjeta perdida o dañada

En la ficha del estudiante: "Reemplazar tarjeta". El saldo pasa a una tarjeta nueva y la vieja queda bloqueada en ese teléfono. Comparte un respaldo para que los demás docentes también la bloqueen al importarlo.

## CSV

- `saldos-…csv`: incluye `cuentas` (por ejemplo `0:120 3:45`, donde 0 es la institucional y 3 el docente 3) y `datos_tarjeta`, con la copia completa de cada tarjeta. Para corregir un saldo a mano en Excel, cambia la columna `cuentas`, sube `contador` en 1 e importa; la columna `saldo` es solo informativa. Al leer esa tarjeta, la app avisará que tiene un saldo viejo y te dejará restaurarla con el valor corregido.
- `movimientos-…csv`: historial completo, con observaciones y la cuenta de cada movimiento.

Usan punto y coma para que Excel en español los abra bien.

## Qué tarjetas comprar

Sirven: **NTAG215** o **NTAG216** (en la descripción suelen decir "NTAG21x" o "NFC Forum Type 2"). Con el historial, **NTAG213 ya no alcanza**.

No sirven: **MIFARE Classic 1K/S50** ni las de **125 kHz** (EM4100, TK4100, T5577). Pidan una de muestra antes de comprar el lote.

## Límites

- Leer y escribir solo funciona en Chrome para Android con el NFC encendido.
- El registro vive en el navegador del teléfono: si se borran los datos de Chrome, se pierde el historial del teléfono (no el de las tarjetas). Respalda con frecuencia.
- Pendiente para una próxima versión: insignias, Pomodoro y diseños enviados por QR desde Mis Puntos. Requieren que el Banco escanee QR y, las insignias, espacio nuevo en la tarjeta.
- Las tarjetas de la versión 1 no se leen: aparecen como nuevas y hay que registrarlas otra vez. Las de la versión 2 sí se leen y se actualizan solas en su próximo movimiento.
