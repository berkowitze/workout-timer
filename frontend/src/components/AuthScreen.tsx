import { AuthForm } from "./AuthForm";

interface AuthScreenProps {
  onAuthenticated: (token: string) => void;
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  return (
    <div className="min-h-screen bg-slate flex items-center justify-center p-4">
      <div className="bg-slate-light rounded-xl p-8 border border-gray-700 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-white text-center mb-6">Workout Timer</h1>
        <AuthForm onAuthenticated={onAuthenticated} />
      </div>
    </div>
  );
}
