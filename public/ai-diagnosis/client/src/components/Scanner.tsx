import { motion } from "framer-motion";

export function Scanner() {
  return (
    <div className="relative w-64 h-64 border-2 border-primary/50 rounded-2xl overflow-hidden bg-black/20 backdrop-blur-sm">
      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
        <div className="border-r border-b border-primary/20"></div>
        <div className="border-b border-primary/20"></div>
        <div className="border-r border-primary/20"></div>
        <div></div>
      </div>
      
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-accent rounded-tl-sm"></div>
      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-accent rounded-tr-sm"></div>
      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-accent rounded-bl-sm"></div>
      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-accent rounded-br-sm"></div>

      {/* Scanning effect */}
      <motion.div 
        className="absolute left-0 right-0 h-1 bg-accent/50 shadow-[0_0_15px_rgba(6,182,212,0.6)]"
        animate={{ top: ["0%", "100%", "0%"] }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
      />
      
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-mono text-accent/80 tracking-widest animate-pulse">ANALYZING...</span>
      </div>
    </div>
  );
}
