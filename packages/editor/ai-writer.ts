export async function analyzeTone(_text: string): Promise<string> {
  console.log('Analyzing tone...');
  return 'Professional & Concise';
}

export async function summarizeText(text: string): Promise<string> {
  console.log('Summarizing...');
  return text.substring(0, 50) + '... (Summarized by AI)';
}
