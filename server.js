import express from "express";
import puppeteer from "puppeteer";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

app.get("/scrape", async (req, res) => {
  const { folder } = req.query;
  if (!folder) return res.json({ error: "Missing ?folder=" });

  try {
    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();

    await page.goto(folder, { waitUntil: "networkidle2" });

    // Scroll to load everything
    let previousHeight;
    while (true) {
      previousHeight = await page.evaluate("document.body.scrollHeight");
      await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
      await page.waitForTimeout(1000);
      const newHeight = await page.evaluate("document.body.scrollHeight");
      if (newHeight === previousHeight) break;
    }

    // Extract folder and MP4 info
    const items = await page.evaluate(() => {
      const list = [];
      document.querySelectorAll("[role='listitem']").forEach(el => {
        const nameEl = el.querySelector("[aria-label]");
        if (!nameEl) return;
        const name = nameEl.getAttribute("aria-label");
        const linkEl = el.querySelector("a");
        if (!linkEl) return;
        const url = linkEl.href;
        const isFolder = /\/folders\//.test(url);
        list.push({
          name,
          url,
          type: isFolder ? "folder" : name.toLowerCase().endsWith(".mp4") ? "file" : "other"
        });
      });
      return list.filter(i => i.type === "folder" || i.type === "file");
    });

    await browser.close();
    res.json({ count: items.length, files: items });
  } catch (err) {
    console.error(err);
    res.json({ error: err.message });
  }
});

app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Drive Puppeteer Scraper</title>
  <style>
    body { font-family:sans-serif; padding:20px; }
    #list { margin-top:20px; }
    .item { margin:5px 0; cursor:pointer; color:blue; text-decoration:underline; }
    iframe { width:100%; height:500px; display:none; margin-top:20px; }
  </style>
</head>
<body>
<h2>Google Drive Puppeteer Scraper</h2>
<input id="folderUrl" type="text" size="60" placeholder="Paste Google Drive folder link"/>
<button onclick="loadFolder()">Load Folder</button>
<div id="list"></div>
<iframe id="player" frameborder="0" allowfullscreen></iframe>

<script>
async function loadFolder() {
  const url = document.getElementById("folderUrl").value.trim();
  if (!url) return alert("Enter folder link");

  const res = await fetch("/scrape?folder=" + encodeURIComponent(url));
  const data = await res.json();

  const list = document.getElementById("list");
  list.innerHTML = "";
  const player = document.getElementById("player");
  player.style.display = "none";
  player.src = "";

  if (data.error) {
    list.innerHTML = "<p style='color:red'>" + data.error + "</p>";
    return;
  }

  data.files.forEach(item => {
    const div = document.createElement("div");
    div.className = "item";
    div.textContent = (item.type === "folder" ? "📁 " : "🎬 ") + item.name;
    div.onclick = () => {
      if (item.type === "folder") {
        document.getElementById("folderUrl").value = item.url;
        loadFolder();
      } else {
        player.src = item.url;
        player.style.display = "block";
      }
    };
    list.appendChild(div);
  });
}
</script>
</body>
</html>
  `);
});

app.listen(PORT, () => console.log("Server running on port " + PORT));
