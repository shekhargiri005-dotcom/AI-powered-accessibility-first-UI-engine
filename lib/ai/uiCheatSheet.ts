export const UI_ECOSYSTEM_API_CHEAT_SHEET = `
=== @ui/* API CHEAT SHEET (CRITICAL) ===
You must strictly adhere to these props when composing components from your \`@ui/*\` ecosystem. DO NOT invent props.

[@ui/core]
<Button>: children(node), variant?("primary"|"secondary"|"danger"|"ghost"), size?("sm"|"md"|"lg"), isLoading?(boolean), disabled?(boolean), className?(string), onClick?(fn)
<Card>: children(node), variant?("default"|"outlined"|"elevated"), className?(string)
<Input>: label?(string), type?("text"|"password"|"email"|"number"), error?(string), askAI?(boolean), voiceActivation?(boolean), className?(string), ...htmlInputProps
<Modal>: isOpen(boolean), onClose(fn), title(string), children(node)

[@ui/layout]
<Grid>: children(node), cols?(1|2|3|4|6|12), gap?(string, default:"4"), className?(string)
<Stack>: children(node), direction?("row"|"col"), align?("start"|"center"|"end"|"stretch"), justify?("start"|"center"|"end"|"between"|"around"), gap?(string, default:"4"), wrap?(boolean), className?(string)
<Container>: children(node), maxWidth?("sm"|"md"|"lg"|"xl"|"2xl"|"full"), className?(string)

[@ui/typography]
<Heading>: children(node), level?(1|2|3|4|5|6), className?(string)
<Text>: children(node), size?("sm"|"base"|"lg"), muted?(boolean), className?(string)
<Caption>: children(node), className?(string)

[@ui/forms]
<Form>: children(node), onSubmit(fn), className?(string)
<Field>: name(string), label(string), children(node), error?(string)
Hooks: simulateAutocomplete(query) -> Promise<string[]>

[@ui/motion]
<Motion>: children(node), preset?("fade"|"slideUp"|"slideRight"|"scale"|"pop"), delay?(number), className?(string)
// CRITICAL: NEVER use <Motion.div>. If you need Framer Motion primitives, \`import { motion } from 'framer-motion'\`.

[@ui/a11y]
<FocusTrap>: children(node), active?(boolean)
<SkipLink>: targetId?(string, default:"main-content")
Hooks: useAnnouncer() -> (message: string, politeness?: "polite"|"assertive") => void

[@ui/theming]
<ThemeProvider>: children(node), defaultTheme?("light"|"dark"|"system")
Hooks: useTheme() -> { theme: string, setTheme: (t: string) => void } // Theme affects data-theme on html

[@ui/icons]
<Icon>: name(string - any lucide icon name like "Home", "User", "Settings"), size?(number|string), color?(string), className?(string)

[@ui/charts]
<BarChart>: data(any[]), className?(string)
<LineChart>: data(any[]), className?(string)
<PieChart>: data(any[]), className?(string)

[@ui/editor]
<RichTextEditor>: initialValue?(string), onAnalyze?(fn(text)) -> void

[@ui/command-palette]
<CommandPalette>: isOpen(boolean), onClose(fn), children(node)

[@ui/dragdrop]
<Draggable>: id(string), children(node)
<Droppable>: onDrop(fn(id)), children(node)
<SortableList>: items(string[]), onSort?(fn)

[@ui/three]
<Scene3D>: children(node), className?(string)
<AnimatedModel>: url(string), scale?(number), currentAction?(string)
<ParticleSystem>: amount(number), color(string)
=====================================
`.trim();
