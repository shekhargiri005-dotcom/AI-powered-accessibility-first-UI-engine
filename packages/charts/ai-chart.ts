export async function generateChartData(description: string): Promise<any[]> {
  console.log(`Generating chart data for: ${description}`);
  // Mock AI natural language to chart data
  return [
    { label: 'Jan', value: 30 },
    { label: 'Feb', value: 50 },
    { label: 'Mar', value: 80 },
    { label: 'Apr', value: 40 },
  ];
}
