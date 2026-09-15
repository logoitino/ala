export async function createPaymentIntent(amount: number): Promise<string> {
  const response = await fetch('/api/create-payment-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount }),
  });

  const data = (await response.json()) as {
    clientSecret?: string | null;
    error?: string;
  };

  if (!response.ok || !data.clientSecret) {
    throw new Error(data.error ?? 'PaymentIntent did not return a clientSecret.');
  }

  return data.clientSecret;
}
