import { encoding_for_model, TiktokenModel } from 'tiktoken';

export function countTokens(text: string, model: TiktokenModel): number {
    try {
        const encoding = encoding_for_model(model);
        const tokens = encoding.encode(text);
        return tokens.length;
    } catch {
        try {
            const encoding = encoding_for_model('gpt-3.5-turbo');
            const tokens = encoding.encode(text);
            return tokens.length;
        } catch {
            return Math.ceil(text.length / 4);
        }
    }
}

export function countRequestTokens(
    messages: Array<{ role: string; content: string }>,
    model: TiktokenModel
): number {
    let totalTokens = 0;

    for (const message of messages) {
        totalTokens += 4; // Every message follows <|start|>{role/name}\n{content}<|end|>
        totalTokens += countTokens(message.role, model);
        totalTokens += countTokens(message.content, model);
    }

    totalTokens += 2; // <|start|>assistant\n

    return totalTokens;
}
