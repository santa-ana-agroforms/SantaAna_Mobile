import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, Text, View, useWindowDimensions } from "react-native";

export type NoticeKind = "success" | "info" | "warning" | "error";
type Placement = "top" | "bottom";

type MessageParams = Record<string, string | number>;

type Props = {
  kind: NoticeKind;

  /** Opción 1: texto directo (legacy). Si se usa, tiene prioridad sobre messageKey. */
  text?: string;

  /** Opción 2: clave de mensaje personalizada para usar el diccionario de copys. */
  messageKey?: keyof typeof NOTICE_COPY;

  /** Parámetros para interpolar en el mensaje del diccionario. */
  params?: MessageParams;

  /** Fallback si messageKey no existe. */
  fallbackText?: string;

  onClose?: () => void;
  autoHideMs?: number;
  /** Posición del banner: "top" o "bottom" (default: bottom) */
  placement?: Placement;
  /** Offset adicional en px desde el borde (usa SafeArea para top) */
  topInsetPx?: number;
  bottomInsetPx?: number;
};

/** ============================================================
 *  Diccionario de mensajes (personaliza todo aquí, una sola fuente de verdad)
 *  ============================================================ */
const NOTICE_COPY = {
  // Auth / Login
  "auth.offline_first_login": "Se requiere internet para el primer inicio de sesión.",
  "auth.invalid_creds": "Usuario o contraseña incorrectos.",
  "auth.expired_session": "Tu sesión no es válida o expiró. Inicia sesión nuevamente.",
  "auth.unexpected_no_token": "Respuesta inesperada del servidor (sin token). Intenta de nuevo.",
  "auth.rate_limited": "Demasiados intentos. Espera un momento antes de volver a intentar.",

  // QR
  "qr.invalid": "El código QR no es válido. Solicita uno nuevo.",
  "qr.expired": "El QR ha expirado. Solicita uno nuevo.",
  "qr.login_failed": "No se pudo completar el inicio por QR. Intenta nuevamente.",

  // Red / Conectividad / URL
  "net.no_connection": "Sin conexión a internet.",
  "net.timeout": "El servidor tardó demasiado en responder. Intenta de nuevo en unos segundos.",
  "net.ssl": "No se pudo establecer una conexión segura. Verifica la URL del API y tu conexión.",
  "net.dns": "No se pudo resolver el servidor. Verifica la URL del API.",

  // Validación / API genérico
  "api.validation": "Los datos enviados no son válidos. Revisa e inténtalo de nuevo.",
  "api.forbidden": "No tienes permisos para realizar esta acción.",
  "api.not_found": "Recurso no encontrado. Intenta nuevamente.",
  "api.server_error": "Estamos teniendo problemas del lado del servidor. Inténtalo más tarde.",

  // Sync
  "sync.failed":
    "Inicio de sesión correcto, pero la sincronización inicial falló. Puedes sincronizar luego desde el Home.",
  "sync.server_error": "No se pudo sincronizar por un problema del servidor. Inténtalo más tarde.",

  // Mensajes genéricos
  "generic.error": "No pudimos completar la acción. Intenta de nuevo.",
  "generic.success": "Operación realizada con éxito.",
} as const;

/** Interpolación simple: "Hola {nombre}" + params = "Hola Diego" */
const formatMessage = (template: string, params?: MessageParams) => {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
};

const kindStyle = (k: NoticeKind) => {
  switch (k) {
    case "success":
      return { bg: "#E7F6ED", fg: "#176B3A", icon: "checkmark-circle" as const };
    case "info":
      return { bg: "#EAF3FF", fg: "#1B5FBF", icon: "information-circle" as const };
    case "warning":
      return { bg: "#FFF6E5", fg: "#8B5E00", icon: "alert-circle" as const };
    case "error":
      return { bg: "#FDEBEC", fg: "#A3222B", icon: "warning" as const };
  }
};

const NoticeBar: React.FC<Props> = ({
  kind,
  text,
  messageKey,
  params,
  fallbackText,
  onClose,
  autoHideMs,
  placement = "bottom",
  topInsetPx,
  bottomInsetPx,
}) => {
  const anim = useRef(new Animated.Value(0)).current; // 0 oculto, 1 visible
  const { width, height } = useWindowDimensions();
  const minSide = Math.min(width, height);

  // Escalas basadas en minSide (sin clamp)
  const padH = minSide * 0.032;
  const padV = minSide * 0.022;
  const corner = minSide * 0.028;
  const gap = minSide * 0.018;
  const fontSize = minSide * 0.04;
  const iconSize = minSide * 0.05;
  const hit = minSide * 0.02;
  const insetLR = minSide * 0.03;
  const insetTop = topInsetPx ?? minSide * 0.02;
  const insetBottom = bottomInsetPx ?? minSide * 0.025;
  const slide = minSide * 0.05;

  // Resolvemos el texto a mostrar:
  // Prioridad: text (legacy) > messageKey (diccionario) > fallbackText > "generic.error"
  const resolvedText =
    text ??
    (messageKey
      ? formatMessage(
          NOTICE_COPY[messageKey] ?? fallbackText ?? NOTICE_COPY["generic.error"],
          params
        )
      : null) ??
    fallbackText ??
    NOTICE_COPY["generic.error"];

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    if (autoHideMs && autoHideMs > 0) {
      const t = setTimeout(() => handleClose(), autoHideMs);
      return () => clearTimeout(t);
    }
  }, [anim, autoHideMs]);

  const handleClose = () => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => onClose?.());
  };

  const s = kindStyle(kind);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: placement === "top" ? [-slide, 0] : [slide, 0],
  });

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        zIndex: 9999,
      }}
    >
      <Animated.View
        style={{
          position: "absolute",
          left: insetLR,
          right: insetLR,
          ...(placement === "top" ? { top: insetTop } : { bottom: insetBottom }),
          transform: [{ translateY }],
          opacity: anim,
        }}
      >
        <View
          style={{
            backgroundColor: s.bg,
            borderColor: s.fg,
            borderWidth: 1,
            borderRadius: corner,
            paddingVertical: padV,
            paddingHorizontal: padH,
            flexDirection: "row",
            alignItems: "center",
            gap,
            shadowColor: "#000",
            shadowOpacity: 0.08,
            shadowOffset: { width: 0, height: minSide * 0.012 },
            shadowRadius: minSide * 0.03,
            elevation: 3,
          }}
        >
          <Ionicons name={s.icon} size={iconSize} color={s.fg} />
          <Text numberOfLines={3} style={{ flex: 1, color: s.fg, fontWeight: "700", fontSize }}>
            {resolvedText}
          </Text>
          <Pressable
            onPress={handleClose}
            hitSlop={hit}
            style={{ paddingHorizontal: hit * 0.6, paddingVertical: hit * 0.4 }}
          >
            <Ionicons name="close" size={iconSize * 0.8} color={s.fg} />
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
};

export default NoticeBar;
