# @ui/charts

BarChart, LineChart, PieChart components (stubs ready for D3/Chart.js integration).
Includes natural language chart generation (description -> chart data).

## Installation
```ts
import { BarChart, generateChartData } from '@ui/charts';
```

## Usage
```tsx
const data = await generateChartData('sales over the last 4 months');
<BarChart data={data} />
```
