/**
 * En móvil, "regresar a la bandeja" es local a LeadsMobileView y no limpia
 * selectedLeadId (ver manuallyBackToInbox). Por eso, al volver a tocar la
 * misma conversación, setSelectedLeadId(id) no cambia el estado: el efecto que
 * carga los mensajes no se vuelve a ejecutar y nunca se registra la lectura.
 * Este caso debe forzar la carga inicial del chat.
 */
export const esReaperturaMismaConversacion = (idTocado: string, idSeleccionado: string | null | undefined) =>
  Boolean(idTocado) && idTocado === idSeleccionado;
