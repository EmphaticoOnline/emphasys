import app from './app';

const PORT = process.env.PORT || 7001;

app.listen(PORT, () => {
  console.log(`🚀 Emphasys API corriendo en puerto ${PORT}`);
});
