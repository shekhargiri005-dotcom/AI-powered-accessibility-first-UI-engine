export async function semanticSearch(query: string, options: string[]): Promise<string[]> {
  console.log(`Semantic searching for: ${query}`);
  // Mock AI semantic search returning closest matches
  return options.filter(opt => opt.toLowerCase().includes(query.toLowerCase()));
}
