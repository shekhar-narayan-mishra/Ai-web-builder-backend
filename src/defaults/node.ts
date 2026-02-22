export const basePrompt = `<boltArtifact id=\"project-import\" title=\"Project Files\">
<boltAction type=\"file\" filePath=\"package.json\">{\"name\":\"node-app\",\"type\":\"module\",\"dependencies\":{\"express\":\"^4.18.2\"}}</boltAction>
<boltAction type=\"file\" filePath=\"index.js\">import express from 'express';\nconst app = express();\napp.get('/', (req, res) => res.send('Ready'));\napp.listen(3000);</boltAction>
</boltArtifact>`;
