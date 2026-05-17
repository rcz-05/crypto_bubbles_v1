import { AuthScreen } from "@/components/AuthScreen";

export const metadata = { title: "Sign in · CoinCanvas" };

export default function LoginPage() {
  return <AuthScreen mode="login" />;
}
