export async function generatePaletteFromMood(mood: string): Promise<Record<string, string>> {
  // Mock AI generation
  console.log(`Analyzing mood: ${mood}`);
  return {
    primary: mood.includes('dark') ? '#4F46E5' : '#10B981',
    background: mood.includes('dark') ? '#111827' : '#F9FAFB',
    text: mood.includes('dark') ? '#F3F4F6' : '#1F2937',
  };
}
