// app/qr.tsx
import QrLoginOnBoarding from "@/pages/QrLoginOnBoarding";
import { Redirect } from "expo-router";
import { useState } from "react";

export default function QrScreen() {
  const [done, setDone] = useState(false);

  if (done) return <Redirect href="/" />;  // ✅ navega sin efectos secundarios

  return (
    <QrLoginOnBoarding
      endpoint="/auth/qr/login"
      autoSync
      onSuccess={() => setDone(true)}
    />
  );
}
