from time import sleep
from appium.webdriver.common.appiumby import AppiumBy
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from utils import (
    make_android_driver,
    wait_for_n_edittexts,
    type_and_close_kb,
    try_find_by_label,
    find_and_tap_with_scroll,
    tap_rect_center,
)

APK_PATH = r"C:\Users/danar/Emul/Test-app.apk"
UDID = "R5CX615KS3D"
PKG = "com.anonymous.SantaAna_Mobile"
ACT = "com.anonymous.SantaAna_Mobile.MainActivity"

 

caps = {
    "platformName": "Android",
    "appium:automationName": "UiAutomator2",
    "appium:udid": UDID,
    "appium:app": APK_PATH,  # comenta esta línea si ya está instalada
    "appium:appPackage": PKG,
    "appium:appActivity": ACT,
    "appium:autoGrantPermissions": True,
    "appium:newCommandTimeout": 240,
}

driver = make_android_driver(
    apk_path=APK_PATH,
    udid=UDID,
    app_package=PKG,
    app_activity=ACT,
    server_url="http://127.0.0.1:4723",
)

# Ajustes en caliente
driver.update_settings({
    "enforceXPath1": True,         # evita el bug de XPath2
    "waitForIdleTimeout": 0,       # reduce esperas de "UI idle"
    "ignoreUnimportantViews": True # mejora performance
})

wait = WebDriverWait(driver, 40, poll_frequency=0.25)

try:
    sleep(1.2)

    # 1) Ir a "Credenciales"
    cred_tab = wait.until(EC.element_to_be_clickable((AppiumBy.ACCESSIBILITY_ID, "Credenciales")))
    cred_tab.click()

    # 2) Completar usuario/contraseña
    edits = wait_for_n_edittexts(driver, n=2, timeout=25)
    user_input, pass_input = edits[0], edits[1]
    type_and_close_kb(user_input, "dahernandez", driver)
    type_and_close_kb(pass_input, "diegomovil1", driver)

    # 3) Asegurar teclado abajo y tocar "Ingresar"
    for _ in range(2):
        try:
            driver.hide_keyboard()
        except Exception:
            try:
                driver.execute_script("mobile: performEditorAction", {"action": "done"})
            except Exception:
                try:
                    driver.back()
                except Exception:
                    pass
        sleep(0.2)

    login_btn = None
    try:
        login_btn = wait.until(EC.element_to_be_clickable((AppiumBy.ACCESSIBILITY_ID, "Ingresar")))
        login_btn.click()
    except TimeoutException:
        try:
            login_btn = wait.until(EC.element_to_be_clickable((
                AppiumBy.ANDROID_UIAUTOMATOR, 'new UiSelector().descriptionContains("Ingresar")'
            )))
            login_btn.click()
        except TimeoutException:
            login_btn = wait.until(EC.presence_of_element_located((
                AppiumBy.ANDROID_UIAUTOMATOR, 'new UiSelector().textContains("Ingresar")'
            )))
            tap_rect_center(driver, login_btn)

    # 4) Espera 10s a que cargue el Home/listas
    sleep(10)

    # 5) Abrir "Alimentos2.01"
    if not find_and_tap_with_scroll(driver, "Alimentos2.01"):
        raise RuntimeError("No se encontró 'Alimentos2.01' en la vista.")

    # 6) Abrir "Duplicados"
    if not find_and_tap_with_scroll(driver, "Duplicados"):
        raise RuntimeError("No se encontró 'Duplicados'.")

    # 7) Tap en "+ Nuevo registro" (o "Nuevo registro" de fallback)
    if not (find_and_tap_with_scroll(driver, "+ Nuevo registro") or
            find_and_tap_with_scroll(driver, "Nuevo registro")):
        raise RuntimeError("No se encontró '+ Nuevo registro'.")

    # 8) Esperar 1s y confirmar "Sí" (también probar 'Si')
    sleep(1)
    if not (find_and_tap_with_scroll(driver, "Sí") or
            find_and_tap_with_scroll(driver, "Si")):
        raise RuntimeError("No apareció el botón 'Sí'.")

    # 9) Seleccionar fecha -> Aceptar -> Aceptar
    if not find_and_tap_with_scroll(driver, "Seleccionar fecha"):
        raise RuntimeError("No se encontró 'Seleccionar fecha'.")
    if not find_and_tap_with_scroll(driver, "Aceptar"):
        raise RuntimeError("No se encontró el primer 'Aceptar'.")

    # 10) Enviar
    if not find_and_tap_with_scroll(driver, "Enviar"):
        raise RuntimeError("No se encontró 'Enviar'.")

    # Evidencias opcionales
    sleep(2)
    driver.get_screenshot_as_file("post_enviar.png")
    with open("post_enviar.xml", "w", encoding="utf-8") as f:
        f.write(driver.page_source)

finally:
    driver.quit()
