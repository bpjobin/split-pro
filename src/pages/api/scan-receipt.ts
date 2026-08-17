import { type NextApiRequest, type NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/server/auth';
import { env } from '~/env';
import fs from 'node:fs/promises';
import path from 'node:path';

const UPLOAD_DIR = './uploads';

interface ScannedItem {
  name: string;
  amount: number;
}

async function scanReceiptWithAI(imageBase64: string): Promise<ScannedItem[]> {
  if (!env.AI_BASE_URL || !env.AI_API_KEY) {
    throw new Error('AI service not configured');
  }

  const response = await fetch(`${env.AI_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.AI_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this receipt image. Extract all line items with their names and amounts (in the smallest currency unit, e.g., cents for CAD/USD).
Return ONLY a JSON array with objects having "name" (string) and "amount" (number in cents) properties.
Do not include tax lines, tips, or totals as separate items.
If an item quantity is greater than 1, include it as a single line with the total for that item.
Example: [{"name": "Milk", "amount": 499}, {"name": "Bread", "amount": 349}]`,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/webp;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI request failed: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };

  const content = data.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No content in AI response');
  }

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = content.match(/\[[\s\S]*?\]/);
  if (!jsonMatch) {
    throw new Error('No JSON array found in AI response');
  }

  const items = JSON.parse(jsonMatch[0]) as unknown[];

  // Validate and sanitize
  return items
    .filter(
      (item): item is ScannedItem =>
        typeof item === 'object' &&
        item !== null &&
        'name' in item &&
        'amount' in item &&
        typeof (item as ScannedItem).name === 'string' &&
        typeof (item as ScannedItem).amount === 'number',
    )
    .map((item) => ({
      name: item.name.trim(),
      amount: Math.round(item.amount),
    }));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!env.AI_ENABLED) {
    return res.status(400).json({ error: 'AI receipt scanning is not enabled' });
  }

  const { fileKey } = req.body as { fileKey?: string };
  if (!fileKey) {
    return res.status(400).json({ error: 'fileKey is required' });
  }

  // Verify the file belongs to the user
  if (!fileKey.startsWith(`${session.user.id}/`)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const filePath = path.join(UPLOAD_DIR, fileKey);
    const imageBuffer = await fs.readFile(filePath);
    const imageBase64 = imageBuffer.toString('base64');

    const items = await scanReceiptWithAI(imageBase64);

    return res.status(200).json({ items });
  } catch (error) {
    console.error('Receipt scan error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to scan receipt',
    });
  }
}
