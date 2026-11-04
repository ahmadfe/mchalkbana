/** Betalsätt för skolans saldo – egen fil så att den kan användas i webbläsaren */
export const CREDIT_METHOD_LABEL: Record<string, string> = { cash: 'kontant', card: 'kort', swish: 'Swish' };
export const CREDIT_METHODS = ['cash', 'card', 'swish'] as const;
