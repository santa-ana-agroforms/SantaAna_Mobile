from time import sleep
import json
import os
from pathlib import Path
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from appium.webdriver.common.appiumby import AppiumBy

from .utils import (
    make_android_driver,
    wait_for_n_edittexts,
    type_and_close_kb,
    find_and_tap_with_scroll,
)


def load_actual_db():
    p = Path.cwd() / "actual-db.json"
    if p.exists():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            return None
    return None


def test_form_crear_completar_enviar():
    data = load_actual_db()
    assert data, "actual-db.json no encontrado o inválido en el directorio actual"

    # Selecciona categoría y formulario desde el JSON
    # Por defecto usamos los del ejemplo del apium.py: Alimentos2.01 / Duplicados
    category_name = None
    form_name = None
    for grp in data:
        if grp.get("nombre_categoria") == "Alimentos2.01":
            category_name = grp.get("nombre_categoria")
            for f in grp.get("formularios", []):
                if f.get("nombre") == "Duplicados":
                    form_name = f.get("nombre")
                    break
            break
    assert category_name and form_name, "No se hallaron 'Alimentos2.01'/'Duplicados' en actual-db.json"

    drv = make_android_driver(
        apk_path=os.getenv("APPIUM_APP", r"C:\\Users/danar/Emul/Test-app.apk"),
        udid=os.getenv("APPIUM_UDID", "R5CX615KS3D"),
        app_package=os.getenv("APPIUM_APP_PACKAGE", "com.anonymous.SantaAna_Mobile"),
        app_activity=os.getenv("APPIUM_APP_ACTIVITY", "com.anonymous.SantaAna_Mobile.MainActivity"),
    )
    wait = WebDriverWait(drv, 40, poll_frequency=0.25)

    try:
        sleep(1)

        # Login rápido si hace falta (Credenciales)
        try:
            cred_tab = wait.until(EC.element_to_be_clickable((AppiumBy.ACCESSIBILITY_ID, "Credenciales")))
            cred_tab.click()
            edits = wait_for_n_edittexts(drv, n=2, timeout=25)
            user_input, pass_input = edits[0], edits[1]
            user = os.getenv("APPIUM_TEST_USER", "dahernandez")
            pwd = os.getenv("APPIUM_TEST_PASS", "diegomovil1")
            type_and_close_kb(user_input, user, drv)
            type_and_close_kb(pass_input, pwd, drv)
            try:
                login_btn = wait.until(EC.element_to_be_clickable((AppiumBy.ACCESSIBILITY_ID, "Ingresar")))
                login_btn.click()
            except Exception:
                btn = wait.until(EC.presence_of_element_located((
                    AppiumBy.ANDROID_UIAUTOMATOR, 'new UiSelector().textContains("Ingresar")'
                )))
                drv.execute_script("mobile: clickGesture", {"x": btn.rect["x"] + 5, "y": btn.rect["y"] + 5})
            sleep(8)
        except Exception:
            # si ya estaba logueado, ignoramos
            pass

        # Abrir categoría
        assert find_and_tap_with_scroll(drv, category_name), f"No se encontró categoría: {category_name}"

        # Abrir formulario
        assert find_and_tap_with_scroll(drv, form_name), f"No se encontró formulario: {form_name}"

        # + Nuevo registro
        assert (
            find_and_tap_with_scroll(drv, "+ Nuevo registro")
            or find_and_tap_with_scroll(drv, "Nuevo registro")
        ), "No se encontró '+ Nuevo registro'"

        # Confirmación "Sí" / "Si"
        sleep(1)
        assert (
            find_and_tap_with_scroll(drv, "Sí")
            or find_and_tap_with_scroll(drv, "Si")
        ), "No apareció botón de confirmación 'Sí'"

        # Ejemplo de campo: "Seleccionar fecha" -> Aceptar
        assert find_and_tap_with_scroll(drv, "Seleccionar fecha"), "Falta 'Seleccionar fecha'"
        assert find_and_tap_with_scroll(drv, "Aceptar"), "Falta 'Aceptar' en fecha"

        # Enviar
        assert find_and_tap_with_scroll(drv, "Enviar"), "No se encontró 'Enviar'"

        sleep(2)
        drv.get_screenshot_as_file("apium_form_enviado.png")
    finally:
        drv.quit()

