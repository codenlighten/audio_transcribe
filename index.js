require("dotenv").config();
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { MongoClient } = require("mongodb");
const http = require("http");
const { Server } = require("socket.io");
const CryptoJS = require("crypto-js");
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
const encrypt = (text) => {
  return CryptoJS.AES.encrypt(text, process.env.ENCRYPT_KEY).toString();
};
const decrypt = (text) => {
  const bytes = CryptoJS.AES.decrypt(text, process.env.ENCRYPT_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};
const randomId = () => {
  const id = uuidv4();
  console.log("id", id);
  return encrypt(id);
};
// randomId();

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
let currentTranscriptionsLength = 0;

async function getTranscriptions() {
  try {
    const db = client.db(dbName);
    const collection = db.collection("transcriptions");
    // Get all transcriptions that are not empty strings
    let transcriptions = await collection
      .find({ transcription: { $ne: "" } })
      .toArray();
    // If encrypted is true, decrypt the transcription
    const decryptedTranscriptions = [];
    transcriptions.forEach((t) => {
      if (t.encrypted) {
        t.transcription = decrypt(t.transcription);
        t.encrypted = false;
      }
      decryptedTranscriptions.push(t);
    });
    console.log("Transcriptions retrieved:", decryptedTranscriptions);
    return decryptedTranscriptions;
  } catch (error) {
    console.error("Failed to get transcriptions:", error);
    return [];
  }
}

async function getTranscriptionById(id) {
  try {
    const db = client.db(dbName);
    const collection = db.collection("transcriptions");
    const transcription = await collection.findOne({
      id,
    });
    if (transcription.encrypted) {
      transcription.transcription = decrypt(transcription.transcription);
      transcription.encrypted = false;
    }
    console.log("Transcription retrieved:", transcription);
    return transcription;
  } catch (error) {
    console.error("Failed to get transcription:", error);
    return null;
  }
}

let currentTranscriptions = [];
const getCurrentTranscriptions = async () => {
  currentTranscriptions = await getTranscriptions();
  currentTranscriptionsLength = currentTranscriptions.length;
};
getCurrentTranscriptions();
// Routes
const checkLengthsArray = [];
const io = new Server(server);

io.on("connection", (socket) => {
  console.log("A user connected");
  const sessionId = socket.handshake.query.sessionId;
  let liveCheckInterval;
  if (sessionId) {
    socket.join(sessionId);

    const filteredTranscriptions = currentTranscriptions.filter(
      (t) => t.sessionId === sessionId
    );
    //add sessionId and length of transcriptions to checkLengthsArray
    checkLengthsArray.push({
      sessionId,
      length: filteredTranscriptions.length,
    });

    socket.emit("transcriptions", filteredTranscriptions); // Emit filtered transcriptions to the client
  }

  // Handle an event to fetch live transcription
  socket.on("requestLiveTranscription", () => {
    liveCheckInterval = setInterval(() => {
      if (currentTranscriptions.length > currentTranscriptionsLength) {
        const newTranscriptions = currentTranscriptions.slice(
          currentTranscriptionsLength
        );
        currentTranscriptionsLength = currentTranscriptions.length;
        socket.emit("liveTranscriptionUpdate", newTranscriptions);
      }
    }, 1000);
  });
  socket.on("disconnect", () => {
    console.log("User disconnected");
    // if all clients with the same sessionId are disconnected, clear the interval
    if (sessionId) {
      const index = checkLengthsArray.findIndex(
        (c) => c.sessionId === sessionId
      );
      checkLengthsArray.splice(index, 1);
    }
    if (checkLengthsArray.every((c) => c.length === 0)) {
      clearInterval(liveCheckInterval);
    }
  });
});
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
  const encryptedTranscription = encrypt(transcription);
  const newTranscription = {
    timestamp,
    transcription: encryptedTranscription,
    id,
    sessionName,
    encrypted: true,
  };
  currentTranscriptions.push({
    timestamp,
    transcription,
    id,
    sessionName,
    encrypted: false,
  });
  await saveTranscription(newTranscription);

  // Emit the update to all clients in the session
  io.to(sessionName).emit("transcriptionUpdate", newTranscription);

  return res.json(newTranscription);
});

app.get("/api/transcription/session/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  const transcriptions = await getTranscriptionsBySession(sessionId);
  res.json(transcriptions);
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
