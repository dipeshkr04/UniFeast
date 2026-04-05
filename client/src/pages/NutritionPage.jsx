import { useState, useEffect } from 'react';
import { nutritionAPI } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { HiOutlineFire, HiOutlineChevronLeft, HiOutlineChevronRight, HiPlus } from 'react-icons/hi';
import toast from 'react-hot-toast';

const COLORS = ['#e06449', '#facc15', '#3b82f6', '#10b981'];

export default function NutritionPage() {
  const { user } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [daily, setDaily] = useState(null);
  const [weekly, setWeekly] = useState([]);
  const [showLogForm, setShowLogForm] = useState(false);
  const [logForm, setLogForm] = useState({ customName: '', calories: '', protein: '', carbs: '', fat: '', mealType: 'snack' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [date]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dailyRes, weeklyRes] = await Promise.all([
        nutritionAPI.getDaily(date),
        nutritionAPI.getWeekly(),
      ]);
      setDaily(dailyRes.data.data);
      setWeekly(weeklyRes.data.data);
    } catch (err) {
      toast.error('Failed to load nutrition data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogMeal = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      Object.entries(logForm).forEach(([key, val]) => formData.append(key, val));
      await nutritionAPI.logMeal(formData);
      toast.success('Meal logged!', { icon: '🥗' });
      setShowLogForm(false);
      setLogForm({ customName: '', calories: '', protein: '', carbs: '', fat: '', mealType: 'snack' });
      fetchData();
    } catch (err) {
      toast.error('Failed to log meal');
    }
  };

  const changeDate = (delta) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().split('T')[0]);
  };

  const totals = daily?.dailyTotals || { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const goals = {
    calories: user?.dailyCalorieGoal || 2000,
    protein: user?.dailyProteinGoal || 50,
    carbs: user?.dailyCarbGoal || 250,
    fat: user?.dailyFatGoal || 65,
  };

  const macroData = [
    { name: 'Protein', value: totals.protein, goal: goals.protein, unit: 'g', color: COLORS[0] },
    { name: 'Carbs', value: totals.carbs, goal: goals.carbs, unit: 'g', color: COLORS[1] },
    { name: 'Fat', value: totals.fat, goal: goals.fat, unit: 'g', color: COLORS[2] },
  ];

  const pieData = macroData.filter(m => m.value > 0);

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            <span className="text-primary-400">Nutrition</span> Tracker
          </h1>
          <p className="text-surface-400 mt-1">Track your daily intake</p>
        </div>
        <button onClick={() => setShowLogForm(!showLogForm)} className="btn-primary flex items-center gap-2 text-sm" id="log-meal-btn">
          <HiPlus className="w-4 h-4" /> Log Meal
        </button>
      </div>

      {/* Date Picker */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <button onClick={() => changeDate(-1)} className="p-2 rounded-lg hover:bg-white/5">
          <HiOutlineChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="font-semibold">{new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <p className="text-xs text-surface-500">{date === new Date().toISOString().split('T')[0] ? 'Today' : ''}</p>
        </div>
        <button onClick={() => changeDate(1)} className="p-2 rounded-lg hover:bg-white/5">
          <HiOutlineChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Manual Meal Log Form */}
      {showLogForm && (
        <div className="glass-card-static p-5 mb-6 animate-slideUp">
          <h3 className="font-semibold mb-4">Log Outside Meal</h3>
          <form onSubmit={handleLogMeal} className="space-y-3">
            <input value={logForm.customName} onChange={e => setLogForm({ ...logForm, customName: e.target.value })} className="input-field" placeholder="Meal name" required id="log-meal-name" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <input type="number" value={logForm.calories} onChange={e => setLogForm({ ...logForm, calories: e.target.value })} className="input-field" placeholder="Calories" id="log-calories" />
              <input type="number" value={logForm.protein} onChange={e => setLogForm({ ...logForm, protein: e.target.value })} className="input-field" placeholder="Protein (g)" id="log-protein" />
              <input type="number" value={logForm.carbs} onChange={e => setLogForm({ ...logForm, carbs: e.target.value })} className="input-field" placeholder="Carbs (g)" id="log-carbs" />
              <input type="number" value={logForm.fat} onChange={e => setLogForm({ ...logForm, fat: e.target.value })} className="input-field" placeholder="Fat (g)" id="log-fat" />
            </div>
            <select value={logForm.mealType} onChange={e => setLogForm({ ...logForm, mealType: e.target.value })} className="input-field" id="log-meal-type">
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="snack">Snack</option>
              <option value="dinner">Dinner</option>
            </select>
            <button type="submit" className="btn-success" id="submit-meal-log">Log Meal</button>
          </form>
        </div>
      )}

      {/* Calorie Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Calorie Ring */}
        <div className="glass-card-static p-5 flex flex-col items-center">
          <HiOutlineFire className="w-6 h-6 text-orange-400 mb-2" />
          <div className="relative w-36 h-36">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={[{ value: Math.min(totals.calories, goals.calories) }, { value: Math.max(0, goals.calories - totals.calories) }]}
                  cx="50%" cy="50%" innerRadius={50} outerRadius={65} startAngle={90} endAngle={-270} dataKey="value">
                  <Cell fill="#e06449" />
                  <Cell fill="rgba(148,163,184,0.1)" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-2xl font-bold">{totals.calories}</p>
              <p className="text-[10px] text-surface-500">/ {goals.calories} cal</p>
            </div>
          </div>
          <p className="text-sm text-surface-400 mt-2">Calories</p>
        </div>

        {/* Macro Breakdown */}
        <div className="glass-card-static p-5">
          <h3 className="text-sm font-semibold text-surface-400 mb-4 uppercase tracking-wider">Macros</h3>
          <div className="space-y-4">
            {macroData.map(m => (
              <div key={m.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-surface-300">{m.name}</span>
                  <span className="font-semibold">{m.value}{m.unit} / {m.goal}{m.unit}</span>
                </div>
                <div className="w-full h-2 bg-surface-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (m.value / m.goal) * 100)}%`, background: m.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Macro Pie */}
        <div className="glass-card-static p-5 flex flex-col items-center">
          <h3 className="text-sm font-semibold text-surface-400 mb-3 uppercase tracking-wider">Distribution</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={55} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-surface-500 text-sm mt-10">No data yet</p>
          )}
        </div>
      </div>

      {/* Weekly Trend */}
      <div className="glass-card-static p-5 mb-6">
        <h3 className="text-sm font-semibold text-surface-400 mb-4 uppercase tracking-wider">Weekly Calorie Trend</h3>
        {weekly.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weekly}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={d => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' })} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 12, color: '#f1f5f9' }} />
              <Bar dataKey="calories" fill="#e06449" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-surface-500 text-center py-8">No weekly data</p>
        )}
      </div>

      {/* Today's Meals */}
      <div className="glass-card-static p-5">
        <h3 className="text-sm font-semibold text-surface-400 mb-4 uppercase tracking-wider">Meals Logged</h3>
        {daily?.meals?.length > 0 ? (
          <div className="space-y-2">
            {daily.meals.map((meal, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-surface-900/50">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-surface-800 flex items-center justify-center text-sm">
                    {meal.mealType === 'breakfast' ? '🌅' : meal.mealType === 'lunch' ? '☀️' : meal.mealType === 'dinner' ? '🌙' : '🍿'}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-surface-200">{meal.customName || meal.menuItem?.name}</p>
                    <p className="text-[10px] text-surface-500 capitalize">{meal.mealType} {meal.isAutoLogged ? '• Auto-logged' : ''}</p>
                  </div>
                </div>
                <div className="text-right text-xs text-surface-400">
                  <p>{meal.calories * (meal.quantity || 1)} cal</p>
                  <p>P:{meal.protein}g C:{meal.carbs}g F:{meal.fat}g</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-surface-500 text-center py-4">No meals logged for this day</p>
        )}
      </div>
    </div>
  );
}

