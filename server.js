import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send(`
    <h2>Google Drive Scraper</h2>
    <form action="/scrape" method="get">
      <input type="text" name="folder" placeholder="Paste Google Drive folder link" size="60"/>
      <button type="submit">Scrape</button>
    </form>
    <p>Try: /scrape?folder=https://drive.google.com/drive/folders/XXXXXXXX</p>
  `);
});

app.get("/scrape", async (req, res) => {
  const { folder } = req.query;
  if (!folder) return res.json({ error: "Missing ?folder=<drive-folder-link>" });

  try {
    const gRes = await fetch(folder);
    if (!gRes.ok) return res.json({ error: "Failed to fetch folder" });
    const html = await gRes.text();

    // Extract JSON blob (contains files & folders)
    const match = html.match(/window\['_DRIVE_ivd'\]\s*=\s*'(.+?)';/);
    if (!match) return res.json({ error: "No data found. Maybe folder is private?" });

    const rawJson = JSON.parse(match[1].replace(/\\"/g, '"'));
    const files = [];

    // Google stores files in arrays inside rawJson
    rawJson[0].forEach(entry => {
      const id = entry[0];
      const name = entry[2];
      const mime = entry[3];
      const isFolder = mime === "application/vnd.google-apps.folder";

      if (isFolder) {
        files.push({
          id,
          name,
          type: "folder",
          url: `https://drive.google.com/drive/folders/${id}`
        });
      } else if (name.endsWith(".mp4")) {
        files.push({
          id,
          name,
          type: "file",
          url: `https://drive.google.com/uc?export=download&id=${id}`
        });
      }
    });

    res.json({ count: files.length, files });
  } catch (err) {
    res.json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server running on :${PORT}`));
