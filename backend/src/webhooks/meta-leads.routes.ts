import { Router } from "express";
import { receiveMetaLeadsWebhook, verifyMetaLeadsWebhook } from "./meta-leads.controller";

const router = Router();

router.get("/meta-leads", verifyMetaLeadsWebhook);
router.post("/meta-leads", receiveMetaLeadsWebhook);

export default router;
