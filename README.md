# Simulador de Robot 2 GDL — Primer Examen Parcial

Aplicación web interactiva que simula el **movimiento de un robot planar de 2 grados de libertad (2 GDL)**.
El proyecto fue desarrollado como parte del **Primer Examen Parcial** de la asignatura **Robótica / Control de Manipuladores** en la **Facultad de Estudios Superiores Aragon, UNAM**.

---

## Objetivo

Desarrollar una interfaz gráfica web que permita:

* Visualizar el movimiento de un robot planar 2R con eslabones de longitud conocida.
* Ingresar una posición final deseada ((x_d, y_d)).
* Generar las trayectorias articulares ( q_{1d}(t) ) y ( q_{2d}(t) ) mediante polinomios de quinto orden.
* Mostrar el desplazamiento del efector final de manera **animada o instantánea**, según el modo seleccionado.
* Verificar el **espacio de trabajo** del robot y visualizar el **límite de alcance** (opcionalmente considerando la pinza).
* Exportar los resultados o trayectorias para análisis adicional.

---

## Características principales

* **Cinemática directa e inversa** implementadas en JavaScript.
* **Perfil quíntico** para suavizar trayectorias articulares.
* **Modos de movimiento**:

  * **Animación**: el robot sigue la trayectoria completa.
  * **Instantáneo**: el efector se mueve de forma inmediata al punto deseado.
* **Verificación de límites** y advertencia si el punto está fuera del espacio de trabajo.
* **Interfaz moderna** con modo claro/oscuro, transiciones suaves y feedback visual.
* **Visualización punteada de la trayectoria**, tanto desde la base como desde la punta de la pinza.
* **Exportación de trayectorias** a CSV.
* **Totalmente responsivo**, adaptable a escritorio y móviles.

---

##  Estructura del proyecto

```
proyecto-robot-2gdl/
│
├── index.html          # Estructura principal de la aplicación
├── style.css           # Estilos y temas (dark/light)
├── script.js           # Lógica del robot, animaciones y eventos
```

---

##  Uso

1. Abre `index.html` en tu navegador.
2. Ingresa los valores deseados para **xₙ, yₙ**.
3. Selecciona el **modo de movimiento** y, si lo deseas, activa el **límite por pinza**.
4. Presiona **Aplicar** o haz clic sobre el plano cartesiano.
5. Observa el movimiento y las gráficas de ( q_1(t) ) y ( q_2(t) ).

---

##  Parámetros por defecto

| Parámetro | Valor  | Descripción                  |
| --------- | ------ | ---------------------------- |
| `l1`      | 0.12 m | Longitud del primer eslabón  |
| `l2`      | 0.12 m | Longitud del segundo eslabón |
| `pinza`   | 0.02 m | Longitud total de la pinza   |
| `ti`      | 0 s    | Tiempo inicial               |
| `tf`      | 20 s   | Tiempo final                 |

---