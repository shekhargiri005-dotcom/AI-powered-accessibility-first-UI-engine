/**
 * @file lib/ai/uiCheatSheet.ts
 *
 * Injected into AI prompts as a quick-reference for packages that are actually
 * available in the Sandpack sandbox. Includes both third-party libraries AND
 * the @ui/* component ecosystem.
 */

export const UI_ECOSYSTEM_API_CHEAT_SHEET = `
=== SANDBOX PACKAGE API REFERENCE ===
These are the ONLY packages available. Do not import anything else.

[@ui/core] — Primitive UI components (dark-themed)
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Input, Textarea, Modal, ModalContent, ModalTrigger, ModalHeader, ModalTitle, ModalDescription, ModalFooter, Badge, Avatar } from '@ui/core';
<Button variant="default|destructive|outline|secondary|ghost|link" size="default|sm|lg|icon" isLoading={bool} asChild={bool}>Label</Button>
<Card variant="default|glass|elevated|outline|gradient" hover={bool} padding="none|sm|md|lg">
  <CardHeader><CardTitle>Title</CardTitle><CardDescription>Desc</CardDescription></CardHeader>
  <CardContent>Body</CardContent>
  <CardFooter>Actions</CardFooter>
</Card>
<Input label="Email" error="Required" hint="user@domain" variant="default|filled|ghost" inputSize="sm|md|lg" leftIcon={<Icon/>} rightIcon={<Icon/>} />
<Textarea label="Notes" error="Too long" minRows={3} />
<Badge variant="default|success|warning|error|info|outline" size="sm|md">Active</Badge>
<Avatar src="/img.jpg" alt="User" fallback="JD" size="xs|sm|md|lg|xl" status="online|offline|busy|away" />
<Modal><ModalTrigger>Open</ModalTrigger><ModalContent>...</ModalContent></Modal>

[@ui/forms] — Form controls with labels, errors, a11y
import { Form, FormField, Select, Checkbox, Toggle, RadioGroup } from '@ui/forms';
<Form onSubmit={fn} className="..."><FormField label="Name" required error="Required" htmlFor="name">...</FormField></Form>
<Select options={[{value:'us',label:'US'}]} placeholder="Country" error={string} />
<Checkbox label="Accept terms" description="Required to proceed" />
<Toggle label="Dark mode" description="Switch theme" checked={bool} onChange={fn} />
<RadioGroup name="plan" options={[{value:'free',label:'Free',description:'Basic'}]} value="free" onChange={fn} />

[@ui/layout] — Layout primitives with responsive breakpoints
import { Grid, Stack, Container, Divider, Section } from '@ui/layout';
<Grid cols={3} smCols={2} mdCols={3} lgCols={4} gap={6}>...</Grid>
<Stack direction="row|col" gap={4} align="center" justify="between" wrap={bool}>...</Stack>
<Container size="sm|md|lg|xl|full">...</Container>
<Divider orientation="horizontal|vertical" label="OR" />
<Section title="Features" description="What we offer">...</Section>

[@ui/icons] — 50+ inline SVG icons (zero dependency)
import { Icon } from '@ui/icons';
<Icon name="arrow-right" size="sm|md|lg|xl" color="#3b82f6" strokeWidth={2} />
Available names: arrow-left, arrow-right, arrow-up, arrow-down, chevron-down/up/left/right, menu, x, external-link, plus, minus, check, search, filter, download, upload, edit, trash, copy, save, refresh, file, folder, image, code, link, info, alert-triangle, alert-circle, check-circle, x-circle, help-circle, mail, message-circle, send, bell, settings, home, user, users, lock, eye, eye-off, star, heart, clock, zap, globe, moon, sun, palette, sparkles, cpu, layers

[@ui/a11y] — Accessibility utilities
import { FocusTrap, SkipLink, VisuallyHidden, useAnnouncer, useKeyboardNav, useRoveFocus } from '@ui/a11y';
<FocusTrap active={bool} restoreFocus={bool}>{children}</FocusTrap>
<SkipLink targetId="main-content">Skip to content</SkipLink>
<VisuallyHidden>Screen reader only text</VisuallyHidden>
const announce = useAnnouncer(); announce('Saved', 'polite');
useKeyboardNav([{ key:'k', ctrl:true, handler:() => {} }]);
const { currentIndex, handleKeyDown } = useRoveFocus(5, 'horizontal');

[@ui/charts] — SVG chart components (zero dependency)
import { ChartContainer, BarChart, LineChart, DonutChart, SparkLine } from '@ui/charts';
<ChartContainer title="Revenue" subtitle="Monthly"><BarChart data={[{label:'Jan',value:30,color:'#3b82f6'}]} height={200} showLabels showValues /></ChartContainer>
<LineChart data={[{label:'Q1',value:10}]} height={200} color="#8b5cf6" fill showDots />
<DonutChart data={[{label:'Direct',value:40,color:'#3b82f6'}]} size={160} thickness={24} />
<SparkLine data={[10,20,15,30,25]} width={120} height={32} color="#3b82f6" />

[@ui/dragdrop] — Drag & drop components
import { DragDrop, DropZone } from '@ui/dragdrop';
<DragDrop items={[{id:'1',content:<Card>...</Card>}]} onReorder={(from,to) => {}} orientation="vertical" />
<DropZone onDrop={(data) => {}} active={bool}>Drop files here</DropZone>

[@ui/editor] — Rich text editor with formatting toolbar
import { RichTextEditor } from '@ui/editor';
<RichTextEditor value={html} onChange={setHtml} placeholder="Write..." minHeight={200} disabled={bool} error={string} />

[@ui/motion] — Viewport-reveal animation wrapper
import { Motion, MotionGroup } from '@ui/motion';
<Motion variant="fade|slide|scale|reveal|pop" delay={0.1} duration={0.5}>{children}</Motion>
<MotionGroup stagger={0.1}>{children}</MotionGroup>

[@ui/theming] — Theme provider (dark/light/system)
import { ThemeProvider, useTheme } from '@ui/theming';
<ThemeProvider defaultTheme="dark">{app}</ThemeProvider>
const { theme, setTheme } = useTheme();

[@ui/command-palette] — Command palette (cmdk-based)
import { CommandPalette, CommandInput, CommandList, CommandGroup, CommandItem, CommandEmpty } from '@ui/command-palette';
<CommandPalette isOpen={bool} onClose={fn}><CommandInput placeholder="Search..." /><CommandList><CommandGroup heading="Actions"><CommandItem onSelect={fn}>Action</CommandItem></CommandGroup><CommandEmpty>No results</CommandEmpty></CommandList></CommandPalette>

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
