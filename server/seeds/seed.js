const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const User = require('../models/User');
const MenuItem = require('../models/MenuItem');

const users = [
  {
    name: 'Student User',
    email: 'student@iiit.ac.in',
    password: 'password123',
    role: 'student',
    phone: '9876543210',
  },
  {
    name: 'Kitchen Staff',
    email: 'kitchen@iiit.ac.in',
    password: 'password123',
    role: 'kitchen',
    phone: '9876543211',
  },
  {
    name: 'Admin User',
    email: 'admin@iiit.ac.in',
    password: 'password123',
    role: 'admin',
    phone: '9876543212',
  },
  {
    name: 'Rahul Sharma',
    email: 'rahul@iiit.ac.in',
    password: 'password123',
    role: 'student',
    phone: '9876543213',
  },
  {
    name: 'Priya Patel',
    email: 'priya@iiit.ac.in',
    password: 'password123',
    role: 'student',
    phone: '9876543214',
  },
];

const menuItems = [
  {
    name: 'Poha',
    description: 'Flattened rice tempered with mustard seeds, turmeric, onions, peanuts and curry leaves. A classic Maharashtrian breakfast.',
    price: 30,
    category: 'snacks',
    prepTime: 8,
    isAvailable: true,
    isPoolable: true,
    nutrition: { calories: 250, protein: 6, carbs: 45, fat: 5, fiber: 2 },
    tags: ['breakfast', 'veg', 'light', 'maharashtrian'],
    imageUrl: '',
  },
  {
    name: 'Samosa (2pc)',
    description: 'Crispy deep-fried pastry filled with spiced potato and peas stuffing. Served with mint and tamarind chutney.',
    price: 20,
    category: 'snacks',
    prepTime: 5,
    isAvailable: true,
    isPoolable: true,
    nutrition: { calories: 308, protein: 5, carbs: 32, fat: 18, fiber: 3 },
    tags: ['snack', 'veg', 'fried', 'popular'],
    imageUrl: '',
  },
  {
    name: 'Idli (3pc)',
    description: 'Steamed rice and lentil cakes, soft and fluffy. Served with coconut chutney and sambar.',
    price: 25,
    category: 'snacks',
    prepTime: 10,
    isAvailable: true,
    isPoolable: true,
    nutrition: { calories: 195, protein: 5, carbs: 39, fat: 1, fiber: 2 },
    tags: ['breakfast', 'veg', 'south-indian', 'healthy', 'steamed'],
    imageUrl: '',
  },
  {
    name: 'Masala Dosa',
    description: 'Crispy rice and lentil crepe filled with spiced potato masala. Served with coconut chutney and sambar.',
    price: 50,
    category: 'meals',
    prepTime: 12,
    isAvailable: true,
    isPoolable: true,
    nutrition: { calories: 366, protein: 7, carbs: 48, fat: 16, fiber: 3 },
    tags: ['south-indian', 'veg', 'popular', 'crispy'],
    imageUrl: '',
  },
  {
    name: 'Chole Bhature',
    description: 'Spiced chickpea curry served with deep-fried fluffy bread. A North Indian favorite.',
    price: 60,
    category: 'meals',
    prepTime: 15,
    isAvailable: true,
    isPoolable: true,
    nutrition: { calories: 450, protein: 13, carbs: 55, fat: 20, fiber: 8 },
    tags: ['north-indian', 'veg', 'heavy', 'popular'],
    imageUrl: '',
  },
  {
    name: 'Veg Thali',
    description: 'Complete meal with dal, sabzi, rice, roti, salad, papad and dessert. A balanced wholesome platter.',
    price: 80,
    category: 'meals',
    prepTime: 20,
    isAvailable: true,
    isPoolable: false,
    nutrition: { calories: 650, protein: 18, carbs: 85, fat: 22, fiber: 12 },
    tags: ['thali', 'veg', 'complete-meal', 'value'],
    imageUrl: '',
  },
  {
    name: 'Paneer Tikka',
    description: 'Marinated cottage cheese cubes grilled in tandoor with bell peppers and onions. Smoky and flavorful.',
    price: 70,
    category: 'meals',
    prepTime: 15,
    isAvailable: true,
    isPoolable: true,
    nutrition: { calories: 320, protein: 22, carbs: 10, fat: 22, fiber: 2 },
    tags: ['tandoor', 'veg', 'protein', 'popular'],
    imageUrl: '',
  },
  {
    name: 'Chai',
    description: 'Hot Indian spiced tea made with fresh ginger, cardamom and milk. The classic campus drink.',
    price: 10,
    category: 'beverages',
    prepTime: 3,
    isAvailable: true,
    isPoolable: true,
    nutrition: { calories: 80, protein: 3, carbs: 10, fat: 3, fiber: 0 },
    tags: ['hot', 'beverage', 'popular', 'quick'],
    imageUrl: '',
  },
  {
    name: 'Cold Coffee',
    description: 'Chilled blended coffee with milk, ice cream and a drizzle of chocolate syrup.',
    price: 40,
    category: 'beverages',
    prepTime: 5,
    isAvailable: true,
    isPoolable: true,
    nutrition: { calories: 180, protein: 5, carbs: 28, fat: 6, fiber: 0 },
    tags: ['cold', 'beverage', 'sweet', 'popular'],
    imageUrl: '',
  },
  {
    name: 'Gulab Jamun (2pc)',
    description: 'Deep-fried milk dumplings soaked in rose-scented sugar syrup. Warm and melt-in-mouth.',
    price: 30,
    category: 'desserts',
    prepTime: 5,
    isAvailable: true,
    isPoolable: true,
    nutrition: { calories: 280, protein: 4, carbs: 45, fat: 10, fiber: 0 },
    tags: ['dessert', 'sweet', 'traditional'],
    imageUrl: '',
  },
  {
    name: 'Veg Biryani',
    description: 'Fragrant basmati rice layered with mixed vegetables, herbs and aromatic spices. Served with raita.',
    price: 70,
    category: 'meals',
    prepTime: 18,
    isAvailable: true,
    isPoolable: true,
    nutrition: { calories: 400, protein: 10, carbs: 65, fat: 12, fiber: 5 },
    tags: ['rice', 'veg', 'aromatic', 'popular'],
    imageUrl: '',
  },
  {
    name: 'Aloo Paratha',
    description: 'Stuffed wheat flatbread with spiced potato filling. Served with butter, curd and pickle.',
    price: 35,
    category: 'snacks',
    prepTime: 10,
    isAvailable: true,
    isPoolable: true,
    nutrition: { calories: 300, protein: 7, carbs: 40, fat: 13, fiber: 3 },
    tags: ['breakfast', 'veg', 'north-indian', 'stuffed'],
    imageUrl: '',
  },
  {
    name: 'Maggi Noodles',
    description: 'Instant noodles tossed with vegetables and special masala. The ultimate college comfort food.',
    price: 25,
    category: 'snacks',
    prepTime: 7,
    isAvailable: true,
    isPoolable: true,
    nutrition: { calories: 205, protein: 4, carbs: 28, fat: 9, fiber: 1 },
    tags: ['quick', 'comfort', 'popular', 'late-night'],
    imageUrl: '',
  },
  {
    name: 'Pav Bhaji',
    description: 'Mixed vegetable mashed curry served with buttered toasted bread rolls. Mumbai street food classic.',
    price: 45,
    category: 'meals',
    prepTime: 12,
    isAvailable: true,
    isPoolable: true,
    nutrition: { calories: 380, protein: 10, carbs: 52, fat: 15, fiber: 6 },
    tags: ['street-food', 'veg', 'mumbai', 'popular'],
    imageUrl: '',
  },
  {
    name: 'Fresh Lime Soda',
    description: 'Refreshing lemon drink with soda, available sweet or salted. Perfect campus cooler.',
    price: 20,
    category: 'beverages',
    prepTime: 3,
    isAvailable: true,
    isPoolable: true,
    nutrition: { calories: 45, protein: 0, carbs: 12, fat: 0, fiber: 0 },
    tags: ['cold', 'refreshing', 'quick', 'healthy'],
    imageUrl: '',
  },
  {
    name: 'Jalebi (5pc)',
    description: 'Crispy deep-fried spirals soaked in saffron sugar syrup. Bright orange and irresistibly sweet.',
    price: 25,
    category: 'desserts',
    prepTime: 8,
    isAvailable: true,
    isPoolable: true,
    nutrition: { calories: 350, protein: 3, carbs: 60, fat: 12, fiber: 0 },
    tags: ['dessert', 'sweet', 'fried', 'traditional'],
    imageUrl: '',
  },
];

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await MenuItem.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // Seed users
    const createdUsers = await User.create(users);
    console.log(`👥 Created ${createdUsers.length} users`);

    // Seed menu items
    const createdItems = await MenuItem.create(menuItems);
    console.log(`🍽️  Created ${createdItems.length} menu items`);

    console.log('\n═══════════════════════════════════════');
    console.log('   ✅ Database seeded successfully!');
    console.log('═══════════════════════════════════════');
    console.log('\n📧 Demo Accounts:');
    console.log('   Student: student@iiit.ac.in / password123');
    console.log('   Kitchen: kitchen@iiit.ac.in / password123');
    console.log('   Admin:   admin@iiit.ac.in / password123');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
};

seedDB();
