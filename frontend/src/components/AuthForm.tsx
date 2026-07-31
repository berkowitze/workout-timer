import { useState } from "react";
import { login, register } from "../api/client";

interface AuthFormProps {
  onAuthenticated: (token: string) => void;
  // Called right before a full-page Google OAuth redirect (which wipes all
  // React state), so the caller can stash whatever needs to survive it.
  onBeforeGoogleRedirect?: () => void;
}

export function AuthForm({ onAuthenticated, onBeforeGoogleRedirect }: AuthFormProps) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }
    setLoading(true);
    try {
      const fn = tab === "login" ? login : register;
      const data = await fn(email, password);
      localStorage.setItem("auth_token", data.token);
      onAuthenticated(data.token);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number; data?: { error?: string } } })
        ?.response?.status;
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      if (status === 409) {
        setError("Email already registered");
      } else if (status === 401) {
        setError("Invalid credentials");
      } else {
        setError(msg || "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = () => {
    onBeforeGoogleRedirect?.();
    window.location.href = "/api/auth/google/login";
  };

  return (
    <div>
      {/* Tabs */}
      <div className="flex mb-6 border-b border-gray-700">
        <button
          onClick={() => { setTab("login"); setError(""); }}
          className={`flex-1 pb-2 text-sm font-medium transition-colors ${
            tab === "login"
              ? "text-ocean border-b-2 border-ocean"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          Login
        </button>
        <button
          onClick={() => { setTab("register"); setError(""); }}
          className={`flex-1 pb-2 text-sm font-medium transition-colors ${
            tab === "register"
              ? "text-ocean border-b-2 border-ocean"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          Register
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className="w-full px-4 py-3 bg-slate border border-gray-600 rounded-lg
                       text-white focus:outline-none focus:ring-2 focus:ring-ocean"
            placeholder="you@example.com"
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className="w-full px-4 py-3 bg-slate border border-gray-600 rounded-lg
                       text-white focus:outline-none focus:ring-2 focus:ring-ocean"
            placeholder="Password"
          />
        </div>

        {error && <p className="text-coral text-sm text-center">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3 bg-ocean hover:bg-ocean-dark text-white font-semibold
                     rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? "..." : tab === "login" ? "Login" : "Create Account"}
        </button>

        <div className="relative flex items-center">
          <div className="flex-grow border-t border-gray-700" />
          <span className="mx-3 text-gray-500 text-xs">or</span>
          <div className="flex-grow border-t border-gray-700" />
        </div>

        <button
          onClick={handleGoogleAuth}
          className="w-full py-3 bg-slate border border-gray-600 hover:border-gray-400
                     text-white font-medium rounded-lg transition-colors flex items-center
                     justify-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  );
}
