export async function predictAutocomplete(fieldId: string, context: Record<string, string>): Promise<string[]> {
  // Mock OpenAI autocomplete
  console.log(`Predicting for ${fieldId} with context`, context);
  if (fieldId === 'country') return ['United States', 'United Kingdom', 'Canada'];
  return ['Suggestion 1', 'Suggestion 2'];
}
