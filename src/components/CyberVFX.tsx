import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type ActionType = 'save' | 'delete' | 'modify' | 'error';
export type VFXStatus = 'loading' | 'resolved';

interface VFXState {
  type: ActionType;
  message: string;
  status: VFXStatus;
  id: number;
}

type VFXTrigger = (type: ActionType, message: string) => void;
type VFXResolver = (message: string) => void;

let triggerVFX: VFXTrigger | null = null;
let resolverVFX: VFXResolver | null = null;
let cancelerVFX: (() => void) | null = null;

export const playVFX = (type: ActionType, message: string) => {
  if (triggerVFX) triggerVFX(type, message);
};

export const resolveVFX = (message: string) => {
  if (resolverVFX) resolverVFX(message);
};

export const cancelVFX = () => {
  if (cancelerVFX) cancelerVFX();
};

export const CyberVFX: React.FC = () => {
  const [active, setActive] = useState<VFXState | null>(null);

  useEffect(() => {
    triggerVFX = (type, message) => {
      // Logic still exists but UI is hidden
      setActive({ type, message, status: 'loading', id: Date.now() });
    };

    resolverVFX = (message) => {
      setActive(null); // Instant clear, no delay
    };

    cancelerVFX = () => setActive(null);

    return () => {
      triggerVFX = null;
      resolverVFX = null;
      cancelerVFX = null;
    };
  }, []);

  return null; // Disabled as per user request
};

// --- Minimalist SVG Components ---

const MinimalScanner = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full">
    <motion.circle
      cx="50" cy="50" r="40"
      fill="none"
      stroke="white"
      strokeWidth="1.5"
      strokeDasharray="5 15"
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
      opacity={0.2}
    />
    <motion.circle
      cx="50" cy="50" r="40"
      fill="none"
      stroke="#00f7ff"
      strokeWidth="3"
      strokeLinecap="round"
      initial={{ pathLength: 0.2, rotate: 0 }}
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
    />
  </svg>
);

const UnifiedSuccess = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full">
    {/* Clean Circle */}
    <motion.circle
      cx="50" cy="50" r="40"
      fill="none"
      stroke="#00f7ff"
      strokeWidth="4"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    />
    {/* Minimal Checkmark */}
    <motion.path
      d="M32 52 L45 65 L68 38"
      fill="none"
      stroke="white"
      strokeWidth="8"
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 0.3, delay: 0.4, ease: "easeOut" }}
    />
  </svg>
);
