# 📌 Moodle Data Analyzer

🚀 **Google Chrome Extension for Extracting and Analyzing Moodle Course Data**  
This project is a browser extension designed to help educators analyze student activity and participation in **Moodle** courses by scraping data directly from course pages (DOM).

---

## 📖 Project Overview

Once opened on a Moodle course page, the extension allows the teacher to initiate an analysis. It then collects key information such as participant data or activity stats by programmatically navigating and scraping key Moodle URLs.

The extracted data is processed and visualized using multiple chart types (bar, line, polar area...) and can be exported in several formats. Everything runs **locally** within the browser.

---

## 🌟 Implemented Features

- ✅ Multiple sections within the extension, each with modular React components and corresponding charts.
- ✅ Support for various chart types (bar, line, polar area...). Powered by Chart.js.
- ✅ Dynamic chart titles and legends that update, according to applied filters.
- ✅ Participant filters by role (student, teacher) to view segmented data.
- ✅ Export charts in CSV, PDF, PNG, and JPEG (SVG export not supported).
- ✅ Display of the last analysis timestamp for user context.
- ✅ Persistent data storage even after minimizing or closing the extension popup.
- ✅ Responsive layout with scrollable and clearly segmented sections.
- ✅ Error control: gracefully handles pages that are not Moodle course pages.
- ✅ Modular codebase: reusable functions for scraping, processing, filtering, and chart rendering.
- ✅ Manual re-analysis trigger to update scraped data.
- ✅ Clear architectural separation between extraction, processing, and visualization modules.
- ✅ English interface by default, with support for future internationalization (e.g., Spanish).

> 📌 Current data is scraped from a **local Moodle server**, pending access to an official Moodle instance for real-case adaptation.

---

## 📦 Build and Run the Extension

### 📌 One-Time Setup

```bash
npm install
npm run build
```

This will generate a `dist/` folder with the final compiled Chrome Extension files.

### 🧩 Load Extension Manually

1. Clone this repository:
   ```bash
   git clone https://github.com/Raulgb4/BrowserExtension-MoodleDataAnalysis.git
   ```

2. Open Google Chrome and go to: `chrome://extensions/`

3. Enable **Developer Mode** (top-right)

4. Click on **"Load unpacked"** and select the `dist/` folder.

You're now ready to use the extension.

---

## 🐳 Moodle Test Server (Docker)

This project includes a preconfigured Moodle server using Docker Compose to allow testing the extension with real course data extracted from a `.mbz` backup file.

### ✅ How to Launch Moodle Locally

1. Go to the `docker/` directory:
   ```bash
   cd docker/
   ```

2. Start the containers:
   ```bash
   docker-compose up
   ```

3. Open your browser and access:
   👉 http://localhost:8080

4. Log in with:
- **Username:** `admin`
- **Password:** `admin123`

> Credentials are configurable in `docker-compose.yml`

---

### 📤 How to Restore a `.mbz` Course File

1. In the Moodle interface, go to:
   `Site administration > Courses > Restore`
2. Upload the `.mbz` file provided by the tutors.
3. Choose "Create a new course" when prompted.
4. Follow the steps to complete the restore process.
5. Once restored, you can navigate the course and use the browser extension to extract and analyze its data.

---

### 🔁 Stopping and Restarting

- To run in the background:
  ```bash
  docker-compose up -d
  ```
- To stop the containers:
  ```bash
  docker-compose down
  ```

---

## 📂 Project Structure (IN PROGRESS)
```
BrowserExtension-MoodleDataAnalysis/
├── dist/                # Production build: load this folder in the browser
├── docker/              # Local Moodle test server setup
├── src/                 # TypeScript source files (React components, services, etc.)
├── public/              # Static assets like icons and base HTML files
├── README.md            # Project documentation (this file)
├── package.json         # Dependencies and scripts
└── .gitignore           # Ignored files (dist/ is now tracked)
```

---

## 📜 License

This project is licensed under the **MIT License** – see the `LICENSE` file for more details.

---

🎓 Developed as part of a Final Year Project (TFG) at the University of Málaga by **Raúl García Balongo**.