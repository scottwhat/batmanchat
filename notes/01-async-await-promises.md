# Async/Await & Promises in Vanilla JavaScript

## Why This Exists: The Problem With Synchronous Code

JavaScript runs one line at a time. When you ask a server for data, that server might take 2 seconds to respond. If JS just _waited_ there, your entire page would freeze. Async code lets JS say "go do this, and tell me when you're done" — then keep running other code in the meantime.

---

## Part 1: Promises

A **Promise** is an object that represents a value that doesn't exist yet, but will either:
- **resolve** (succeed) with a value, or
- **reject** (fail) with an error

Think of it like ordering food at a restaurant. You get a ticket (the promise). You don't have the food yet, but you will — or the kitchen will tell you they're out of it.

### The Three States of a Promise

```
pending  →  fulfilled (resolved with a value)
         →  rejected  (failed with a reason)
```

Once a promise moves out of `pending`, it can never change state again.

### Creating a Promise by Hand

```javascript
const myPromise = new Promise((resolve, reject) => {
  const success = true; // imagine this is some real operation

  if (success) {
    resolve("Here is your data!");
  } else {
    reject(new Error("Something went wrong."));
  }
});
```

The function you pass to `new Promise(...)` is called the **executor**. It runs immediately and synchronously. `resolve` and `reject` are functions you call when you're done.

### Consuming a Promise with `.then()` and `.catch()`

```javascript
myPromise
  .then((value) => {
    console.log(value); // "Here is your data!"
  })
  .catch((error) => {
    console.error(error.message);
  })
  .finally(() => {
    console.log("This always runs, success or failure.");
  });
```

- `.then(fn)` — runs when the promise resolves. Receives the resolved value.
- `.catch(fn)` — runs when the promise rejects. Receives the error.
- `.finally(fn)` — runs either way. Good for cleanup (hiding a loading spinner, etc.).

### Promise Chaining

Every `.then()` returns a new promise. This lets you chain operations in sequence:

```javascript
fetch("https://api.example.com/user")
  .then((response) => response.json())   // returns another promise
  .then((data) => {
    console.log(data.name);              // data is the parsed object
    return data.id;                      // pass a value to the next .then()
  })
  .then((id) => {
    console.log("User ID:", id);
  })
  .catch((err) => console.error(err));
```

If any `.then()` throws or a promise rejects, execution jumps to the nearest `.catch()`.

---

## Part 2: Async/Await

`async`/`await` is syntax sugar over promises. It makes async code look and read like synchronous code. Under the hood, it's still promises.

### The `async` Keyword

Putting `async` before a function declaration does two things:
1. It makes the function always return a promise.
2. It allows you to use `await` inside it.

```javascript
async function greet() {
  return "Hello!";
}

greet().then(console.log); // "Hello!"
// greet() returns Promise<"Hello!">, not "Hello!" directly
```

### The `await` Keyword

`await` pauses execution _inside the async function_ until the promise resolves. It then returns the resolved value directly, without needing `.then()`.

```javascript
async function fetchUser() {
  const response = await fetch("https://api.example.com/user"); // waits here
  const data = await response.json();                           // waits here
  console.log(data.name);
}
```

This is equivalent to the `.then()` chain above, but much easier to read.

### Error Handling with try/catch

Because `await` unwraps the promise value, you use standard `try/catch` for errors:

```javascript
async function fetchUser() {
  try {
    const response = await fetch("https://api.example.com/user");

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error("Failed to fetch user:", error.message);
  }
}
```

**Important:** `fetch()` only rejects on network failure (no internet, DNS error, etc.). A `404` or `500` from the server is still a _resolved_ fetch — you have to manually check `response.ok`.

---

## Part 3: The Event Loop (Mental Model)

Understanding _why_ async works requires understanding the event loop:

```
Call Stack          Web APIs          Callback Queue
-----------         ----------        ---------------
fetchUser()  →      fetch(url)
                    ...waiting...
                    (fetch completes) → [queue the .then callback]

Call Stack is empty → picks up callback from queue → runs it
```

1. Your `async` function runs until it hits an `await`.
2. The awaited promise is handed off to the browser's Web APIs.
3. JS continues running other code (the call stack moves on).
4. When the promise resolves, the rest of your `async` function is queued as a microtask and runs next.

This is why you can't just "pause" and get a value — the mechanism is always callback-based internally.

---

## Part 4: Parallel vs Sequential

### Sequential (one after another)

```javascript
async function sequential() {
  const a = await fetchA(); // waits for A to finish
  const b = await fetchB(); // only then starts B
}
```

Total time = time(A) + time(B)

### Parallel (both at once)

```javascript
async function parallel() {
  const [a, b] = await Promise.all([fetchA(), fetchB()]);
}
```

`Promise.all()` takes an array of promises and resolves when **all of them** resolve. If any rejects, the whole thing rejects immediately.

Total time = max(time(A), time(B))

### Other Useful Promise Combinators

| Method | Resolves when | Rejects when |
|---|---|---|
| `Promise.all(arr)` | All resolve | Any rejects |
| `Promise.allSettled(arr)` | All settle (either way) | Never |
| `Promise.race(arr)` | First settles (any state) | First settles with rejection |
| `Promise.any(arr)` | First resolves | All reject |

---

## Part 5: Calling the OpenAI API

Now let's apply everything above to make a real API call to OpenAI's Chat Completions endpoint.

### What the API Expects

OpenAI's `/v1/chat/completions` endpoint:
- **Method:** `POST`
- **Headers:** `Content-Type: application/json` and `Authorization: Bearer YOUR_API_KEY`
- **Body:** A JSON object with a model name and an array of messages

### Basic API Call (No Streaming)

```javascript
const OPENAI_API_KEY = "sk-..."; // Never hard-code this in real projects

async function askChatGPT(userMessage) {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant.",
          },
          {
            role: "user",
            content: userMessage,
          },
        ],
      }),
    });

    // fetch() resolves when headers arrive, NOT when the full body is read.
    // We must check status before reading the body.
    if (!response.ok) {
      const errorBody = await response.json();
      throw new Error(`OpenAI API error ${response.status}: ${errorBody.error.message}`);
    }

    const data = await response.json(); // reads and parses the full response body

    // The actual reply text lives here:
    const reply = data.choices[0].message.content;
    return reply;

  } catch (error) {
    console.error("Request failed:", error.message);
    throw error; // re-throw so the caller can handle it too
  }
}

// Using it:
askChatGPT("What is the capital of France?").then((reply) => {
  console.log("GPT says:", reply);
});
```

### Anatomy of the Response Object

When `response.json()` resolves, `data` looks like this:

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1714000000,
  "model": "gpt-4o",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "The capital of France is Paris."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 20,
    "completion_tokens": 9,
    "total_tokens": 29
  }
}
```

Key paths:
- `data.choices[0].message.content` → the text reply
- `data.choices[0].finish_reason` → why generation stopped (`"stop"`, `"length"`, etc.)
- `data.usage.total_tokens` → how many tokens were used (affects billing)

### Multi-Turn Conversation

The OpenAI API is **stateless** — it remembers nothing between calls. To have a real conversation, you must send the full history of messages every time:

```javascript
const conversationHistory = [
  { role: "system", content: "You are a helpful assistant." }
];

async function chat(userMessage) {
  // Add the user's new message to history
  conversationHistory.push({ role: "user", content: userMessage });

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: conversationHistory, // send the whole history
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  const assistantReply = data.choices[0].message.content;

  // Add assistant's reply to history for the next turn
  conversationHistory.push({ role: "assistant", content: assistantReply });

  return assistantReply;
}

// Example usage:
(async () => {
  const r1 = await chat("My name is Alex.");
  console.log("GPT:", r1);

  const r2 = await chat("What's my name?");
  console.log("GPT:", r2); // GPT will correctly say "Alex"
})();
```

---

## Part 6: Key Concepts to Cement

### `await` only works inside `async` functions

```javascript
// This will throw a SyntaxError:
const data = await fetch(url); // ❌ can't use await at the top level outside a module

// Fix 1: wrap in async function
async function run() {
  const data = await fetch(url); // ✅
}

// Fix 2: use top-level await (only works in ES modules — .mjs files or type="module")
const data = await fetch(url); // ✅ inside a <script type="module">
```

### Async functions always return promises

```javascript
async function add(a, b) {
  return a + b;
}

// Even though there's no fetch here, the return value is still a Promise:
add(2, 3).then(console.log); // 5
```

### You can `await` any value (not just promises)

```javascript
const x = await 42; // x === 42, immediately resolves
```

It just wraps non-promise values in `Promise.resolve()`. Not useful in practice, but important to know it won't break.

---

## Summary

| Concept | What It Does |
|---|---|
| `new Promise(fn)` | Create a promise manually |
| `.then(fn)` | Handle resolved value |
| `.catch(fn)` | Handle rejection |
| `async function` | Function that always returns a promise |
| `await expr` | Pause until promise resolves, return value |
| `try/catch` | Error handling inside async functions |
| `Promise.all()` | Run promises in parallel, wait for all |
| `response.ok` | Check if HTTP status is 200–299 |
| `response.json()` | Parse JSON body (returns a promise) |

---

## Next Steps

Read `02-streaming-with-readable-streams.md` to learn how to stream OpenAI responses token by token as they arrive, instead of waiting for the full reply.
