# Wiring up ChatInput → Backend Stream

## The problem
`Chatinput` and `Chatoutput` are siblings inside `ChatContainer`.
Siblings can't share state directly — state must live in the parent and be passed down as props.

```
ChatContainer        ← state lives here
├── Chatoutput       ← receives messages + streamingMessage as props
└── Chatinput        ← receives onSend callback as prop
```

---

## Step 1 — Add props to `Chatinput`

Define a Props interface and accept `onSend` as a prop.
Wire up `onKeyDown` on the textarea so pressing Enter calls it.
Also add `value={inputText}` so you can clear the field after sending.

```tsx
interface Props {
  onSend: (text: string) => void
}

const Chatinput = ({ onSend }: Props) => {
  const [inputText, setInputText] = useState('')

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (inputText.trim()) {
        onSend(inputText.trim())
        setInputText('')           // clear after send
      }
    }
  }

  return (
    <div className="input-container">
      <span className="prompt-symbol">{'>'}</span>
      <textarea
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        onKeyDown={handleKeyDown}
        className="terminal-input"
        placeholder="Ask Alfred..."
        rows={1}
      />
      <span className="send-hint">enter ↵</span>
    </div>
  )
}
```

> `!e.shiftKey` lets the user press Shift+Enter for a newline without sending.

---

## Step 2 — Add props to `Chatoutput`

Remove the local `useState` with dummy messages.
Accept `messages` and `streamingMessage` from the parent instead.

```tsx
import type { Message } from "../../types"

interface Props {
  messages: Message[]
  streamingMessage: string
}

const Chatoutput = ({ messages, streamingMessage }: Props) => {
  return (
    <div className="chat-output">
      {messages.map((msg) => (
        <div key={msg.id} className={`message ${msg.role}`}>
          {msg.content}
        </div>
      ))}

      {streamingMessage && (
        <div className="message assistant streaming">
          {streamingMessage}
        </div>
      )}
    </div>
  )
}
```

---

## Step 3 — Lift state into `ChatContainer` + write `sendMessage`

Replace the unused `messageState` with real state.
Write the `sendMessage` function that:
1. Adds the user message immediately
2. POSTs to the backend
3. Reads the SSE stream token by token
4. Moves the completed reply into `messages` when done

```tsx
import type { Message } from '../../types'

const ChatContainer = () => {
  const [messages, setMessages] = useState<Message[]>([])
  const [streamingMessage, setStreamingMessage] = useState('')

  const sendMessage = async (text: string) => {
    // 1. Show user message immediately
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setStreamingMessage('')

    // 2. Hit the backend
    const response = await fetch('http://localhost:3000/api/chat/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    })

    // 3. Read the SSE stream
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let fullText = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const lines = decoder.decode(value).split('\n')
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6)
        if (data === '[DONE]') break
        const { token } = JSON.parse(data)
        fullText += token
        setStreamingMessage(fullText)   // re-render on every token
      }
    }

    // 4. Commit the full reply, clear streaming bubble
    const assistantMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: fullText }
    setMessages(prev => [...prev, assistantMsg])
    setStreamingMessage('')
  }

  return (
    <div className="container">
      <div className="left-container">
        <ChatSideBar />
      </div>
      <div className="right-container">
        <Chatoutput messages={messages} streamingMessage={streamingMessage} />
        <Chatinput onSend={sendMessage} />
      </div>
    </div>
  )
}
```

---

## How SSE reading works

The backend sends:
```
data: {"token":"My"}\n\n
data: {"token":" greatest"}\n\n
data: [DONE]\n\n
```

`fetch` gives you a `ReadableStream`. You get a `reader` from it and loop with `reader.read()` until `done`. Each chunk is raw bytes — `TextDecoder` turns it into a string, then you split on `\n` and parse each `data:` line.

The `streamingMessage` state holds the growing reply and renders live. When `[DONE]` arrives, the full string gets pushed into `messages` and `streamingMessage` is cleared.
