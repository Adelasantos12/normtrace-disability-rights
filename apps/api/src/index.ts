import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/analyses', (req, res) => {
  // Placeholder for triggering analysis workflow via Gemini
  res.status(202).json({ message: 'Analysis queued' });
});

app.get('/api/analyses', (req, res) => {
  // Placeholder for listing analyses
  res.status(200).json({ analyses: [] });
});

app.get('/api/analyses/:id', (req, res) => {
  // Placeholder for retrieving a specific analysis run
  res.status(200).json({ analysis: { id: req.params.id } });
});

app.listen(port, () => {
  console.log(`API server listening on port ${port}`);
});
