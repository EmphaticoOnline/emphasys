import axios, { AxiosError } from "axios";

const META_GRAPH_VERSION = "v26.0";
const META_LEAD_FIELDS = [
	"id",
	"created_time",
	"field_data",
	"form_id",
	"ad_id",
	"campaign_id",
].join(",");

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
	adgroup_id: string | number | null;
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
			adgroup_id: asStringOrNumberOrNull(response.adgroup_id),
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

async function fetchAndNormalizeMetaLead(context: MetaLeadEventContext): Promise<MetaLeadQueryResult> {
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
}
