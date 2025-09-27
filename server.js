import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

async function scrapeFolder(folderUrl) {
  const res = await fetch(folderUrl);
  if (!res.ok) throw new Error("Failed to fetch folder");

  const html = await res.text();

  const match = html.match(/window\['_DRIVE_ivd'\]\s*=\s*'(.+?)';/);
  if (!match) throw new Error("No folder data found. Make sure the folder is public.");

  const escaped = match[1];
  const decoded = escaped.replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );

  const rawJson = JSON.parse(decoded);
  const items = [];

  rawJson[0].forEach(entry => {
    const id = entry[0];
    const name = entry[2];
    const mime = entry[3];
    const isFolder = mime === "application/vnd.google-apps.folder";

    if (isFolder) {
      items.push({
        id,
        name,
        type: "folder",
        url: `https://drive.google.com/drive/folders/${id}`
      });
    } else if (name && name.toLowerCase().endsWith(".mp4")) {
      items.push({
        id,
        name,
        type: "file",
        url: `https://drive.google.com/file/d/${id}/preview`
      });
    }
  });

  return items;
}

app.get("/scrape", async (req, res) => {
  const { folder } = req.query;
  if (!folder) return res.json({ error: "Missing ?folder=<drive-folder-link>" });

  try {
    const files = await scrapeFolder(folder);
    res.json({ count: files.length, files });
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
  <title>Drive Scraper Player</title>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    #list { margin-top: 20px; }
    .item { margin: 5px 0; cursor: pointer; color: blue; text-decoration: underline; }
    iframe { width: 100%; height: 500px; display: none; margin-top: 20px; }
    button { padding: 5px 10px; margin-top: 10px; }
  </style>
</head>
<body>
  <h2>Google Drive Scraper</h2>
  <input id="folderInput" type="text" size="60" placeholder="Paste Google Drive folder link"/>
  <button onclick="loadFolder()">Load Folder</button>
  <button onclick="goBack()">⬅ Back</button>
  <div id="list"></div>
  <button id="loadMoreBtn" onclick="loadMore()" style="display:none;">Load More</button>
  <iframe id="player" frameborder="0" allowfullscreen></iframe>

  <script>
    const historyStack = [];
    let currentFolder = null;

    async function loadFolder(folderUrl) {
      if (!folderUrl) folderUrl = document.getElementById("folderInput").value.trim();
      if (!folderUrl) return alert("Please enter a folder link.");

      currentFolder = folderUrl;
      historyStack.push(folderUrl);

      document.getElementById("list").innerHTML = "";
      document.getElementById("player").style.display = "none";

      const res = await fetch("/scrape?folder=" + encodeURIComponent(folderUrl));
      const data = await res.json();

      if (data.error) {
        document.getElementById("list").innerHTML = "<p style='color:red'>" + data.error + "</p>";
        return;
      }

      renderList(data.files);
    }

    function renderList(files) {
      const list = document.getElementById("list");
      files.forEach(item => {
        const div = document.createElement("div");
        div.className = "item";
        div.textContent = (item.type === "folder" ? "📁 " : "🎬 ") + item.name;

        div.onclick = () => {
          if (item.type === "folder") {
            document.getElementById("folderInput").value = item.url;
            loadFolder(item.url);
          } else {
            const player = document.getElementById("player");
            player.src = item.url;
            player.style.display = "block";
          }
        };

        list.appendChild(div);
      });

      // Show load more button if there might be more
      document.getElementById("loadMoreBtn").style.display = "block";
    }

    function goBack() {
      if (historyStack.length > 1) {
        historyStack.pop();
        const last = historyStack.pop();
        if (last) loadFolder(last);
      }
    }

    function loadMore() {
      if (currentFolder) {
        loadFolder(currentFolder); // re-scrape current folder
      }
    }
  </script>
</body>
</html>
  `);
});

app.listen(PORT, () => console.log("Server running on port " + PORT));
