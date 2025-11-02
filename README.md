# 🌾 Santa Ana Mobile (React Native + Expo)

Aplicación móvil del **trabajo de graduación grupal “Recopilación, visualización y análisis de formularios adaptables en campos de acción agrícola”**, desarrollada para el **Ingenio Santa Ana**.  

Permite la **recolección de datos en campo** mediante formularios dinámicos, con soporte **offline**, validaciones locales y sincronización automática cuando se restablece la conexión.  

Desarrollada con **React Native (Expo SDK 53)** bajo principios de **Design Thinking** y metodología **ágil Scrum**, priorizando accesibilidad, usabilidad y eficiencia operativa en entornos rurales.

---

## ✨ Características clave

### 🧾 Formularios dinámicos
- Renderizado automático a partir de esquemas JSON enviados por la plataforma web.
- Soporte para campos de texto, numéricos, listas, selección múltiple, fechas, firmas, campos calculados y grupos repetibles.

### 📶 Operación offline
- Almacenamiento local con **SQLite (Expo SQLite)** y sincronización diferida.
- Persistencia de sesiones y formularios incompletos mediante **Redux Persist** y **AsyncStorage/MMKV**.

### 🔐 Autenticación y seguridad
- Acceso mediante código QR o credenciales.
- Tokens almacenados de forma segura con **Expo Secure Store**.

### 📤 Sincronización y exportación
- Sincronización automática al reconectarse.

### 🖥️ Interfaz centrada en el usuario
- Diseño responsivo, legible y accesible (WCAG 2.1).
- Interfaz animada con **Reanimated 3**, **NativeWind (TailwindCSS)** y **styled-components**.
- Soporte táctil extendido, vibraciones hápticas y modo claro/oscuro automático.

---

## 🧩 Stack tecnológico

| Categoría | Tecnologías |
|------------|-------------|
| **Framework** | React Native 0.79 + Expo SDK 53 |
| **UI / UX** | NativeWind (TailwindCSS), styled-components, Expo Linear Gradient, Expo Image |
| **Estado global** | Redux Toolkit + Redux Persist |
| **Networking / API** | Axios + TanStack Query |
| **Persistencia local** | Expo SQLite, AsyncStorage, MMKV |
| **Navegación** | Expo Router + React Navigation (Stack / Tabs) |
| **Validaciones** | Formik + Yup |
| **Plugins Expo** | Camera, Secure Store, Notifications, Background Task, Splash Screen, Font |
| **Linting / formato** | ESLint + Prettier + Tailwind plugin |
| **Build / Deploy** | EAS Build + Runtime Updates |

---

## 🚀 Instalación y ejecución

### 1️⃣ Clonar el repositorio
```bash
git clone https://github.com/santa-ana-agroforms/SantaAna_Mobile.git
cd SantaAna_Mobile
```

### 2️⃣ Instalar dependencias
```bash
yarn install
# o
npm install
```

### 3️⃣ Crear el archivo `.env`  
Configura las variables de entorno necesarias (endpoints de la API, credenciales, etc.).

### 4️⃣ Ejecutar en modo desarrollo
```bash
yarn start
```
Escanea el código QR con la app **Expo Go** o un **Dev Client** personalizado.

### 5️⃣ Ejecutar en dispositivo o emulador
```bash
yarn android
# o
yarn ios
```

---

## 🧭 Estructura principal del proyecto

```
src/
 ├─ api/              # Cliente Axios y endpoints REST
 ├─ components/       # Átomos, moléculas y organismos (Atomic Design)
 ├─ hooks/            # Hooks reutilizables
 ├─ navigation/       # Rutas y navegación
 ├─ screens/          # Pantallas principales (Inicio, Formularios, Perfil, etc.)
 ├─ store/            # Redux Toolkit slices
 ├─ utils/            # Utilidades y helpers
 └─ assets/           # Iconos, imágenes y fuentes
```

---

## 📱 Publicación

La aplicación se distribuye mediante **EAS Build** y puede compilarse en formato:
- **Android APK / AAB** para despliegue interno o Play Store.
- **iOS IPA** (requiere cuenta de Apple Developer).

---

## 🧠 Enfoque metodológico

Desarrollada bajo un enfoque de **Design Thinking** y metodología **ágil Scrum**, validada con usuarios reales en entornos agrícolas.  
Incluye fases de análisis, prototipado (Figma), implementación (React Native + Expo) y pruebas de usabilidad (eye-tracking Tobii y validaciones de campo).

---

## 👨‍💻 Autor

**Diego Alexander Hernández Silvestre**  
Universidad del Valle de Guatemala – Facultad de Ingeniería  
Trabajo de Graduación 2025 · Módulo móvil del trabajo de graduación grupal.

GitHub: [santa-ana-agroforms](https://github.com/santa-ana-agroforms)

---

## 📄 Licencia

Este proyecto se distribuye bajo la licencia **MIT**.  
© 2025 Ingenio Santa Ana · Universidad del Valle de Guatemala

---

## 🌐 Enlaces

- **Documentación backend (API)**: [https://santaana-api-latest.onrender.com/docs]