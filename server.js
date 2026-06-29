const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
require("dotenv").config();
require("./config/db");

const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const testRoutes = require("./routes/testsPublic");
const coachRoutes = require("./routes/coaches");
const chatRoutes = require("./routes/chat");
const profileRoutes = require("./routes/profile");
const libraryRoutes = require("./routes/library");
const bookingRoutes = require("./routes/bookings");
const plansRoutes = require("./routes/plans");
const subscriptionsRoutes = require("./routes/subscriptions");
const chatbotRoutes = require("./routes/chatbot");
const Conversation = require("./models/Conversation");
const Coach = require("./models/Coach");
const seedTests = require("./seeders/seedTests");
const seed = require("./scripts/seed");

const app = express();
const httpServer = createServer(app);

// ─── Static files ─────────────────────────────────────────────────────────────
app.use("/uploads", express.static(require("path").join(__dirname, "uploads")));
app.use("/avatar-icons", express.static(require("path").join(__dirname, "avatar-icons")));
app.use("/payment-icons", express.static(require("path").join(__dirname, "payment-icons")));

// ─── CORS origins ─────────────────────────────────────────────────────────────
// In production set CORS_ORIGIN to a comma-separated list of allowed origins.
// In development every localhost / 127.0.0.1 port is allowed automatically.
const explicitOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : [];
const isLocalhostOrigin = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
const isProduction = process.env.NODE_ENV === "production";

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // non-browser (Postman, etc.)
    if (explicitOrigins.length && explicitOrigins.includes(origin)) return callback(null, true);
    // In development, allow any localhost / 127.0.0.1 origin.
    if (!isProduction && isLocalhostOrigin(origin)) {
      return callback(null, true);
    }
    callback(null, false); // blocked — return false, not an Error, to avoid 500s
  },
  credentials: true
};

// ─── Socket.IO ────────────────────────────────────────────────────────────────
const io = new Server(httpServer, { cors: corsOptions });

const onlineSocketsByUser = new Map();
const socketUserMeta = new Map();

function addOnlineUser(userId, socketId) {
  if (!onlineSocketsByUser.has(userId)) {
    onlineSocketsByUser.set(userId, new Set());
  }
  onlineSocketsByUser.get(userId).add(socketId);
}

function removeOnlineUser(userId, socketId) {
  const set = onlineSocketsByUser.get(userId);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) onlineSocketsByUser.delete(userId);
}

function isUserOnline(userId) {
  const set = onlineSocketsByUser.get(String(userId));
  return !!set && set.size > 0;
}

async function resolveCoachByUser(decodedUser) {
  if (!decodedUser || decodedUser.role !== "coach") return null;
  let coach = await Coach.findOne({ userId: decodedUser.id }).select("_id userId name");
  if (!coach && decodedUser.name) {
    coach = await Coach.findOne({ name: decodedUser.name }).sort({ createdAt: -1 }).select("_id userId name");
    if (coach && !coach.userId) {
      coach.userId = decodedUser.id;
      await coach.save();
    }
  }
  return coach;
}

async function canAccessConversation(conversation, user, coach) {
  if (!conversation || !user) return false;
  if (user.role === "admin") return true;
  if (String(conversation.userId) === String(user.id)) return true;
  if (user.role === "coach" && coach) {
    return String(conversation.coachId) === String(coach._id);
  }
  return false;
}

async function emitPresenceSnapshot(conversationId) {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) return;
  const conversation = await Conversation.findById(conversationId)
    .populate("coachId", "userId")
    .select("userId coachId");
  if (!conversation) return;

  const userRef = conversation.userId;
  const coachUserRef = conversation.coachId && conversation.coachId.userId ? conversation.coachId.userId : null;
  const users = [{ userId: String(userRef), isOnline: isUserOnline(String(userRef)) }];
  if (coachUserRef) {
    users.push({ userId: String(coachUserRef), isOnline: isUserOnline(String(coachUserRef)) });
  }

  io.to(String(conversationId)).emit("presence_snapshot", {
    conversationId: String(conversationId),
    users
  });
}

io.use(async (socket, next) => {
  try {
    const token = socket.handshake?.auth?.token;
    if (!token) return next(new Error("Unauthorized"));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = {
      id: String(decoded.id || decoded._id || decoded.sub),
      role: decoded.role,
      name: decoded.name || ""
    };
    if (!user.id) return next(new Error("Unauthorized"));
    const coach = await resolveCoachByUser(user);
    socket.data.user = user;
    socket.data.coach = coach;
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

// Make io accessible inside route handlers via req.app.get("io")
app.set("io", io);

io.on("connection", (socket) => {
  const user = socket.data.user;
  addOnlineUser(user.id, socket.id);
  socketUserMeta.set(socket.id, { userId: user.id });

  // Client joins a conversation room to receive real-time messages
  socket.on("join_conversation", async (conversationId) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(conversationId)) return;
      const conversation = await Conversation.findById(conversationId).select("userId coachId");
      if (!conversation) return;

      const allowed = await canAccessConversation(conversation, socket.data.user, socket.data.coach);
      if (!allowed) return;

      socket.join(String(conversationId));
      await emitPresenceSnapshot(String(conversationId));
    } catch {
      // Ignore socket room failures silently
    }
  });

  socket.on("leave_conversation", (conversationId) => {
    socket.leave(String(conversationId));
  });

  socket.on("typing_start", async (payload) => {
    try {
      const conversationId = payload && payload.conversationId;
      if (!mongoose.Types.ObjectId.isValid(conversationId)) return;
      const conversation = await Conversation.findById(conversationId).select("userId coachId");
      if (!conversation) return;
      const allowed = await canAccessConversation(conversation, socket.data.user, socket.data.coach);
      if (!allowed) return;
      socket.to(String(conversationId)).emit("typing", {
        conversationId: String(conversationId),
        userId: String(socket.data.user.id),
        isTyping: true
      });
    } catch {
      // Ignore typing failures silently
    }
  });

  socket.on("typing_stop", async (payload) => {
    try {
      const conversationId = payload && payload.conversationId;
      if (!mongoose.Types.ObjectId.isValid(conversationId)) return;
      const conversation = await Conversation.findById(conversationId).select("userId coachId");
      if (!conversation) return;
      const allowed = await canAccessConversation(conversation, socket.data.user, socket.data.coach);
      if (!allowed) return;
      socket.to(String(conversationId)).emit("typing", {
        conversationId: String(conversationId),
        userId: String(socket.data.user.id),
        isTyping: false
      });
    } catch {
      // Ignore typing failures silently
    }
  });

  socket.on("disconnecting", async () => {
    const rooms = Array.from(socket.rooms || []).filter((room) => room !== socket.id);
    removeOnlineUser(user.id, socket.id);
    socketUserMeta.delete(socket.id);
    for (const room of rooms) {
      await emitPresenceSnapshot(room);
    }
  });
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors(corsOptions));
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/api/tests", testRoutes);
app.use("/api/coaches", coachRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/library", libraryRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/plans", plansRoutes);
app.use("/api/subscriptions", subscriptionsRoutes);
app.use("/api/chatbot", chatbotRoutes);

// ─── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  const message = process.env.NODE_ENV === "production" ? "Internal server error" : err.message;
  res.status(status).json({ message });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// ─── Auto-seed psychiatric / general tests once DB is ready ──────────────────
// config/db.js fires mongoose.connect() synchronously on require(), so we
// hook into the connection event rather than awaiting a returned promise.
mongoose.connection.once("open", () => {
  seedTests();
  seed(true).catch((err) => {
    console.error("Auto-seeding admin/coaches failed:", err.message);
  });
});
