export function validateWhatsappApiKey(request: Request): boolean {
  const key = request.headers.get('x-api-key');
  return key === process.env.WHATSAPP_API_KEY && !!key;
}
