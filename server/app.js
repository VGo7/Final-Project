const express = require("express");
const path = require("path");
const app = express();
const PORT = 3000;
const { users, bloodRequests } = require('./db');

// Middleware
app.use(express.static(path.join(__dirname, "../public")));
app.use(express.json());

// Session handling (in memory - use proper session store in production)
const sessions = new Map();

// Mock data (replace with database in production)
let mockStats = {
  donors: {
    total: 1250,
    active: 850,
    new: 75,
    growth: 15
  },
  donations: {
    total: 3750,
    thisMonth: 320,
    growth: 23,
    byType: {
      'A+': 1125,
      'A-': 375,
      'B+': 750,
      'B-': 188,
      'AB+': 375,
      'AB-': 187,
      'O+': 562,
      'O-': 188
    }
  },
  livesSaved: {
    total: 11250,
    thisMonth: 960,
    growth: 28,
    impactScore: 95
  },
  bloodAvailability: {
    'A+': { level: 'high', percentage: 85 },
    'A-': { level: 'medium', percentage: 60 },
    'B+': { level: 'high', percentage: 80 },
    'B-': { level: 'medium', percentage: 55 },
    'AB+': { level: 'high', percentage: 90 },
    'AB-': { level: 'medium', percentage: 65 },
    'O+': { level: 'medium', percentage: 50 },
    'O-': { level: 'low', percentage: 30 }
  }
};

// Authentication middleware
const authenticateUser = (req, res, next) => {
  const sessionId = req.headers.authorization;
  if (sessionId && sessions.has(sessionId)) {
    req.user = sessions.get(sessionId);
    next();
  } else {
    res.status(401).json({ message: "Unauthorized" });
  }
};

// Routes
app.get("/api/stats", (req, res) => {
  res.json(mockStats);
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email && u.password === password);
  
  if (user) {
    const sessionId = Math.random().toString(36).substring(2);
    sessions.set(sessionId, user);
    res.json({
      user: { ...user, password: undefined },
      sessionId
    });
  } else {
    res.status(401).json({ message: "Invalid credentials" });
  }
});

app.post("/api/signup", (req, res) => {
  const { name, email, password, bloodType, isDonor } = req.body;
  
  if (users.some(u => u.email === email)) {
    return res.status(400).json({ message: "Email already exists" });
  }

  const newUser = {
    id: users.length + 1,
    name,
    email,
    password,
    bloodType,
    isDonor,
    donationHistory: []
  };

  users.push(newUser);
  const sessionId = Math.random().toString(36).substring(2);
  sessions.set(sessionId, newUser);

  res.status(201).json({
    user: { ...newUser, password: undefined },
    sessionId
  });
});

app.post("/api/logout", (req, res) => {
  const sessionId = req.headers.authorization;
  if (sessionId) {
    sessions.delete(sessionId);
  }
  res.json({ message: "Logged out successfully" });
});

app.get("/api/requests", authenticateUser, (req, res) => {
  res.json(bloodRequests);
});

app.post("/api/register-donor", authenticateUser, (req, res) => {
  const user = req.user;
  user.isDonor = true;
  res.json({ message: "Successfully registered as donor" });
});

app.post("/api/request-blood", authenticateUser, (req, res) => {
  const { bloodType, units, hospital, urgency } = req.body;
  const newRequest = {
    id: bloodRequests.length + 1,
    patientName: req.user.name,
    bloodType,
    units,
    hospital,
    urgency,
    status: "Active",
    date: new Date().toISOString().split('T')[0]
  };
  
  bloodRequests.push(newRequest);
  res.status(201).json(newRequest);
});

// Handle 404s
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
