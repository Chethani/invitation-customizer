# Invitation Studio

Invitation Studio is a small FastAPI application that creates personalized PNG invitations from a text guest list and an uploaded invitation template. The bundled one-page frontend previews the first personalized invitation and downloads all generated invitations as a ZIP archive.

## Features

- Guest-list and PNG template uploads with drag-and-drop support
- Guest count and customized first-guest preview
- Batch invitation generation and automatic ZIP download
- Temporary request storage with automatic cleanup
- Responsive, single-page frontend served by FastAPI

## Project structure

```text
.
├── main.py
├── requirements.txt
├── GreatVibes.ttf
├── static/
│   ├── index.html
│   ├── styles.css
│   └── script.js
├── README.md
└── .gitignore
```

## Local setup

Python 3.11 or newer is recommended.

```bash
python -m venv .venv
```

Activate the environment:

```bash
# macOS/Linux
source .venv/bin/activate

# Windows PowerShell
.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run the application:

```bash
uvicorn main:app --reload
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000). Upload a `.txt` guest list and a PNG invitation template, confirm the personalized preview appears, then generate and download the ZIP.

## Deploy on Render

1. Push this project to a GitHub repository.
2. In Render, create a new **Web Service** and connect the repository.
3. Choose the Python runtime.
4. Configure these commands:

   **Build Command**

   ```text
   pip install -r requirements.txt
   ```

   **Start Command**

   ```text
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```

5. Deploy the service and open its Render URL.

No persistent disk is required. Uploaded files, generated invitation images, previews, and ZIP archives use temporary request directories and are removed automatically.

## API endpoints

- `GET /` — serves the frontend
- `POST /preview` — returns one customized PNG using the first guest name
- `POST /generate` — returns `customized_invitations.zip`
