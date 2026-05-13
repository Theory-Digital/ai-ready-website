"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface ScoreChartProps {
  score: number;
  size?: number;
}

export default function ScoreChart({ score, size = 200 }: ScoreChartProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const radius = size / 2 - 20;
  const circumference = 2 * Math.PI * radius;
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedScore(score);
    }, 300);
    return () => clearTimeout(timer);
  }, [score]);

  // Calculate stroke dash offset for the progress
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;
  
  // Determine color based on score
  const getColor = () => {
    if (score >= 80) return "#10b981";
    if (score >= 50) return "#f59e0b";
    return "#ef4444";
  };

  const getTextColor = () => {
    if (score >= 80) return "text-emerald-700";
    if (score >= 50) return "text-amber-700";
    return "text-red-700";
  };
  
  const gradientId = "score-gradient";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={getColor()} stopOpacity="1" />
            <stop offset="100%" stopColor={getColor()} stopOpacity="0.6" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(0,0,0,0.05)"
          strokeWidth="12"
        />
        
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          filter="url(#glow)"
        />
      </svg>
      
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.div
          className={`text-4xl font-bold ${getTextColor()}`}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          {animatedScore}%
        </motion.div>
      </div>
    </div>
  );
}
