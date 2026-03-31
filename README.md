# NavaScript

> Un lenguaje de programación interpretado con sintaxis propia, IDE web y extensión para VS Code.

[![Licencia: MIT](https://img.shields.io/badge/Licencia-MIT-white.svg)](https://opensource.org/licenses/MIT)
[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code-En%20Revisión-blue.svg)](https://marketplace.visualstudio.com)
[![IDE Web](https://img.shields.io/badge/IDE-En%20Vivo-brightgreen)](https://AngelDev2343.github.io/NavaScript)
[![GitHub](https://img.shields.io/badge/GitHub-AngelDev2343-black)](https://github.com/AngelDev2343)

---

## 🚀 Introducción rápida

**NavaScript** (`.ns`) es un lenguaje de programación interpretado, creado desde cero, con su propia sintaxis y herramientas oficiales:

* **IDE web**: escribe y ejecuta código directamente en el navegador.
* **Extensión para VS Code**: resaltado de sintaxis y ejecución integrada.

Diseñado para ser simple y divertido, con soporte para variables, funciones, condicionales, bucles, recursión y más.

---

## ⚙️ Componentes principales

### 1️⃣ IDE Web

Accede desde [NavaScript IDE Oficial](https://AngelDev2343.github.io/NavaScript) sin instalar nada.

**Características:**

* Editor de código con soporte `.ns`
* Intérprete integrado en el navegador (sin servidor)
* Panel de salida en tiempo real
* Carga y descarga de archivos `.ns`
* Referencia rápida de sintaxis integrada
* Atajo: `Ctrl+Enter` / `Cmd+Enter` para ejecutar

### 2️⃣ Extensión para VS Code

Agrega soporte completo para NavaScript dentro de Visual Studio Code.

**Características:**

* Resaltado de sintaxis para todas las palabras clave
* Ejecutar scripts con `NS: Ejecutar RUNRUN`
* Soporte para "Run & Debug" de Visual Studio Code
* Consola de salida dedicada
* Compatible con todos los archivos `.ns`

**Estado:** Disponible en la Marketplace de VS Code

**Instalación manual:**

1. Descarga el archivo `.vsix` desde [Releases](https://github.com/AngelDev2343/NavaScript/releases/tag/NS-Extension)
2. Abre VS Code → `Extensiones` → `···` → `Instalar desde VSIX...`
3. Selecciona el archivo y empieza a programar

### 3️⃣ IDE Oficial para Windows

Agrega soporte completo para NavaScript en Windows 10/11

**Características:**

* Editor de código con soporte `.ns`
* Intérprete integrado en el navegador (sin servidor)
* Panel de salida en tiempo real
* Carga y descarga de archivos `.ns`
* Referencia rápida de sintaxis integrada
* Atajo: `Ctrl+Enter` / `Cmd+Enter` para ejecutar
* Programa totalmente **PORTABLE**

---

## 👨‍💻 Cómo empezar

### • Opción A — IDE Web (sin instalación)

Ve a **[NavaScript IDE Oficial](https://AngelDev2343.github.io/NavaScript)**, escribe tu código y presiona `RUNRUN` o `Ctrl+Enter`.



### • Opción B — Extensión para VS Code

1. Descarga el archivo `.vsix` desde la página de [Releases](https://github.com/AngelDev2343/NavaScript/releases/tag/NS-Extension).
2. Abre VS Code.
3. Ve a `Extensiones` → `···` → `Instalar desde VSIX...`.
4. Selecciona el archivo descargado.
5. Crea un archivo con extensión `.ns` y empieza a programar.

### • Opción C — IDE Oficial para Windows

1. Descarga el archivo `NavaScript-IDE-Desktop.Windows.32-64.bits.zip`.
2. Extraelo dentro de una carpeta.
3. Executa `navascript_ide.exe`.
4. Y listo empieza a programar.

**Descargar [NavaScript-IDE-Desktop.Windows.32-64.bits.zip](https://github.com/AngelDev2343/NavaScript/releases/download/NS-IDE/NavaScript-IDE-Desktop.Windows.32-64.bits.zip)**

---

## 📸 Capturas de pantalla

<img src="images/capture.jpeg" alt="alt text" width="1000" height="500">
<img src="images/image.png" alt="alt text" width="1000" height="1100">
<img src="images/code1.png" alt="alt text" width="1000" height="700">
<img src="images/image-1.png" alt="alt text" width="1000" height="600">
<img src="images/image-2.png" alt="alt text" width="1000" height="600">
<img src="images/image-3.png" alt="alt text" width="1000" height="600">
<img src="images/image-4.png" alt="alt text" width="1000" height="600">

---

## 🔄 Referencia de sintaxis

NavaScript usa un conjunto fijo de palabras clave con distinción entre mayúsculas y minúsculas. Todas las palabras clave deben escribirse exactamente como se muestra.

### Variables

```ns
lobo aparece x = 10
lobo aparece nombre = "NavaScript"
lobo aparece activo = true
```

Declara e inicializa una variable. Las variables son de tipado dinámico. La reasignación se hace con `=` simple:

```ns
x = 20
```

---

### Salida

```ns
SHAREEE "Hola mundo"
SHAREEE x
SHAREEE "Valor: " + x
```

Imprime un valor en la consola de salida. Soporta concatenación de cadenas con `+`.

---

### Comentarios

```ns
Rawr Esto es un comentario
Rawr --- Sección de inicialización ---
```

`Rawr` marca el resto de la línea como comentario. El intérprete lo ignora completamente.

---

### Funciones

```ns
Gii Huu nombreFuncion(param1, param2) {
  NOOOO MORE param1 + param2
}
```

- `Gii Huu` declara una función.
- Los parámetros se separan con comas.
- `NOOOO MORE` retorna un valor desde la función.
- Las funciones se pre-escanean antes de la ejecución, por lo que el orden de declaración no importa.

**Llamar una función:**

```ns
lobo aparece resultado = nombreFuncion(5, 3)
SHAREEE resultado
```

La recursión está soportada hasta una profundidad de 200 llamadas.

---

### Condicionales

```ns
si x > 5 {
  SHAREEE "Mayor que 5"
}
sino {
  SHAREEE "Menor o igual a 5"
}
```

- `si` evalúa la condición. Si es verdadera, ejecuta el bloque.
- `sino` es la rama else opcional.
- Operadores soportados: `>`, `<`, `>=`, `<=`, `==`, `!=`

---

### Bucles

**Bucle while (`mientras`)** — se ejecuta mientras la condición sea verdadera:

```ns
mientras x > 0 {
  SHAREEE x
  Boom x
}
```

**Bucle while invertido (`Grr`)** — se ejecuta mientras la condición sea **falsa** (es decir, hasta que la condición se vuelva verdadera):

```ns
Grr x == 0 {
  SHAREEE x
  Boom x
}
```

Ambos bucles tienen un límite máximo de 10,000 iteraciones para prevenir bucles infinitos.

---

### Incremento / Decremento

```ns
Zap x    Rawr x = x + 1
Boom x   Rawr x = x - 1
```

`Zap` incrementa una variable en 1. `Boom` la decrementa en 1. La variable debe estar declarada previamente.

---

### Pausa

```ns
Uuh 1000
```

Pausa la ejecución durante el número de milisegundos indicado. Útil para lógica basada en tiempo.

---

### Operadores

| Tipo        | Operadores                          |
|-------------|-------------------------------------|
| Aritméticos | `+`, `-`, `*`, `/`, `%`             |
| Comparación | `==`, `!=`, `>`, `<`, `>=`, `<=`    |
| Cadenas     | `+` (concatenación)                 |

---

### Límites del intérprete

| Parámetro                       | Valor   |
|---------------------------------|---------|
| Profundidad máxima de recursión | 200     |
| Iteraciones máximas por bucle   | 10,000  |
| Instrucciones totales máximas   | 100,000 |

Superar cualquiera de estos límites lanza un error en tiempo de ejecución.

---

## Ejemplos de código

### Hola Mundo

```ns
SHAREEE "Hola mundo"
```

---

### Variables y aritmética

```ns
lobo aparece x = 10
lobo aparece y = 3
lobo aparece suma = x + y
SHAREEE "Suma: " + suma
SHAREEE "Módulo: " + x % y
```

---

### Función con valor de retorno

```ns
Gii Huu potencia(base, exp) {
  lobo aparece resultado = 1
  lobo aparece i = 0
  mientras i < exp {
    resultado = resultado * base
    Zap i
  }
  NOOOO MORE resultado
}

SHAREEE potencia(2, 8)
```

---

### Lógica condicional

```ns
lobo aparece edad = 18

si edad >= 18 {
  SHAREEE "Mayor de edad"
}
sino {
  SHAREEE "Menor de edad"
}
```

---

### Cuenta regresiva con bucle

```ns
lobo aparece n = 5
mientras n > 0 {
  SHAREEE n
  Boom n
  Uuh 500
}
SHAREEE "Despegue"
```

---

### Función recursiva (Fibonacci)

```ns
Gii Huu fib(n) {
  si n <= 1 {
    NOOOO MORE n
  }
  NOOOO MORE fib(n - 1) + fib(n - 2)
}

SHAREEE fib(10)
```

---


## 📜 Licencia

Este proyecto está bajo la **Licencia MIT**.  
Consulta el archivo [LICENSE](./LICENSE) para más detalles.

---

<p align="center">
  Desarrollado por <a href="https://github.com/AngelDev2343">AngelDev2343</a>
</p>
