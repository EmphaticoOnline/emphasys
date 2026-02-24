import 'dotenv/config';
import app from './app';

const PORT = process.env.PORT || 3010;

app.listen(PORT, () => {
  console.log("=== SERVIDOR INICIADO EN ===", new Date().toISOString());
  console.log(`🚀 Emphasys API corriendo en puerto ${PORT}`);
});
