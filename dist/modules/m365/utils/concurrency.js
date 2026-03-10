"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapWithConcurrency = mapWithConcurrency;
async function mapWithConcurrency(items, limit, mapper) {
    if (items.length === 0) {
        return [];
    }
    const results = new Array(items.length);
    const workerCount = Math.max(1, Math.min(limit, items.length));
    let nextIndex = 0;
    async function worker() {
        while (true) {
            const currentIndex = nextIndex;
            nextIndex += 1;
            if (currentIndex >= items.length) {
                return;
            }
            results[currentIndex] = await mapper(items[currentIndex], currentIndex);
        }
    }
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
}
