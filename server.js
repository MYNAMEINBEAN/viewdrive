import express from "express";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send(`
    <h2>Google Drive MP4 Scraper</h2>
    <form action="/scrape" method="get">
      <input type="text" name="folder" placeholder="Paste Google Drive folder link" size="50"/>
      <button type="submit">Scrape</button>
    </form>
  `);
});

app.get("/scrape", async (req, res) => {
  const { folder } = req.query;
  if (!folder) return res.json({ error: "Missing ?folder=<drive-folder-link>" });

  try {
    const gRes = await fetch(folder);
    if (!gRes.ok) return res.json({ error: "Failed to fetch folder" });
    const html = await gRes.text();

    const $ = cheerio.load(html);
    const files = [];

    // Find MP4 entries inside Google's embedded JSON
    const script = $("script")
      .map((i, el) => $(el).html())
      .get()
      .find(txt => txt && txt.includes("window.viewerData"));

    if (script) {
      const matches = [...script.matchAll(/"(\/file\/d\/[a-zA-Z0-9_-]+)".*?"([^"]+\.mp4)"/g)];
      matches.forEach(m => {
        const fileId = m[1].split("/d/")[1];
        const name = m[2];
        const url = `https://drive.google.com/uc?export=download&id=${fileId}`;
        files.push({ id: fileId, name, url });
      });
    }

    res.json({ count: files.length, files });
  } catch (err) {
    res.json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server running on :${PORT}`));
