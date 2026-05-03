# AnimationJS-CSS

A Node.js AI agent interface for generating HTML, CSS, and JavaScript UI animations.

## Run

```sh
npm start
```

Open the printed local URL in your browser.

## Connect Gemini

Create a `.env` file in this folder:

```sh
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

Restart the server after changing `.env`.

The backend route is `POST /api/generate`. It sends your prompt to Gemini and expects a JSON artifact with:

- `title`
- `summary`
- `html`
- `css`
- `js`

If `GEMINI_API_KEY` is missing, the app uses a local fallback generator so the UI still works.
