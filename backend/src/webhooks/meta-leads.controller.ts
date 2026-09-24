import { Request, Response } from "express";
import { processMetaLeadgenEvent } from "./meta-leads.service";

type MetaLeadgenChange = {
	field?: unknown;
	value?: {
		page_id?: unknown;
		form_id?: unknown;
		leadgen_id?: unknown;
		created_time?: unknown;
	};
};

type MetaWebhookEntry = {
	id?: unknown;
	changes?: MetaLeadgenChange[];
};

const asStringOrNull = (value: unknown): string | number | null =>
	typeof value === "string" || typeof value === "number" ? value : null;

export const verifyMetaLeadsWebhook = (req: Request, res: Response) => {
	const mode = req.query["hub.mode"];
	const verifyToken = req.query["hub.verify_token"];
	const challenge = req.query["hub.challenge"];
	const expectedToken = process.env.META_LEADS_VERIFY_TOKEN;

	if (
		mode === "subscribe" &&
		typeof verifyToken === "string" &&
		typeof challenge === "string" &&
		Boolean(expectedToken) &&
		verifyToken === expectedToken
	) {
		return res.status(200).send(challenge);
	}

	return res.sendStatus(403);
};

export const receiveMetaLeadsWebhook = (req: Request, res: Response) => {
	const body = req.body as { object?: unknown; entry?: MetaWebhookEntry[] };
	const entries = Array.isArray(body?.entry) ? body.entry : [];
	const leadgenEvents = entries.flatMap((entry) => {
		const changes = Array.isArray(entry?.changes) ? entry.changes : [];

		return changes
			.filter((change) => change?.field === "leadgen")
			.map((change) => ({
				page_id: asStringOrNull(change.value?.page_id),
				form_id: asStringOrNull(change.value?.form_id),
				leadgen_id: asStringOrNull(change.value?.leadgen_id),
				created_time: asStringOrNull(change.value?.created_time),
			}));
	});

	console.info("[Meta Leads Webhook] Evento recibido", {
		object: typeof body?.object === "string" ? body.object : null,
		entry_count: entries.length,
		entry_ids: entries.map((entry) => asStringOrNull(entry?.id)).filter((id) => id !== null),
		change_count: entries.reduce(
			(total, entry) => total + (Array.isArray(entry?.changes) ? entry.changes.length : 0),
			0
		),
		leadgen_events: leadgenEvents,
	});

	res.sendStatus(200);

	for (const entry of entries) {
		const changes = Array.isArray(entry?.changes) ? entry.changes : [];
		for (const change of changes) {
			if (change?.field !== "leadgen" || !change.value?.leadgen_id) continue;
			void processMetaLeadgenEvent({
				leadgen_id: String(change.value.leadgen_id),
				page_id: asStringOrNull(change.value.page_id),
				form_id: asStringOrNull(change.value.form_id),
				created_time: asStringOrNull(change.value.created_time),
			}).catch(() => {
				// El error ya se registra de forma segura en el servicio.
			});
		}
	}
};
