import os
import json
from time import sleep
from pathlib import Path

import pytest
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
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None


def _login_if_needed(drv, wait):
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
            wait.until(EC.element_to_be_clickable((AppiumBy.ACCESSIBILITY_ID, "Ingresar"))).click()
        except Exception:
            btn = wait.until(EC.presence_of_element_located((
                AppiumBy.ANDROID_UIAUTOMATOR, 'new UiSelector().textContains("Ingresar")'
            )))
            drv.execute_script("mobile: clickGesture", {"x": btn.rect["x"] + 5, "y": btn.rect["y"] + 5})
        sleep(6)
    except Exception:
        pass


@pytest.mark.parametrize("form_name", ["Formulario Prueba"])
def test_grupo_datos_del_lote(form_name):
    data = load_actual_db()
    if not data:
        pytest.skip("actual-db.json no disponible o inválido")

    category_name = None
    for grp in data:
        if grp.get("nombre_categoria") == "Alimentos2":
            category_name = grp.get("nombre_categoria")
            break

    if not category_name:
        pytest.skip("No se encontró categoría 'Alimentos2'")

    drv = make_android_driver(
        apk_path=os.getenv("APPIUM_APP", r"C:\\Users/danar/Emul/Test-app.apk"),
        udid=os.getenv("APPIUM_UDID", "R5CX615KS3D"),
        app_package=os.getenv("APPIUM_APP_PACKAGE", "com.anonymous.SantaAna_Mobile"),
        app_activity=os.getenv("APPIUM_APP_ACTIVITY", "com.anonymous.SantaAna_Mobile.MainActivity"),
    )
    wait = WebDriverWait(drv, 40, poll_frequency=0.25)

    try:
        _login_if_needed(drv, wait)

        assert find_and_tap_with_scroll(drv, category_name)
        assert find_and_tap_with_scroll(drv, form_name)
        assert (find_and_tap_with_scroll(drv, "+ Nuevo registro") or find_and_tap_with_scroll(drv, "Nuevo registro"))
        sleep(1)

        # Interactuar con el grupo
        assert find_and_tap_with_scroll(drv, "Ver registros"), "No se encontró el grupo 'Ver registros'"
        sleep(1)
        assert find_and_tap_with_scroll(drv, "Agregar registro"), "No se encontró 'Agregar registro'"
        sleep(1)
        assert find_and_tap_with_scroll(drv, "Selecciona una opción…"), "No se encontró el selector de opción"
        sleep(1)
        assert find_and_tap_with_scroll(drv, "Frijol"), "No se encontró 'Frijol'"
        sleep(1)
        assert find_and_tap_with_scroll(drv, "Listo"), "No se encontró 'Listo' para cerrar el selector"
        sleep(1)
        # Cerrar
        assert find_and_tap_with_scroll(drv, "Cerrar"), "No se encontró 'Cerrar' para cerrar el grupo"
        sleep(1)
        drv.get_screenshot_as_file(f"apium_grupo_datos__{form_name.replace(' ', '_')}.png")

        # Enviar sin más interacciones (solo comprobación de navegación)
        assert find_and_tap_with_scroll(drv, "Enviar")
        sleep(2)
        drv.get_screenshot_as_file(f"apium_grupo_datos_{form_name.replace(' ', '_')}.png")
        
    finally:
        drv.quit()

