import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost, saveUser } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Icon from "@/components/ui/icon";

const Login = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const action = isRegister ? "register" : "login";
    const body: Record<string, string> = { username, password };
    if (isRegister) body.display_name = displayName;

    const data = await apiPost("auth", action, body);
    setLoading(false);

    if (data.error) {
      setError(data.error);
      return;
    }

    saveUser(data);
    navigate("/messenger");
  };

  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Messenger Bobs</h1>
          <p className="text-neutral-400">
            {isRegister ? "Создайте аккаунт" : "Войдите в аккаунт"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-neutral-800 rounded-2xl p-6 space-y-4">
          {isRegister && (
            <div>
              <label className="text-sm text-neutral-400 mb-1 block">Имя</label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Как вас зовут?"
                className="bg-neutral-700 border-neutral-600 text-white placeholder:text-neutral-500"
              />
            </div>
          )}
          <div>
            <label className="text-sm text-neutral-400 mb-1 block">Логин</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Придумайте логин"
              className="bg-neutral-700 border-neutral-600 text-white placeholder:text-neutral-500"
            />
          </div>
          <div>
            <label className="text-sm text-neutral-400 mb-1 block">Пароль</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль"
              className="bg-neutral-700 border-neutral-600 text-white placeholder:text-neutral-500"
            />
          </div>

          {error && (
            <div className="bg-red-500/20 text-red-400 text-sm px-4 py-2 rounded-lg">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black hover:bg-neutral-200 font-medium"
          >
            {loading ? (
              <Icon name="Loader2" className="animate-spin" size={20} />
            ) : isRegister ? "Зарегистрироваться" : "Войти"}
          </Button>

          <p className="text-center text-neutral-400 text-sm">
            {isRegister ? "Уже есть аккаунт?" : "Нет аккаунта?"}{" "}
            <button
              type="button"
              onClick={() => { setIsRegister(!isRegister); setError(""); }}
              className="text-white hover:underline"
            >
              {isRegister ? "Войти" : "Зарегистрироваться"}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;
