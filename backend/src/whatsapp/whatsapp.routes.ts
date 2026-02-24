import { Router } from "express";
import { whatsappWebhook } from "./whatsapp.controller";

const router = Router();

router.post("/webhook", whatsappWebhook);

export default router;