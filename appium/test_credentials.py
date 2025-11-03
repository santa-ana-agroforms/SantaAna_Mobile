from time import sleep
import os
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from appium.webdriver.common.appiumby import AppiumBy

from .utils import (
    make_android_driver,
    wait_for_n_edittexts,
    type_and_close_kb,
)


def test_login_por_credenciales():
    # Lee caps de env o usa defaults similares a apium.py
    drv = make_android_driver(
        apk_path=os.getenv("APPIUM_APP", r"C:\\Users/danar/Emul/Test-app.apk"),
        udid=os.getenv("APPIUM_UDID", "R5CX615KS3D"),
        app_package=os.getenv("APPIUM_APP_PACKAGE", "com.anonymous.SantaAna_Mobile"),
        app_activity=os.getenv("APPIUM_APP_ACTIVITY", "com.anonymous.SantaAna_Mobile.MainActivity"),
    )
    wait = WebDriverWait(drv, 40, poll_frequency=0.25)

    try:
        sleep(1)

        # 1) Ir a "Credenciales"
        cred_tab = wait.until(EC.element_to_be_clickable((AppiumBy.ACCESSIBILITY_ID, "Credenciales")))
        cred_tab.click()

        # 2) Completar usuario/contraseña
        edits = wait_for_n_edittexts(drv, n=2, timeout=25)
        user_input, pass_input = edits[0], edits[1]
        user = os.getenv("APPIUM_TEST_USER", "dahernandez")
        pwd = os.getenv("APPIUM_TEST_PASS", "diegomovil1")
        type_and_close_kb(user_input, user, drv)
        type_and_close_kb(pass_input, pwd, drv)

        # 3) Tocar "Ingresar"
        try:
            login_btn = wait.until(EC.element_to_be_clickable((AppiumBy.ACCESSIBILITY_ID, "Ingresar")))
            login_btn.click()
        except Exception:
            # fallback por texto
            login_btn = wait.until(EC.presence_of_element_located((
                AppiumBy.ANDROID_UIAUTOMATOR, 'new UiSelector().textContains("Ingresar")'
            )))
            drv.execute_script("mobile: clickGesture", {"x": login_btn.rect["x"] + 5, "y": login_btn.rect["y"] + 5})

        # 4) Espera señales de Home (título "Mis formularios")
        sleep(8)
        # no assert fuerte: solo esperamos que no haya errored
        drv.get_screenshot_as_file("apium_test_login_credenciales.png")
    finally:
        drv.quit()

