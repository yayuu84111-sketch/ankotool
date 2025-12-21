import { useState } from "react";
import { useForm } from "react-hook-form";
import { useLogin } from "@/hooks/use-auth";
import { useCaptures } from "@/hooks/use-captures";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Lock, LayoutGrid, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { motion } from "framer-motion";

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { mutate: login, isPending: isLoggingIn, error: loginError } = useLogin();
  
  const { data: captures, isLoading: isLoadingCaptures, isError: isCapturesError } = useCaptures();

  if (!isAuthenticated && captures) {
    setIsAuthenticated(true);
  }

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    
    login(password, {
      onSuccess: () => setIsAuthenticated(true)
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-white via-blue-50 to-green-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
        <Card className="w-full max-w-md border-green-200 dark:border-green-700/50 bg-white dark:bg-slate-800">
          <CardContent className="pt-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-100 to-blue-100 dark:from-green-900/30 dark:to-blue-900/30 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">管理者アクセス</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">パスワードを入力してスキャン履歴を表示します</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="password"
                  name="password"
                  placeholder="パスワード"
                  className="bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 focus:border-green-500 dark:focus:border-green-400 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400"
                  data-testid="input-password"
                  required
                />
              </div>
              
              {loginError && (
                <Alert variant="destructive" className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-700 dark:text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{loginError.message}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white" disabled={isLoggingIn} data-testid="button-login">
                {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : "ダッシュボードにアクセス"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-8 space-y-8 bg-gradient-to-br from-white via-blue-50 to-green-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">スキャン管理</h1>
          <p className="text-slate-600 dark:text-slate-400">受け取ったスキャンを確認・管理します</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-green-100 to-blue-100 dark:from-green-900/30 dark:to-blue-900/30 border border-green-200 dark:border-green-700 text-green-600 dark:text-green-400 text-sm font-medium" data-testid="text-capture-count">
          <LayoutGrid className="w-4 h-4" />
          {captures?.length || 0} スキャン
        </div>
      </header>

      {isLoadingCaptures ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-green-600 dark:text-green-400" />
        </div>
      ) : isCapturesError ? (
        <Alert variant="destructive" className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>スキャンの読み込みに失敗しました。もう一度ログインしてください。</AlertDescription>
        </Alert>
      ) : captures?.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl bg-slate-50/50 dark:bg-slate-800/50">
          <p className="text-slate-500 dark:text-slate-400">スキャンがまだありません</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {captures?.map((capture, index) => (
            <motion.div
              key={capture.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className="group relative aspect-video bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-700 dark:to-slate-800 rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 hover:border-green-400 dark:hover:border-green-500 transition-all hover:shadow-lg"
              data-testid={`card-capture-${capture.id}`}
            >
              <img 
                src={capture.imageData} 
                alt={`スキャン ${capture.id}`}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
                <div className="flex items-center gap-2 text-sm text-white/90">
                  <Clock className="w-4 h-4" />
                  {capture.createdAt ? format(new Date(capture.createdAt), 'PPP HH:mm:ss', { locale: ja }) : '不明'}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
