require("dotenv").config();
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public")); // Serve your static HTML file
const port = process.env.PORT || 3000;
// mongodb
const mongoUri = process.env.MONGO_URI;
const db = "audio-transcription";
const MongoClient = require("mongodb").MongoClient;
const client = new MongoClient(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
// Connect to the db
client.connect((err) => {
  if (err) {
    console.log(err);
  } else {
    console.log("Connected to db");
  }
});
//save transcription to db
const saveTranscription = (transcription) => {
  //make sure collection exists
  const collection = client.db(db).collection("audio-transcription");
  collection.insertOne(transcription, (err, result) => {
    if (err) {
      console.log(err);
    } else {
      console.log(result);
    }
  });
};
//get transcription from db
const getTranscription = () => {
  const collection = client.db(db).collection("audio-transcription");
  collection.find({}).toArray((err, result) => {
    if (err) {
      console.log(err);
    } else {
      console.log(result);
    }
  });
};

app.post("/api/transcription", (req, res) => {
  const { timestamp, transcription } = req.body;
  const newNote = {
    timestamp,
    transcription,
    id: uuidv4(),
  };
  saveTranscription(newNote);
  res.json(newNote);
});

app.get("/api/transcription", (req, res) => {
  const notes = getTranscription();
  res.json(notes);
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
