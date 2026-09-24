import axios, { AxiosError } from "axios";
import { processMetaLeadCommercial } from "./meta-leads-commercial.service";

const META_GRAPH_VERSION = "v26.0";
const META_LEAD_FIELDS = [
	"id",
	"created_time",
	"field_data",
	"form_id",
	"ad_id",
	"campaign_id",
].join(",");

async function guardarMetadatosMeta(lead: NormalizedMetaLead, fieldNames: string[]) {
	const token = process.env.META_LEADS_PAGE_ACCESS_TOKEN;
	if (!token) return;
	const metadata = async (objectType: "form" | "campaign", id: string | number | null, fields: string) => {
		if (id == null) return null;
		try {
			const response = await axios.get<{ name?: unknown }>(`https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(String(id))}`, { params: { fields, access_token: token }, timeout: 5000 });
			return typeof response.data?.name === "string" ? response.data.name : null;
		} catch (error) {
			const axiosError = axios.isAxiosError(error) ? error : null;
			console.warn("[Meta Leads] Enriquecimiento de nombre fallido", {
				object_type: objectType,
				object_id: String(id),
				status: axiosError?.response?.status ?? null,
				code: axiosError?.code ?? (error instanceof Error ? error.name : "UNKNOWN_ERROR"),
			});
			return null;
		}
	};
	const [formName, campaignName] = await Promise.all([
		metadata("form", lead.form_id, "id,name"),
		metadata("campaign", lead.campaign_id, "id,name"),
	]);
	try {
		await import("../config/database").then(({ default: db }) => db.query(
			`UPDATE crm.meta_leads SET form_name=$3, campaign_id=$4, campaign_name=$5, ad_id=$6, field_names=$7, actualizado_at=now() WHERE empresa_id=2 AND leadgen_id=$1 AND page_id='351160398405043'`,
			[lead.leadgen_id, lead.page_id, formName, lead.campaign_id, campaignName, lead.ad_id, JSON.stringify(fieldNames)]
		));
	} catch (error) {
		console.warn("[Meta Leads] Persistencia de metadatos fallida", {
			status: axios.isAxiosError(error) ? error.response?.status ?? null : null,
			code: error instanceof Error ? error.name : "UNKNOWN_ERROR",
		});
	}
}

type MetaFieldDataItem = {
	field_name?: unknown;
	field?: unknown;
	name?: unknown;
	values?: unknown;
};

type MetaLeadResponse = {
	id?: unknown;
	created_time?: unknown;
	form_id?: unknown;
	field_data?: MetaFieldDataItem[];
	ad_id?: unknown;
	adgroup_id?: unknown;
	campaign_id?: unknown;
};

export type NormalizedMetaLead = {
	leadgen_id: string;
	page_id: string | number | null;
	form_id: string | number | null;
	created_time: string | number | null;
	full_name: string | null;
	company_name: string | null;
	phone_number: string | null;
	state: string | null;
	email: string | null;
	ad_id: string | number | null;
	campaign_id: string | number | null;
};

type MetaLeadEventContext = {
	leadgen_id: string;
	page_id: string | number | null;
	form_id: string | number | null;
	created_time: string | number | null;
};

type MetaLeadQueryResult =
	| { ok: true; lead: NormalizedMetaLead; fieldNames: string[] }
	| { ok: false; reason: MetaLeadErrorReason };

type MetaLeadErrorReason = "missing_token" | "invalid_token" | "not_found" | "network" | "invalid_response";

const asStringOrNumberOrNull = (value: unknown): string | number | null =>
	typeof value === "string" || typeof value === "number" ? value : null;

const asStringOrNull = (value: unknown): string | null =>
	typeof value === "string" ? value : null;

const firstFieldValue = (item: MetaFieldDataItem): string | null => {
	if (!Array.isArray(item.values)) return null;
	const value = item.values[0];
	return typeof value === "string" ? value : null;
};

export function normalizeMetaLead(
	response: MetaLeadResponse,
	context: MetaLeadEventContext
): { lead: NormalizedMetaLead; fieldNames: string[] } {
	const fieldValues = new Map<string, string | null>();
	const fieldNames: string[] = [];

	for (const item of Array.isArray(response.field_data) ? response.field_data : []) {
		const fieldName = item.field_name ?? item.field ?? item.name;
		if (typeof fieldName !== "string") continue;
		fieldNames.push(fieldName);
		fieldValues.set(fieldName, firstFieldValue(item));
	}

	return {
		fieldNames,
		lead: {
			leadgen_id: context.leadgen_id,
			page_id: context.page_id,
			form_id: asStringOrNumberOrNull(response.form_id) ?? context.form_id,
			created_time: asStringOrNumberOrNull(response.created_time) ?? context.created_time,
			full_name: fieldValues.get("full_name") ?? null,
			company_name: fieldValues.get("company_name") ?? null,
			phone_number: fieldValues.get("phone_number") ?? null,
			state: fieldValues.get("state") ?? null,
			email: fieldValues.get("email") ?? null,
			ad_id: asStringOrNumberOrNull(response.ad_id),
			campaign_id: asStringOrNumberOrNull(response.campaign_id),
		},
	};
}

const classifyMetaError = (error: unknown): MetaLeadErrorReason => {
	if (!axios.isAxiosError(error)) return "network";
	const status = error.response?.status;
	if (status === 401 || status === 403) return "invalid_token";
	if (status === 404) return "not_found";
	if (!error.response) return "network";
	return "invalid_response";
};

export async function fetchAndNormalizeMetaLead(context: MetaLeadEventContext): Promise<MetaLeadQueryResult> {
	const accessToken = process.env.META_LEADS_PAGE_ACCESS_TOKEN;
	if (!accessToken) return { ok: false, reason: "missing_token" };

	try {
		const response = await axios.get<MetaLeadResponse>(
			`https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(context.leadgen_id)}`,
			{
				params: { fields: META_LEAD_FIELDS, access_token: accessToken },
				timeout: 10000,
			}
		);

		if (!response.data || typeof response.data !== "object" || typeof response.data.id !== "string") {
			return { ok: false, reason: "invalid_response" };
		}

		const normalized = normalizeMetaLead(response.data, context);
		return { ok: true, ...normalized };
	} catch (error) {
		const reason = classifyMetaError(error);
		const axiosError = error as AxiosError;
		console.error("[Meta Leads Webhook] Error consultando Graph API", {
			leadgen_id: context.leadgen_id,
			reason,
			status: axiosError.response?.status ?? null,
		});
		return { ok: false, reason };
	}
}

export async function processMetaLeadgenEvent(context: MetaLeadEventContext): Promise<void> {
	const result = await fetchAndNormalizeMetaLead(context);

	if (!result.ok) {
		console.error("[Meta Leads Webhook] Consulta de lead fallida", {
			leadgen_id: context.leadgen_id,
			page_id: context.page_id,
			form_id: context.form_id,
			reason: result.reason,
		});
		return;
	}

	console.info("[Meta Leads Webhook] Lead consultado correctamente", {
		leadgen_id: context.leadgen_id,
		page_id: context.page_id,
		form_id: context.form_id,
		field_names: result.fieldNames,
	});
	await guardarMetadatosMeta(result.lead, result.fieldNames);
	await processMetaLeadCommercial({ ...context, lead: result.lead, fieldNames: result.fieldNames });
}
