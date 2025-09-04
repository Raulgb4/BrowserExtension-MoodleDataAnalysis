# 📌 Moodle Data Analyzer

🚀 **Google Chrome Extension for Extracting and Analyzing Moodle Course Data**  
A browser extension built to help educators monitor and analyze student participation in **Moodle** courses.  
It works by scraping course pages (DOM), processing the data locally, and providing interactive charts and exports — all within the browser.

---

## 📖 Overview

When opened on a Moodle course page, the extension allows teachers to **run an analysis**.  
It automatically collects participant information, activity usage, and last access data by navigating Moodle’s internal URLs.

The extracted data is then:
- **Processed** into structured datasets.
- **Visualized** with interactive charts (bar, line, pie, polar area, radar).
- **Exported** into multiple file formats for reporting.

⚡ All processing happens **locally in the browser**, ensuring privacy and efficiency.

---

## 🌟 Features

- ✅ Multiple sections with modular React components and charts.
- ✅ Wide chart support powered by Chart.js.
- ✅ Dynamic chart titles and legends that adapt to filters.
- ✅ Role-based participant filtering (Student / Teacher).
- ✅ Export charts as **CSV, PDF, PNG, and JPEG**.
- ✅ “Last analysis” timestamp for context.
- ✅ Persistent data across popup sessions.
- ✅ Responsive layout with scrollable, segmented sections.
- ✅ Error handling for non-Moodle pages.
- ✅ Modular codebase (scraping, processing, filtering, visualization layers).
- ✅ Manual re-analysis trigger to refresh data.
- ✅ Internationalization-ready: English by default, Spanish supported.

---

## 📦 Build & Install

### One-Time Setup

```bash
npm install
npm run build
```

This creates a `dist/` folder containing the compiled Chrome Extension.

### Load Extension into Chrome

1. Clone this repository:
   ```bash
   git clone https://github.com/Raulgb4/BrowserExtension-MoodleDataAnalysis.git
   ```
2. Open Chrome and navigate to: `chrome://extensions/`
3. Enable **Developer Mode** (top-right).
4. Click **Load unpacked** and select the `dist/` folder.

👉 The extension is now ready to use.

---

## 🐳 Local Moodle Test Server (Docker)

The repository includes a **Dockerized Moodle server** to test the extension with real course data from `.mbz` backups.

### Launch Moodle Locally

```bash
cd docker/
docker-compose up
```

Then open 👉 http://localhost:8080

Default credentials:
- **Username:** `admin`
- **Password:** `admin123`

*(These values can be changed in `docker-compose.yml`.)*

---

### 📤 Restore a `.mbz` Course

1. In Moodle, go to:  
   `Site administration > Courses > Restore`
2. Upload the `.mbz` backup file provided by tutors.
3. Choose **Create a new course** when prompted.
4. Follow the restore wizard.
5. Once restored, navigate the course and analyze it using the extension.

---

### 🔁 Manage Docker Containers

- Run in background:
  ```bash
  docker-compose up -d
  ```
- Stop containers:
  ```bash
  docker-compose down
  ```

---

## 🛠️ Tech Stack

- **React + TypeScript** – UI & state management
- **TailwindCSS** – responsive styling
- **Chart.js** – chart rendering
- **i18next** – internationalization (EN/ES)
- **jsPDF & FileSaver** – exporting charts & reports
- **Docker Compose** – local Moodle environment

---

## 📜 License

Licensed under the **MIT License**

---

🎓 Developed as part of the **Final Year Project (TFG)** at the *University of Málaga*  
by **Raúl García Balongo**.  
