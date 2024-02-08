require("dotenv").config();
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { MongoClient } = require("mongodb");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const port = process.env.PORT || 3000;
const mongoUri = process.env.MONGO_URI;
const dbName = "audio-transcription";

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// Create HTTP server
const server = http.createServer(app);

// Connect to MongoDB
const client = new MongoClient(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function connectToDatabase() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
  }
}

async function saveTranscription(transcription) {
  try {
    const db = client.db(dbName);
    const collection = db.collection("transcriptions");
    await collection.insertOne(transcription);
    console.log("Transcription saved:", transcription);
  } catch (error) {
    console.error("Failed to save transcription:", error);
  }
}

async function getTranscriptions() {
  try {
    const db = client.db(dbName);
    const collection = db.collection("transcriptions");
    //get all transcriptions that are not empty strings
    const transcriptions = await collection
      .find({ transcription: { $ne: "" } })
      .toArray();
    console.log("Transcriptions retrieved:", transcriptions);
    return transcriptions;
  } catch (error) {
    console.error("Failed to get transcriptions:", error);
    return [];
  }
}

let transcriptions = [];
transcriptions = getTranscriptions();
// Routes
app.post("/api/transcription", async (req, res) => {
  const { timestamp, transcription, id, sessionName } = req.body;
  if (!timestamp || !transcription || !id || !sessionName) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (typeof timestamp !== "number" || typeof transcription !== "string") {
    return res
      .status(400)
      .json({ error: "Invalid timestamp or transcription" });
  }
  if (transcription.length === 0) {
    return res.json({ message: "No transcription to save" });
  }
  const newTranscription = {
    timestamp,
    transcription,
    id,
    sessionName,
  };
  transcriptions.push(newTranscription);
  await saveTranscription(newTranscription);

  // Emit the new transcription to all connected clients in the same session
  io.to(sessionName).emit("newTranscription", newTranscription);

  return res.json(newTranscription);
});

// Socket.IO server
const io = new Server(server);

// Socket.IO logic
io.on("connection", async (socket) => {
  console.log("A user connected");

  // Join a room based on the sessionName provided by the client
  const { sessionId } = socket.handshake.query;
  socket.join(sessionId);

  // Send existing transcriptions for the session to the connected client
  const filteredTranscriptions = transcriptions.filter(
    (transcription) => transcription.sessionName === sessionId
  );
  const lastTranscription =
    filteredTranscriptions[filteredTranscriptions.length - 1];
  socket.emit("transcriptions", lastTranscription);

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

// Function to fetch transcriptions by sessionName
async function getTranscriptionsBySession(sessionName) {
  try {
    const db = client.db(dbName);
    const collection = db.collection("transcriptions");
    const transcriptions = await collection.find({ sessionName }).toArray();
    console.log(
      `Transcriptions for session ${sessionName} retrieved:`,
      transcriptions
    );
    return transcriptions;
  } catch (error) {
    console.error(
      `Failed to get transcriptions for session ${sessionName}:`,
      error
    );
    return [];
  }
}

app.get("/api/transcription", async (req, res) => {
  const transcriptions = await getTranscriptions();
  res.json(transcriptions);
});

app.get("/api/transcription/:id", async (req, res) => {
  const { id } = req.params;
  const transcription = await getTranscriptionById(id);
  if (!transcription) {
    return res.status(404).json({ error: "Transcription not found" });
  }
  res.json(transcription);
});

app.get("/api/transcription/session/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  const transcription = await getTranscriptionBySessionId(sessionId);
  if (!transcription) {
    return res.status(404).json({ error: "Transcription not found" });
  }
  res.json(transcription);
});

// Start the server
async function startServer() {
  await connectToDatabase();
  server.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
  });
}

startServer();
