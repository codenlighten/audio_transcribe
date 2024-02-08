const fs = require("fs");
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public")); // Serve your static HTML file

// Create a middleware to check if db.json exists, if not, create an empty array
app.use((req, res, next) => {
  const dbPath = "db/db.json";
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, "[]");
  }
  next();
});

app.post("/api/transcription", (req, res) => {
  const { timestamp, transcription } = req.body;
  const newNote = {
    timestamp,
    transcription,
    id: uuidv4(),
  };
  const notes = JSON.parse(fs.readFileSync("db/db.json"));
  notes.push(newNote);
  fs.writeFileSync("db/db.json", JSON.stringify(notes));
  res.json(newNote);
});

app.get("/api/transcription", (req, res) => {
  const notes = JSON.parse(fs.readFileSync("db/db.json"));
  res.json(notes);
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
