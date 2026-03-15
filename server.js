const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
    origin: (origin, callback) => {
        // Allow all origins for now to fix deployment issues, 
        // or you can specifically check for your frontend URL
        callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));
app.use(bodyParser.json());
app.use(express.json());

// ─── MongoDB Connection & Cache ────────────────────────────────────────────────────────
let isConnected = false;

const connectDB = async () => {
    if (isConnected) return;
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 15000,
            socketTimeoutMS: 45000,
        });
        isConnected = true;
        console.log('✅ Connected to MongoDB Atlas.');
        // Seed asynchronously – don't block the server startup or request
        seedMenu().catch(err => console.error('Seed Error:', err));
    } catch (err) {
        console.error('❌ MongoDB Connection Error:', err.message);
        // On Vercel, we want to know if the URI is missing
        if (!process.env.MONGODB_URI) {
            console.error('CRITICAL: MONGODB_URI is not defined in environment variables!');
        }
    }
};

connectDB();

// ─── Schemas & Models ──────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    fullname: String,
    email: String,
    mobile: String,
    address: String,
    location: { lat: Number, lng: Number }
});
userSchema.set('toJSON', { virtuals: true });
const User = mongoose.model('User', userSchema);

const menuSchema = new mongoose.Schema({
    name: String,
    description: String,
    price: Number,
    image: String
});
menuSchema.set('toJSON', { virtuals: true });
const Menu = mongoose.model('Menu', menuSchema);

const orderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    items: String,
    total: Number,
    status: { type: String, default: 'Pending' }
});
orderSchema.set('toJSON', { virtuals: true });
const Order = mongoose.model('Order', orderSchema);

// ─── Seed Menu ─────────────────────────────────────────────────────────────────
async function seedMenu() {
    try {
        const count = await Menu.countDocuments();
        if (count < 5) { // Only seed if truly empty/low
            const items = [
                { name: 'Classic Gourmet Burger',    description: 'Juicy beef patty with fresh lettuce, tomato, cheese and signature sauce.',      price: 149, image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80' },
                { name: 'Artisan Pepperoni Pizza',   description: 'Wood-fired crust, rich tomato sauce, premium pepperoni, and melted mozzarella.', price: 199, image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=80' },
                { name: 'Golden Crispy Fries',       description: 'Perfectly salted french fries with a side of truffle mayo.',                     price:  79, image: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=600&q=80' },
                { name: 'Spicy Chicken Wings',       description: 'Buffalo-style chicken wings served with creamy blue cheese dip.',                price: 169, image: 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format&fit=crop&w=600&q=80' },
                { name: 'Grilled Salmon Bowl',       description: 'Fresh caught salmon over quinoa with roasted vegetables.',                        price: 229, image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=600&q=80' },
                { name: 'Vegan Buddha Bowl',         description: 'Roasted sweet potato, chickpeas, kale, and tahini dressing.',                    price: 179, image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=80' },
                { name: 'Truffle Mac & Cheese',      description: 'Creamy artisan cheeses baked with a crispy truffle crumb topping.',              price: 159, image: 'https://images.unsplash.com/photo-1543352634-99a5d50ae78e?auto=format&fit=crop&w=600&q=80' },
                { name: 'Sushi Boat Assortment',     description: "Chef's selection of premium nigiri, sashimi, and maki rolls.",                  price: 249, image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=600&q=80' },
                { name: 'Mexican Street Tacos',      description: 'Three authentic al pastor tacos with cilantro and lime.',                        price: 129, image: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=600&q=80' },
                { name: 'Chocolate Lava Cake',       description: 'Warm dark chocolate cake with a molten center and vanilla bean ice cream.',      price:  99, image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80' }
            ];
            await Menu.deleteMany({});
            await Menu.insertMany(items);
            console.log('✅ Menu seeded.');
        }
    } catch (err) {
        console.error('❌ Seed failed:', err.message);
    }
}

// ─── Routes ────────────────────────────────────────────────────────────────────

// Health check
app.get('/', (req, res) => res.json({ status: 'EatsBite API is running 🍽️' }));

// User Registration
app.post('/api/register', async (req, res) => {
    const { username, password, fullname, email, mobile, address, location } = req.body;
    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) return res.status(400).json({ error: 'Username already exists.' });
        const newUser = new User({ username, password, fullname, email, mobile, address, location });
        await newUser.save();
        res.json({ message: 'User registered successfully.' });
    } catch (err) {
        res.status(400).json({ error: 'Invalid operation.' });
    }
});

// User Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username, password });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        res.json({ id: user.id, username: user.username, fullname: user.fullname, email: user.email, mobile: user.mobile, address: user.address, location: user.location });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update User Profile
app.put('/api/users/:id', async (req, res) => {
    try {
        const { fullname, email, mobile, address } = req.body;
        const updatedUser = await User.findByIdAndUpdate(req.params.id, { fullname, email, mobile, address }, { new: true });
        if (!updatedUser) return res.status(404).json({ error: 'User not found' });
        res.json({ message: 'Profile updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete User
app.delete('/api/users/:id', async (req, res) => {
    try {
        const deletedUser = await User.findByIdAndDelete(req.params.id);
        if (!deletedUser) return res.status(404).json({ error: 'User not found' });
        res.json({ message: 'Account deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Menu Items
app.get('/api/menu', async (req, res) => {
    try {
        const menuItems = await Menu.find({});
        res.json(menuItems);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Place Order
app.post('/api/orders', async (req, res) => {
    try {
        const { userId, items, total } = req.body;
        const newOrder = new Order({ userId, items, total, status: 'Pending' });
        await newOrder.save();
        res.json({ message: 'Order placed successfully!', orderId: newOrder.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get User Orders
app.get('/api/orders/:userId', async (req, res) => {
    try {
        const orders = await Order.find({ userId: req.params.userId }).sort({ _id: -1 });
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a Single Order
app.delete('/api/orders/:id', async (req, res) => {
    try {
        const deleted = await Order.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Order not found' });
        res.json({ message: 'Order deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

module.exports = app; // needed for Vercel serverless
