export class Stats {
    private totalInputTokens = 0;
    private totalOutputTokens = 0;
    private totalRequests = 0;

    addRequest(inputTokens: number, outputTokens: number): void {
        this.totalInputTokens += inputTokens;
        this.totalOutputTokens += outputTokens;
        this.totalRequests++;
    }

    getAverageInputTokens(): number {
        return this.totalRequests > 0 ? Math.round(this.totalInputTokens / this.totalRequests) : 0;
    }

    getAverageOutputTokens(): number {
        return this.totalRequests > 0 ? Math.round(this.totalOutputTokens / this.totalRequests) : 0;
    }

    getCostEstimate(): { inputCost: number; outputCost: number; totalCost: number } {
        const inputCost = (this.totalInputTokens * 0.03) / 1000;
        const outputCost = (this.totalOutputTokens * 0.06) / 1000;
        return {
            inputCost: Math.round(inputCost * 1000000) / 1000000,
            outputCost: Math.round(outputCost * 1000000) / 1000000,
            totalCost: Math.round((inputCost + outputCost) * 1000000) / 1000000,
        };
    }

    getStats() {
        return {
            totalRequests: this.totalRequests,
            averageInputTokens: this.getAverageInputTokens(),
            averageOutputTokens: this.getAverageOutputTokens(),
            costEstimate: this.getCostEstimate(),
        };
    }
}
