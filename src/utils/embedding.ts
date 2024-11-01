import OpenAI from 'openai';

let _openai = null as any as OpenAI;

function openai() {
  if (!_openai) {
    _openai = new OpenAI(process.env.OPENAI_API_KEY as any);
  }
  return _openai;
}



export async function createEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai().embeddings.create({
      model: "text-embedding-ada-002",
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      throw new Error(`OpenAI API error: ${error.message}`);
    }
    throw error;
  }
}