# AnimationJS-CSS

A Node.js AI agent interface for generating HTML, CSS, and JavaScript UI animations.

## Run

```sh
npm start
```

Open the printed local URL in your browser.

## Connect OpenAI

Create a `.env` file in this folder:

```sh
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-5.1
```

Restart the server after changing `.env`.

The backend route is `POST /api/generate`. It sends your prompt to OpenAI and expects a JSON artifact with:

- `title`
- `summary`
- `html`
- `css`
- `js`

If `OPENAI_API_KEY` is missing, the app uses a local fallback generator so the UI still works.
