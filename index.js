require("dotenv").config();
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { MongoClient } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;
const mongoUri = process.env.MONGO_URI;
const dbName = "audio-transcription";

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

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

// Routes
app.post("/api/transcription", async (req, res) => {
  const { timestamp, transcription } = req.body;
  if (!timestamp || !transcription) {
    return res
      .status(400)
      .json({ error: "Missing timestamp or transcription" });
  }
  if (typeof timestamp !== "number" || typeof transcription !== "string") {
    return res
      .status(400)
      .json({ error: "Invalid timestamp or transcription" });
  }
  if (transcription.length === 0) {
    return res.json(newTranscription);
  }
  const newTranscription = {
    timestamp,
    transcription,
    id: uuidv4(),
  };
  await saveTranscription(newTranscription);
  return res.json(newTranscription);
});

app.get("/api/transcription", async (req, res) => {
  const transcriptions = await getTranscriptions();
  res.json(transcriptions);
});

// Start the server
async function startServer() {
  await connectToDatabase();
  app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
  });
}

startServer();
