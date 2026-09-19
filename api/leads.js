import { MongoClient } from "mongodb";

let clientPromise;

function getClient() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("MongoDB no está configurado");
  if (!clientPromise) clientPromise = new MongoClient(uri).connect();
  return clientPromise;
}

function clean(value, max) {
  return String(value || "").trim().slice(0, max);
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Método no permitido" });
  }

  try {
    const nombre = clean(request.body?.nombre, 120);
    const telefono = clean(request.body?.telefono, 25);
    const correo = clean(request.body?.correo, 254).toLowerCase();
    const consentimiento = request.body?.consentimiento === true;
    const digits = telefono.replace(/\D/g, "");

    if (nombre.length < 2) {
      return response.status(400).json({ error: "Ingresa tu nombre y apellido." });
    }
    if (digits.length < 8 || digits.length > 15) {
      return response.status(400).json({ error: "Ingresa un teléfono válido." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return response.status(400).json({ error: "Ingresa un correo electrónico válido." });
    }
    if (!consentimiento) {
      return response.status(400).json({ error: "Debes autorizar el contacto para registrarte." });
    }

    const client = await getClient();
    const databaseName = process.env.MONGODB_DB || process.env.MONGO_DB_NAME || "prohausen";
    const collection = client.db(databaseName).collection("sotavento_leads");
    const now = new Date();

    await collection.updateOne(
      { correo, proyecto: "sotavento-pupuya" },
      {
        $set: { nombre, telefono, consentimiento: true, actualizadoEn: now },
        $setOnInsert: {
          correo,
          proyecto: "sotavento-pupuya",
          fuente: "landing-sotavento",
          creadoEn: now,
          consentimientoEn: now
        }
      },
      { upsert: true }
    );

    return response.status(200).json({ success: true });
  } catch (error) {
    console.error("Error guardando lead de Sotavento", error);
    return response.status(500).json({ error: "No pudimos registrar tus datos. Intenta nuevamente." });
  }
}
