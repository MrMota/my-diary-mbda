const STORAGE_KEY = "daybook.entries.v1";
const PREFS_KEY = "daybook.preferences.v1";

const $ = (selector) => document.querySelector(selector);
const entryList = $("#entryList");
const emptyList = $("#emptyList");
const titleInput = $("#titleInput");
const bodyInput = $("#bodyInput");
const dateInput = $("#entryDate");
const moodSelect = $("#moodSelect");
const tagsInput = $("#tagsInput");

let entries = loadEntries();
let activeId = null;
let activeFilter = "all";
let deferredInstallPrompt = null;

const prompts = [
  "What felt good today, even for a moment?",
  "What is something you want to remember about this week?",
  "What’s taking up space in your mind right now?",
  "What would you tell a friend going through your day?",
  "What are three small things you’re grateful for?",
  "What did you learn about yourself today?",
  "What are you looking forward to?"
];

function loadEntries() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter(e => e && e.id && e.date) : [];
  } catch {
    return [];
  }
}

function saveEntriesToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function displayDate(iso) {
  if (!iso) return "";
  const date = new Date(`${iso}T12:00:00`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function loadPreferences() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
  } catch {
    return {};
  }
}

function savePreferences() {
  const prefs = {
    theme: $("#themeSelect").value,
    accent: $("#accentInput").value,
    fontSize: $("#fontSizeInput").value
  };
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

function applyPreferences() {
  const prefs = loadPreferences();
  $("#themeSelect").value = prefs.theme || "system";
  $("#accentInput").value = prefs.accent || "#8971c8";
  $("#fontSizeInput").value = prefs.fontSize || "16";

  document.documentElement.dataset.theme = prefs.theme || "system";
  document.documentElement.style.setProperty("--accent", prefs.accent || "#8971c8");
  document.documentElement.style.setProperty("--font-size", `${prefs.fontSize || 16}px`);
}

function updateWordCount() {
  const words = bodyInput.value.trim().match(/\S+/g) || [];
  $("#wordCount").textContent = `${words.length} ${words.length === 1 ? "word" : "words"}`;
}

function updateFavoriteButton(favorite = false) {
  const button = $("#favoriteBtn");
  button.textContent = favorite ? "★" : "☆";
  button.classList.toggle("is-favorite", favorite);
  button.setAttribute("aria-pressed", String(favorite));
}

function newEntry() {
  activeId = null;
  dateInput.value = todayISO();
  titleInput.value = "";
  bodyInput.value = "";
  moodSelect.value = "";
  tagsInput.value = "";
  $("#deleteBtn").hidden = true;
  updateFavoriteButton(false);
  updateWordCount();
  $("#saveStatus").textContent = "New entry";
  renderEntries();
  titleInput.focus();
}

function openEntry(entry) {
  activeId = entry.id;
  dateInput.value = entry.date || todayISO();
  titleInput.value = entry.title || "";
  bodyInput.value = entry.body || "";
  moodSelect.value = entry.mood || "";
  tagsInput.value = (entry.tags || []).join(", ");
  $("#deleteBtn").hidden = false;
  updateFavoriteButton(Boolean(entry.favorite));
  updateWordCount();
  $("#saveStatus").textContent = `Updated ${displayDate(entry.updatedAt?.slice(0, 10) || entry.date)}`;
  renderEntries();
}

function saveEntry() {
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  if (!title && !body) {
    $("#saveStatus").textContent = "Write something before saving";
    bodyInput.focus();
    return;
  }

  const now = new Date().toISOString();
  const previous = entries.find(e => e.id === activeId);
  const entry = {
    id: activeId || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    title,
    body,
    date: dateInput.value || todayISO(),
    mood: moodSelect.value,
    tags: tagsInput.value.split(",").map(tag => tag.trim()).filter(Boolean),
    favorite: previous ? Boolean(previous.favorite) : false,
    createdAt: previous?.createdAt || now,
    updatedAt: now
  };

  if (previous) {
    entries = entries.map(e => e.id === entry.id ? entry : e);
  } else {
    entries.push(entry);
  }

  activeId = entry.id;
  saveEntriesToStorage();
  $("#deleteBtn").hidden = false;
  updateFavoriteButton(entry.favorite);
  $("#saveStatus").textContent = "Saved just now";
  renderEntries();
}

function renderEntries() {
  const query = $("#searchInput").value.trim().toLowerCase();
  const month = $("#dateFilter").value;

  let visible = [...entries].sort((a, b) =>
    (b.date || "").localeCompare(a.date || "") ||
    (b.updatedAt || "").localeCompare(a.updatedAt || "")
  );

  if (activeFilter === "favorites") visible = visible.filter(e => e.favorite);
  if (month) visible = visible.filter(e => e.date.startsWith(month));
  if (query) {
    visible = visible.filter(e =>
      [e.title, e.body, ...(e.tags || [])].join(" ").toLowerCase().includes(query)
    );
  }

  entryList.replaceChildren();
  for (const entry of visible) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `entry-card${entry.id === activeId ? " selected" : ""}`;

    const head = document.createElement("span");
    head.className = "entry-card-head";

    const title = document.createElement("span");
    title.className = "entry-card-title";
    title.textContent = entry.title || "Untitled entry";

    const date = document.createElement("span");
    date.className = "entry-card-date";
    date.textContent = entry.favorite ? "★" : "";

    head.append(title, date);

    const preview = document.createElement("span");
    preview.className = "entry-card-preview";
    const snippet = (entry.body || (entry.tags || []).join(", ") || "No extra details").replace(/\s+/g, " ");
    preview.textContent = `${displayDate(entry.date)}${entry.mood ? ` · ${entry.mood}` : ""} · ${snippet}`;

    card.append(head, preview);
    card.addEventListener("click", () => openEntry(entry));
    entryList.append(card);
  }

  emptyList.hidden = visible.length > 0;
  $("#allCount").textContent = entries.length;
  $("#favoriteCount").textContent = entries.filter(e => e.favorite).length;
}

function toggleFavorite() {
  if (!activeId) {
    $("#saveStatus").textContent = "Save the entry before favoriting it";
    return;
  }
  const entry = entries.find(e => e.id === activeId);
  if (!entry) return;
  entry.favorite = !entry.favorite;
  entry.updatedAt = new Date().toISOString();
  saveEntriesToStorage();
  updateFavoriteButton(entry.favorite);
  renderEntries();
}

function deleteEntry() {
  if (!activeId) return;
  if (!confirm("Delete this diary entry? This cannot be undone.")) return;
  entries = entries.filter(e => e.id !== activeId);
  saveEntriesToStorage();
  newEntry();
  $("#saveStatus").textContent = "Entry deleted";
}

function formatSelection(button) {
  const start = bodyInput.selectionStart;
  const end = bodyInput.selectionEnd;
  const selected = bodyInput.value.slice(start, end);

  if (button.dataset.wrap) {
    const marker = button.dataset.wrap;
    const replacement = selected ? `${marker}${selected}${marker}` : `${marker}${marker}`;
    bodyInput.setRangeText(replacement, start, end, "select");
    if (!selected) bodyInput.setSelectionRange(start + marker.length, start + marker.length);
  } else if (button.dataset.prefix) {
    const lineStart = bodyInput.value.lastIndexOf("\n", start - 1) + 1;
    bodyInput.setRangeText(button.dataset.prefix, lineStart, lineStart, "start");
  }

  bodyInput.focus();
  updateWordCount();
}

function exportDiary() {
  const backup = {
    app: "Daybook",
    exportedAt: new Date().toISOString(),
    entries
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `daybook-backup-${todayISO()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importDiary(file) {
  try {
    const data = JSON.parse(await file.text());
    const imported = Array.isArray(data) ? data : data.entries;
    if (!Array.isArray(imported)) throw new Error("This file does not contain a diary backup.");

    const cleaned = imported
      .filter(e => e && e.date && (e.title || e.body))
      .map(e => ({
        id: String(e.id || (crypto.randomUUID ? crypto.randomUUID() : Date.now() + Math.random())),
        title: String(e.title || ""),
        body: String(e.body || ""),
        date: String(e.date),
        mood: String(e.mood || ""),
        tags: Array.isArray(e.tags) ? e.tags.map(String) : [],
        favorite: Boolean(e.favorite),
        createdAt: e.createdAt || new Date().toISOString(),
        updatedAt: e.updatedAt || e.createdAt || new Date().toISOString()
      }));

    const byId = new Map(entries.map(e => [e.id, e]));
    cleaned.forEach(e => byId.set(e.id, e));
    entries = [...byId.values()];
    saveEntriesToStorage();
    renderEntries();
    $("#saveStatus").textContent = `Imported ${cleaned.length} entries`;
  } catch (error) {
    alert(`Could not import diary: ${error.message}`);
  }
}

$("#newEntryBtn").addEventListener("click", newEntry);
$("#saveBtn").addEventListener("click", saveEntry);
$("#deleteBtn").addEventListener("click", deleteEntry);
$("#favoriteBtn").addEventListener("click", toggleFavorite);
$("#searchInput").addEventListener("input", renderEntries);
$("#dateFilter").addEventListener("change", renderEntries);
bodyInput.addEventListener("input", updateWordCount);
$("#exportBtn").addEventListener("click", exportDiary);
$("#importBtn").addEventListener("click", () => $("#importFile").click());
$("#importFile").addEventListener("change", event => {
  const file = event.target.files[0];
  if (file) importDiary(file);
  event.target.value = "";
});

document.querySelectorAll(".filter").forEach(button => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll(".filter").forEach(b => b.classList.toggle("active", b === button));
    renderEntries();
  });
});

document.querySelectorAll(".format-btn").forEach(button => {
  button.addEventListener("click", () => formatSelection(button));
});

$("#promptBtn").addEventListener("click", () => {
  const prompt = prompts[Math.floor(Math.random() * prompts.length)];
  bodyInput.value += `${bodyInput.value ? "\n\n" : ""}${prompt}\n`;
  bodyInput.focus();
  bodyInput.setSelectionRange(bodyInput.value.length, bodyInput.value.length);
  updateWordCount();
});

$("#themeSelect").addEventListener("change", () => {
  document.documentElement.dataset.theme = $("#themeSelect").value;
  savePreferences();
});
$("#accentInput").addEventListener("input", () => {
  document.documentElement.style.setProperty("--accent", $("#accentInput").value);
  savePreferences();
});
$("#fontSizeInput").addEventListener("input", () => {
  document.documentElement.style.setProperty("--font-size", `${$("#fontSizeInput").value}px`);
  savePreferences();
});

document.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveEntry();
  }
});

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  $("#installBtn").hidden = false;
});
$("#installBtn").addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  $("#installBtn").hidden = true;
});

const today = new Date();
$("#todayLabel").textContent = today.toLocaleDateString(undefined, {
  weekday: "long", month: "long", day: "numeric", year: "numeric"
});

applyPreferences();
renderEntries();
newEntry();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(console.error));
}
