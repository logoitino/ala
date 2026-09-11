export async function requestPayout(input: {
  amountCents: number;
  destinationAccountId?: string;
  description: string;
}): Promise<{ status: string; message: string; id?: string }> {
  const response = await fetch('/api/create-payout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const data = (await response.json()) as {
    status?: string;
    message?: string;
    id?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? 'Payout request failed.');
  }

  return {
    status: data.status ?? 'queued',
    message: data.message ?? 'Queued.',
    id: data.id,
  };
}
