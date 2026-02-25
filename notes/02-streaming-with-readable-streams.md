# Streaming OpenAI Responses with Readable Streams

> **Prerequisites:** Read `01-async-await-promises.md` first. This guide assumes you understand `async/await`, `fetch`, and promises.

---

## Why Streaming?

Without streaming, your app:
1. Sends a request
2. Waits 5–30 seconds in silence
3. Gets the entire response all at once

With streaming, your app:
1. Sends a request
2. Receives tokens as they are generated, word by word
3. Displays text to the user in real time (like ChatGPT does)

This is dramatically better UX for any AI interface.

---

## Part 1: What Is a ReadableStream?

A `ReadableStream` is a web standard for consuming data incrementally, in chunks, as it arrives — rather than waiting for the whole payload.

`fetch()` already gives you one. The `response.body` property on any fetch response is a `ReadableStream`.

```javascript
const response = await fetch(url);
console.log(response.body); // ReadableStream object
```

Previously we called `response.json()` which internally reads the whole stream and parses it. Streaming means we skip that and process the raw chunks ourselves.

### The Reader

To consume a `ReadableStream`, you get a **reader** from it:

```javascript
const reader = response.body.getReader();
```

The reader has one core method:

```javascript
const { value, done } = await reader.read();
```

- `value` — a `Uint8Array` (raw bytes) of the next chunk
- `done` — `true` when the stream is finished, `false` otherwise

You call `reader.read()` in a loop until `done` is `true`.

### Decoding Bytes to Text

`value` is raw bytes. To convert to a string, use `TextDecoder`:

```javascript
const decoder = new TextDecoder("utf-8");
const text = decoder.decode(value);
```

---

## Part 2: How OpenAI's Streaming Format Works

When you add `"stream": true` to your OpenAI request body, the API sends back a stream of **Server-Sent Events (SSE)**.

SSE is a simple text format. Each event looks like this:

```
data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","choices":[{"delta":{"content":"Hello"},"index":0}]}

data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","choices":[{"delta":{"content":" world"},"index":0}]}

data: [DONE]
```

Key things to know:
- Every line starts with `data: `
- Each line contains a JSON object (a **chunk**) OR the literal string `[DONE]`
- The content token is at `chunk.choices[0].delta.content`
- `delta` is used instead of `message` — it only contains what's _new_ in that chunk
- `[DONE]` signals the stream is finished

A raw chunk object looks like:

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion.chunk",
  "created": 1714000000,
  "model": "gpt-4o",
  "choices": [
    {
      "index": 0,
      "delta": {
        "content": "Hello"
      },
      "finish_reason": null
    }
  ]
}
```

The last chunk has `"finish_reason": "stop"` and an empty `delta: {}`.

---

## Part 3: The Streaming Loop Pattern

Here is the fundamental pattern for reading any streaming fetch response:

```javascript
async function readStream(response, onChunk) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");

  while (true) {
    const { value, done } = await reader.read();

    if (done) break; // stream finished

    const text = decoder.decode(value, { stream: true }); // decode bytes to string
    onChunk(text); // do something with the raw text chunk
  }
}
```

The `{ stream: true }` option in `decoder.decode()` tells the TextDecoder to buffer incomplete multi-byte characters across chunks. Always include this for streaming.

---

## Part 4: Parsing SSE Lines From OpenAI

Raw chunks from the network don't always align perfectly with SSE event boundaries. A single `reader.read()` call might give you:
- Half an event line
- Multiple complete event lines
- A complete line plus the start of the next one

You need to handle this by buffering text and splitting on newlines:

```javascript
async function streamOpenAI(userMessage, onToken) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      stream: true, // <-- this is the key difference
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`OpenAI error ${response.status}: ${err.error.message}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = ""; // accumulates incomplete lines across chunks

  while (true) {
    const { value, done } = await reader.read();

    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE events are separated by double newlines.
    // Split on newlines to process each line.
    const lines = buffer.split("\n");

    // The last element might be incomplete — keep it in the buffer
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || !trimmed.startsWith("data: ")) continue; // skip empty lines

      const payload = trimmed.slice(6); // remove "data: " prefix

      if (payload === "[DONE]") return; // stream complete

      try {
        const chunk = JSON.parse(payload);
        const token = chunk.choices[0]?.delta?.content;

        if (token) {
          onToken(token); // call our callback with each new token
        }
      } catch {
        // malformed JSON line — skip it
      }
    }
  }
}
```

### Using It

```javascript
let fullReply = "";

await streamOpenAI("Write me a haiku about rain.", (token) => {
  process.stdout.write(token); // prints each token as it arrives (Node.js)
  fullReply += token;
});

console.log("\n\nFull reply:", fullReply);
```

In a browser, replace `process.stdout.write(token)` with updating a DOM element:

```javascript
const outputEl = document.getElementById("output");

await streamOpenAI("Write me a haiku about rain.", (token) => {
  outputEl.textContent += token;
});
```

---

## Part 5: Full Browser Implementation

Here is a complete, self-contained example you could drop into a browser `<script type="module">`:

```javascript
const OPENAI_API_KEY = "sk-..."; // Use an env variable or backend proxy in production

async function streamChat({ messages, onToken, onDone, onError }) {
  let response;

  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        stream: true,
        messages,
      }),
    });
  } catch (networkError) {
    onError(networkError);
    return;
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    onError(new Error(`API ${response.status}: ${body?.error?.message ?? "Unknown error"}`));
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";

  try {
    while (true) {
      const { value, done } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep incomplete last line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;

        const payload = trimmed.slice(6);
        if (payload === "[DONE]") {
          onDone(fullContent);
          return;
        }

        let chunk;
        try {
          chunk = JSON.parse(payload);
        } catch {
          continue;
        }

        const token = chunk.choices?.[0]?.delta?.content ?? "";
        if (token) {
          fullContent += token;
          onToken(token);
        }
      }
    }
  } catch (streamError) {
    onError(streamError);
  } finally {
    reader.releaseLock(); // always release the reader when done
  }
}

// --- Wire it up to the DOM ---

const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");
const output = document.getElementById("output");

const conversationHistory = [
  { role: "system", content: "You are a helpful assistant." }
];

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const userMessage = input.value.trim();
  if (!userMessage) return;

  conversationHistory.push({ role: "user", content: userMessage });
  input.value = "";
  output.textContent = ""; // clear previous response

  let assistantMessage = "";

  await streamChat({
    messages: conversationHistory,

    onToken(token) {
      output.textContent += token;
      assistantMessage += token;
    },

    onDone() {
      // Save the full assistant reply to history for future turns
      conversationHistory.push({ role: "assistant", content: assistantMessage });
    },

    onError(error) {
      output.textContent = `Error: ${error.message}`;
      console.error(error);
    },
  });
});
```

---

## Part 6: Aborting a Stream Mid-Way

Sometimes you want to let the user cancel generation (a "Stop" button). Use `AbortController`:

```javascript
let activeController = null;

async function streamChatAbortable(messages, onToken) {
  // Cancel any in-flight request before starting a new one
  if (activeController) {
    activeController.abort();
  }

  activeController = new AbortController();
  const { signal } = activeController;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal, // pass the signal to fetch
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      stream: true,
      messages,
    }),
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const payload = trimmed.slice(6);
        if (payload === "[DONE]") return;

        try {
          const chunk = JSON.parse(payload);
          const token = chunk.choices?.[0]?.delta?.content ?? "";
          if (token) onToken(token);
        } catch {
          continue;
        }
      }
    }
  } catch (error) {
    if (error.name === "AbortError") {
      console.log("Stream cancelled by user.");
    } else {
      throw error;
    }
  } finally {
    reader.releaseLock();
    activeController = null;
  }
}

// Wire up a stop button:
document.getElementById("stop-btn").addEventListener("click", () => {
  if (activeController) {
    activeController.abort();
  }
});
```

When `abort()` is called:
- The `fetch()` rejects with an `AbortError`
- If the reader is mid-read, `reader.read()` also throws an `AbortError`
- You catch it by name and handle it gracefully

---

## Part 7: Using the TransformStream (Advanced)

The Web Streams API also has `TransformStream` — a stream you can pipe data through to transform it. This lets you create a clean pipeline:

```
response.body (ReadableStream of bytes)
  → TextDecoderStream (transform: bytes → strings)
  → your custom parsing transform (transform: raw SSE text → tokens)
```

`TextDecoderStream` is a built-in transform stream that handles decoding for you:

```javascript
async function streamWithPipeline(messages, onToken) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: "gpt-4o", stream: true, messages }),
  });

  // Create a transform stream that parses SSE and extracts tokens
  const sseParser = new TransformStream({
    // `transform` is called for each chunk that flows through
    transform(chunk, controller) {
      const lines = chunk.split("\n");

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;

        const payload = trimmed.slice(6);
        if (payload === "[DONE]") return;

        try {
          const parsed = JSON.parse(payload);
          const token = parsed.choices?.[0]?.delta?.content ?? "";
          if (token) {
            controller.enqueue(token); // pass the token downstream
          }
        } catch {
          // skip malformed lines
        }
      }
    },
  });

  // Pipe: raw bytes → decoded text → parsed tokens
  const tokenStream = response.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(sseParser);

  // Read the final token stream
  const reader = tokenStream.getReader();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    onToken(value); // value is now a clean token string
  }
}
```

This pipeline approach is more composable and reusable than the manual buffer approach, but requires `TextDecoderStream` to be available (it is in all modern browsers and Node.js 18+).

---

## Part 8: Security — Never Expose Your API Key in the Browser

All examples above assume you already have a safe way to use your key. In production:

**Never put `sk-...` keys in client-side JavaScript.** The user can open DevTools and steal it.

Instead, create a thin backend proxy:

```
Browser → Your Server → OpenAI API
```

Your server holds the API key and forwards requests. This also lets you add auth, rate limiting, and logging.

A minimal Node.js proxy (using the built-in `http` module):

```javascript
// server.mjs — run with: node server.mjs
import http from "http";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // set in your shell environment

const server = http.createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/api/chat") {
    res.writeHead(404);
    res.end();
    return;
  }

  // Read the incoming request body
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks).toString();

  // Forward to OpenAI
  const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body, // forward the body as-is
  });

  // Stream the response back to the browser
  res.writeHead(openaiResponse.status, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Access-Control-Allow-Origin": "*",
  });

  for await (const chunk of openaiResponse.body) {
    res.write(chunk);
  }

  res.end();
});

server.listen(3000, () => console.log("Proxy running on http://localhost:3000"));
```

Your browser code then calls `http://localhost:3000/api/chat` instead of OpenAI directly.

---

## Summary: Streaming Mental Model

```
fetch POST (stream: true)
         │
         ▼
response.body          ← ReadableStream of Uint8Array chunks
         │
         │  TextDecoder.decode() or TextDecoderStream
         ▼
raw SSE text           ← strings like "data: {...}\n\ndata: {...}\n\n"
         │
         │  split("\n"), trim, slice("data: "), JSON.parse()
         ▼
delta.content tokens   ← "Hello", " world", "!", ...
         │
         │  onToken callback or DOM update
         ▼
UI updates in real time
```

## Key APIs Used

| API | What It Does |
|---|---|
| `response.body` | The raw ReadableStream of the fetch response |
| `stream.getReader()` | Get a reader to consume the stream |
| `reader.read()` | Read the next chunk; returns `{ value, done }` |
| `reader.releaseLock()` | Release the reader when done (good cleanup) |
| `new TextDecoder()` | Decode `Uint8Array` bytes to a string |
| `new TextDecoderStream()` | Same but as a pipeable TransformStream |
| `new TransformStream({transform})` | Create a custom transform in a pipeline |
| `stream.pipeThrough(transform)` | Pipe a stream through a transform |
| `new AbortController()` | Create a controller to cancel fetch |
| `controller.abort()` | Cancel the fetch/stream |
