export const basePrompt = `<boltArtifact id=\"project-import\" title=\"Project Files\">
<boltAction type=\"file\" filePath=\"index.html\"><!doctype html><html><body><div id=\"root\"></div><script type=\"module\" src=\"/src/main.tsx\"></script></body></html></boltAction>
<boltAction type=\"file\" filePath=\"package.json\">{\"dependencies\":{\"react\":\"^18.3.1\",\"react-dom\":\"^18.3.1\"}}</boltAction>
<boltAction type=\"file\" filePath=\"src/App.tsx\">import React from 'react';\nfunction App() { return <h1>Ready to Build</h1>; }\nexport default App;</boltAction>
<boltAction type=\"file\" filePath=\"src/main.tsx\">import { createRoot } from 'react-dom/client';\nimport App from './App.tsx';\ncreateRoot(document.getElementById('root')!).render(<App />);</boltAction>
</boltArtifact>`;