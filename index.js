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

const getTranscriptionById = async (id) => {
  try {
    const db = client.db(dbName);
    const collection = db.collection("transcriptions");
    const transcription = await collection.findOne({
      id,
    });
    console.log("Transcription retrieved:", transcription);
    return transcription;
  } catch (error) {
    console.error("Failed to get transcription:", error);
    return null;
  }
};

const getTranscriptionBySessionId = async (sessionId) => {
  try {
    const db = client.db(dbName);
    const collection = db.collection("transcriptions");
    const transcription = await collection.findOne({
      sessionId,
    });
    console.log("Transcription retrieved:", transcription);
    return transcription;
  } catch (error) {
    console.error("Failed to get transcription:", error);
    return null;
  }
};

// <!DOCTYPE html>
// <html lang="en">
//   <head>
//     <meta charset="UTF-8" />
//     <meta name="viewport" content="width=device-width, initial-scale=1.0" />
//     <title>Document</title>
//     <style>
//       body {
//         font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
//         text-align: center;
//       }
//       h1 {
//         color: #333;
//       }
//       .transcription {
//         margin: 20px auto;
//         padding: 20px;
//         font-size: 16px;
//         border: 1px solid #ccc;
//         width: 80%;
//         min-height: 100px;
//         overflow-wrap: break-word;
//       }
//     </style>
//   </head>
//   <body>
//     <h1>Audio Transcribe</h1>
//     <div id="transcriptions">
//       <h2>Previous Transcriptions</h2>
//       <p class="transcription"></p>
//     </div>
//   </body>
// </html>
//turn each transcription into a html element and return as a html page
app.get("/transcriptions", async (req, res) => {
  const transcriptions = await getTranscriptions();
  const transcriptionElements = transcriptions
    .map((transcription) => `<p>${transcription.transcription}</p>`)
    .join("");
  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Document</title>
        <style>
          body {
            font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
            text-align: center;
          }
          h1 {
            color: #333;
          }
          .transcription {
            margin: 20px auto;
            padding: 20px;
            font-size: 16px;
            border: 1px solid #ccc;
            width: 80%;
            min-height: 100px;
            overflow-wrap: break-word;
          }
        </style>
      </head>
      <body>
        <h1>Audio Transcribe</h1>
        <div id="transcriptions">
          <h2>Previous Transcriptions</h2>
          <div class="transcription">${transcriptionElements}</div>
        </div>
      </body>
    </html>
    `;
  res.send(html);
});

// Routes
app.post("/api/transcription", async (req, res) => {
  const { timestamp, transcription, id, session } = req.body;
  if (!timestamp || !transcription || !id || !session) {
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
    id,
    sessionId: uuidv4(),
  };
  await saveTranscription(newTranscription);
  return res.json(newTranscription);
});

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
  app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
  });
}

startServer();
