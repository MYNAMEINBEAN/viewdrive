async function scrapeFolder(folderUrl) {
  const gRes = await fetch(folderUrl);
  if (!gRes.ok) throw new Error("Failed to fetch folder");
  const html = await gRes.text();

  // Find the embedded Drive data blob
  const match = html.match(/window\['_DRIVE_ivd'\]\s*=\s*'(.+?)';/);
  if (!match) return [];

  // Step 1: unescape \xNN sequences
  const escaped = match[1];
  const decoded = escaped.replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );

  // Step 2: now parse as JSON
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
        url: `https://drive.google.com/uc?export=download&id=${id}`
      });
    }
  });

  return items;
}
