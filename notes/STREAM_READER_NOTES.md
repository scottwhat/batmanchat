# ReadableStream & Stream Reader API

## The Core Mental Model

Think of a normal HTTP response as a **file download** — you wait, then get the whole thing. A stream is more like a **pipe** — data flows through it continuously and you process each piece as it arrives.

```
Normal response:    [========================] → you get it all at once

Streaming:          [chunk]→[chunk]→[chunk]→[chunk] → you process each immediately
```

The browser exposes this pipe via `response.body`, which is a `ReadableStream`. To read from it you get a `Reader` — essentially a cursor that advances through the stream.

---

## The ReadableStream Object

```
response.body  →  ReadableStream
                      │
                  .getReader()
                      │
                  ReadableStreamDefaultReader
                      │
                  .read()  →  Promise<{ value: Uint8Array, done: boolean }>
```

- `value` is a `Uint8Array` (raw bytes) — you decode it to a string with `TextDecoder`
- `done` is `true` when the server closes the connection (`res.end()`)

---

## Minimal Template

```js
async function readStream(url, body) {
  // 1. Make the request — resolves when headers arrive, NOT when body is complete
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  // 2. Get a reader from the response body stream
  const reader = response.body.getReader()

  // 3. TextDecoder converts raw bytes (Uint8Array) → string
  const decoder = new TextDecoder()

  // 4. Read loop — runs until the stream closes
  while (true) {
    const { value, done } = await reader.read()

    if (done) break  // server called res.end()

    // 5. Decode the bytes into a string
    const text = decoder.decode(value, { stream: true })

    console.log(text)  // do something with each chunk
  }
}
```

---

## Parsing SSE Format

The backend writes chunks in SSE format:

```
data: {"token":"Hello"}\n\n
data: {"token":" world"}\n\n
data: [DONE]\n\n
```

One `reader.read()` call may return **one chunk, multiple chunks, or part of a chunk** — the network decides. So you need to parse carefully:

```js
const decoder = new TextDecoder()
let buffer = ''  // accumulate partial chunks

while (true) {
  const { value, done } = await reader.read()
  if (done) break

  buffer += decoder.decode(value, { stream: true })

  // Split on the SSE double-newline delimiter
  const parts = buffer.split('\n\n')

  // The last element may be an incomplete chunk — keep it in the buffer
  buffer = parts.pop()

  for (const part of parts) {
    const line = part.trim()
    if (!line.startsWith('data: ')) continue

    const payload = line.slice(6)  // strip "data: "
    if (payload === '[DONE]') return

    const { token } = JSON.parse(payload)
    console.log(token)  // one token at a time
  }
}
```

The `buffer` pattern is important — without it, if a chunk boundary lands in the middle of a JSON string, `JSON.parse` will throw.

---

## Why `{ stream: true }` on TextDecoder?

```js
decoder.decode(value, { stream: true })
//                      ^^^^^^^^^^^^
```

Without it, the decoder flushes its internal state after each call. Multi-byte characters (like emoji or non-ASCII) can be split across two chunks — `{ stream: true }` tells the decoder to hold incomplete characters until the next call rather than corrupting them.

---

## The Full Lifecycle

```
await fetch(url)         → TCP connection open, headers received, body stream begins
  └─ response.body       → ReadableStream (data is already flowing in)
       └─ .getReader()   → locks the stream to this reader
            └─ .read()   → waits for the next chunk, resolves immediately if one is buffered
                 └─ { value, done }
                      ├─ value: Uint8Array  → decode → parse → update UI
                      └─ done: true         → server closed → exit loop
```

One important nuance: **calling `.getReader()` locks the stream** — you can't have two readers on the same stream simultaneously. To release it you call `reader.cancel()` or let it drain to completion.

---

## Error Handling

```js
const reader = response.body.getReader()

try {
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    // process chunk...
  }
} catch (err) {
  // network dropped mid-stream, server crashed, etc.
  console.error('Stream failed:', err)
} finally {
  reader.releaseLock()  // always release so the stream can be GC'd
}
```

Mid-stream failures are a real concern with AI responses — the OpenAI API can drop the connection if it times out. The `finally` block ensures cleanup regardless.
