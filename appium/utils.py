from time import sleep
from typing import Optional

from appium import webdriver
from appium.options.android import UiAutomator2Options
from appium.webdriver.common.appiumby import AppiumBy
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
import os


def make_android_driver(
    apk_path: Optional[str] = None,
    udid: Optional[str] = None,
    app_package: Optional[str] = None,
    app_activity: Optional[str] = None,
    server_url: Optional[str] = None,
):
    caps = {
        "platformName": "Android",
        "appium:automationName": "UiAutomator2",
        "appium:udid": udid or os.getenv("APPIUM_UDID"),
        "appium:app": apk_path or os.getenv("APPIUM_APP"),
        "appium:appPackage": app_package or os.getenv("APPIUM_APP_PACKAGE"),
        "appium:appActivity": app_activity or os.getenv("APPIUM_APP_ACTIVITY"),
        "appium:autoGrantPermissions": True,
        "appium:newCommandTimeout": 240,
    }
    drv = webdriver.Remote(
        server_url or os.getenv("APPIUM_SERVER_URL", "http://127.0.0.1:4723"),
        options=UiAutomator2Options().load_capabilities(caps),
    )
    drv.implicitly_wait(0)
    drv.update_settings({
        "enforceXPath1": True,
        "waitForIdleTimeout": 0,
        "ignoreUnimportantViews": True,
    })
    return drv


def wait_for_n_edittexts(driver, n=2, timeout=25):
    def _poll(drv):
        els = drv.find_elements(AppiumBy.CLASS_NAME, "android.widget.EditText")
        return els if len(els) >= n else False

    return WebDriverWait(driver, timeout, poll_frequency=0.5).until(_poll)


def type_and_close_kb(element, text, driver):
    element.click()
    element.clear()
    element.send_keys(text)
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
    sleep(0.3)


def tap_rect_center(driver, elem):
    rect = elem.rect
    cx = rect["x"] + rect["width"] // 2
    cy = rect["y"] + rect["height"] // 2
    driver.execute_script("mobile: clickGesture", {"x": cx, "y": cy})


def try_find_by_label(driver, label, per_try_timeout=2.5):
    wait = WebDriverWait(driver, per_try_timeout, poll_frequency=0.25)
    for by, val in [
        (AppiumBy.ACCESSIBILITY_ID, label),
        (AppiumBy.ANDROID_UIAUTOMATOR, f'new UiSelector().descriptionContains("{label}")'),
        (AppiumBy.ANDROID_UIAUTOMATOR, f'new UiSelector().textContains("{label}")'),
    ]:
        try:
            return wait.until(EC.presence_of_element_located((by, val)))
        except TimeoutException:
            pass
    return None


def find_and_tap_with_scroll(driver, label, max_swipes=6, per_try_timeout=2.5):
    print(f"Buscando y tocando '{label}' con scroll...")
    el = try_find_by_label(driver, label, per_try_timeout=per_try_timeout)
    if el:
        try:
            WebDriverWait(driver, per_try_timeout, 0.2).until(EC.element_to_be_clickable(el))
            el.click()
        except Exception:
            tap_rect_center(driver, el)
        return True

    vp = driver.execute_script("mobile: viewportRect")
    left, top, width, height = vp["left"], vp["top"], vp["width"], vp["height"]

    for _ in range(max_swipes):
        driver.execute_script(
            "mobile: scrollGesture",
            {"left": left, "top": top, "width": width, "height": height, "direction": "up", "percent": 0.85},
        )
        sleep(0.25)
        el = try_find_by_label(driver, label, per_try_timeout=per_try_timeout)
        if el:
            try:
                WebDriverWait(driver, per_try_timeout, 0.2).until(EC.element_to_be_clickable(el))
                el.click()
            except Exception:
                tap_rect_center(driver, el)
            return True
    return False

