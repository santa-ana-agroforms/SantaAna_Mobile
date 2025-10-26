// app/qr.tsx
import QrLoginOnBoarding from "@/pages/QrLoginOnBoarding";

const QrScreen = () => {
  return <QrLoginOnBoarding endpoint="/auth/qr/login" autoSync />;
};

export default QrScreen;
