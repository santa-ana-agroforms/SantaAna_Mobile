// app/qr.tsx
import QrLoginOnboarding from "@/pages/QrLoginOnBoarding";
import { router } from "expo-router";

export default function QrScreen() {
  return (
    <QrLoginOnboarding
      endpoint="/auth/qr/login"
      autoSync
      onSuccess={() => router.replace("/")} // vuelve al home cuando termine
    />
  );
}
