import { motion } from "framer-motion";
import { CheckCircle2, Sparkles, Activity } from "lucide-react";

interface ResultCardProps {
  title: string;
  value: string;
  icon: "check" | "sparkles" | "activity";
  delay: number;
}

export function ResultCard({ title, value, icon, delay }: ResultCardProps) {
  const icons = {
    check: <CheckCircle2 className="w-5 h-5 text-green-400" />,
    sparkles: <Sparkles className="w-5 h-5 text-yellow-400" />,
    activity: <Activity className="w-5 h-5 text-blue-400" />,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="glass-card p-4 rounded-xl flex items-center gap-4"
    >
      <div className="p-3 bg-white/5 rounded-lg border border-white/5">
        {icons[icon]}
      </div>
      <div>
        <h4 className="text-sm text-muted-foreground font-medium">{title}</h4>
        <p className="text-lg font-bold text-foreground">{value}</p>
      </div>
    </motion.div>
  );
}
