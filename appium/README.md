Apium E2E (Python) – SantaAna Mobile

Contenido
- Pruebas E2E en Python con Appium (Android, UiAutomator2).
- Se apoyan en el APK y en `actual-db.json` ubicado en la raíz del repo.

Requisitos
- Python 3.10+
- Appium server 2.x y driver UiAutomator2 instalado
- Paquetes Python: `pip install Appium-Python-Client selenium pytest`

Archivos clave (Python)
- `apium/py/utils.py`: utilidades de driver y helpers (scroll, tap, inputs).
- `apium/py/test_credentials.py`: login por credenciales (sin QR).
- `apium/py/test_form_flow.py`: abre categoría y formulario (según `actual-db.json`), crea registro y envía.

Datos de prueba
- `actual-db.json` debe existir en la raíz del repo (ya lo tienes). `test_form_flow.py` busca por defecto:
  - Categoría: `Alimentos2.01`
  - Formulario: `Duplicados`
  Puedes editar estos nombres en `apium/py/test_form_flow.py` para apuntar a otros.

Variables de entorno útiles
- `APPIUM_SERVER_URL` (por defecto `http://127.0.0.1:4723`)
- `APPIUM_APP` ruta al APK si deseas instalar en cada corrida
- `APPIUM_UDID` (ej. `emulator-5554` o IP:PORT)
- `APPIUM_APP_PACKAGE` y `APPIUM_APP_ACTIVITY` (si la app ya está instalada)
- `APPIUM_TEST_USER` y `APPIUM_TEST_PASS` para las credenciales

Ejecución
1) Inicia Appium: `appium`
2) Ejecuta pruebas: `pytest -q apium/py`

Notas
- Los helpers replican el comportamiento robusto de `apium.py` (scroll/tap por texto o content-desc).
- Si ya estás logueado, el test de flujo intentará continuar sin fallar en el paso de credenciales.
