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

## ⚙️ Configuración de Variables de Entorno

Para ejecutar correctamente el proyecto, es necesario definir una serie de variables de entorno que controlan el acceso a los servicios de autenticación, sincronización y API.  
Estas variables **no deben compartirse públicamente** y deben almacenarse de forma segura en los archivos `.env.local` (para el cliente móvil) y `.env` (para el backend o scripts administrativos).

---

### 📱 Archivo `.env.local` (Frontend – Expo / React Native)

Ubicación: raíz del proyecto móvil (`/` o `/app` según tu estructura).

```bash
EXPO_PUBLIC_API_BASE_KEY=SANTAANA_API_BASE_KEY
EXPO_PUBLIC_ACCESS_KEY=SANTAANA_ACCESS_KEY
EXPO_PUBLIC_REFRESH_KEY=SANTAANA_REFRESH_KEY
EXPO_PUBLIC_ACCESS_SECRET=7qN11exampleSecret
EXPO_PUBLIC_REFRESH_SECRET=KD4TexampleSecret
EXPO_PUBLIC_QR_MAGIC_CODE=3rb9MxexampleCode
EXPO_PUBLIC_BASE_URL=https://santaana.example.com/api
```

#### Descripción:
- **EXPO_PUBLIC_API_BASE_KEY** → Identificador del entorno de API configurado para el cliente móvil.  
- **EXPO_PUBLIC_ACCESS_KEY / REFRESH_KEY** → Claves de sesión utilizadas para gestionar tokens temporales.  
- **EXPO_PUBLIC_ACCESS_SECRET / REFRESH_SECRET** → Secretos asociados a las claves de sesión.  
- **EXPO_PUBLIC_QR_MAGIC_CODE** → Código único usado para autenticación mediante QR.  
- **EXPO_PUBLIC_BASE_URL** → URL base del backend o servicio principal de autenticación.

---

### 🖥️ Archivo `.env` (Backend o Entorno de Administración)

Ubicación: raíz del backend (`/backend` o `/server`).

```bash
API_BASE_URL=https://santaana.example.com/api
ADMIN_API_KEY=mF8arVnlkexampleKey
```

#### Descripción:
- **API_BASE_URL** → Dirección base del API que consume el cliente móvil.  
- **ADMIN_API_KEY** → Clave de acceso para operaciones administrativas o endpoints protegidos.

---

### 🚨 Importante

- Reemplaza los valores de ejemplo con los **valores reales proporcionados por el equipo técnico o de infraestructura**.  
- **No subas estos archivos a repositorios públicos** ni los incluyas en commits.  
- Para obtener los valores oficiales, **contacta al administrador del proyecto o al equipo de infraestructura de Santa Ana**.  
- Si usas Expo, asegúrate de que las variables comiencen con el prefijo `EXPO_PUBLIC_` para que sean accesibles desde el cliente.

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