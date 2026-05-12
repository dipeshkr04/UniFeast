import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export default function NutritionDonut({ calories = 0 }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={[{ value: calories }]}
          cx="50%"
          cy="50%"
          innerRadius={45}
          outerRadius={60}
          startAngle={90}
          endAngle={-270}
          dataKey="value"
          stroke="none"
        >
          <Cell fill="url(#modalColorPie)" />
        </Pie>
        <defs>
          <linearGradient id="modalColorPie" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#e06449" stopOpacity={1} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={1} />
          </linearGradient>
        </defs>
      </PieChart>
    </ResponsiveContainer>
  );
}
