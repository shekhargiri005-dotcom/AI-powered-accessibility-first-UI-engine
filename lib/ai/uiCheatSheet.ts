/**
 * @file lib/ai/uiCheatSheet.ts
 *
 * Injected into AI prompts as a quick-reference for packages that are actually
 * available in the Sandpack sandbox. Previously referenced phantom @ui/* packages
 * that do not exist — replaced with real package API docs.
 */

export const UI_ECOSYSTEM_API_CHEAT_SHEET = `
=== SANDBOX PACKAGE API REFERENCE ===
These are the ONLY packages available. Do not import anything else.

[framer-motion]
import { motion, AnimatePresence, useReducedMotion, useScroll, useTransform, useSpring } from 'framer-motion';
<motion.div animate={{ opacity: 1 }} initial={{ opacity: 0 }} transition={{ duration: 0.3 }}>
<AnimatePresence> wraps conditionally rendered elements for exit animations.
useReducedMotion() → boolean — MUST check before animating (a11y).
useScroll({ target: ref, offset: ['start end', 'end start'] }) → { scrollYProgress }
useTransform(scrollYProgress, [0, 1], ['0px', '-90px']) → MotionValue

[recharts]
import { BarChart, LineChart, PieChart, AreaChart, Bar, Line, Pie, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
<ResponsiveContainer width="100%" height={300}>
  <LineChart data={data}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="name" />
    <YAxis />
    <Tooltip />
    <Legend />
    <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} />
  </LineChart>
</ResponsiveContainer>

[lucide-react — available icons]
import { ArrowRight, Check, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Search, Bell, Settings, User, Users, Menu, Home, Star, Heart, Plus, Minus,
  Edit, Edit2, Trash2, Eye, EyeOff, Download, Upload, Filter, RefreshCw,
  ExternalLink, Clock, Calendar, Mail, Phone, Globe, Lock, Unlock,
  Shield, Zap, TrendingUp, TrendingDown, Activity, BarChart2, PieChart,
  Target, Award, Bookmark, Share2, MessageSquare, MessageCircle,
  ThumbsUp, ThumbsDown, AlertCircle, AlertTriangle, Info,
  CheckCircle, XCircle, HelpCircle, Loader, Loader2,
  Image, File, FileText, Folder, FolderOpen,
  Copy, Clipboard, Link, Maximize2, Minimize2,
  Moon, Sun, LogIn, LogOut, Send, Save, Play, Pause, Stop,
  ChevronFirst, ChevronLast, ArrowLeft, ArrowUp, ArrowDown
} from 'lucide-react';
Usage: <ArrowRight className="w-4 h-4" />  — NEVER append 'Icon' suffix.

[react hooks]
useState, useEffect, useRef, useCallback, useMemo, useContext, useReducer, useId
=====================================
`.trim();
