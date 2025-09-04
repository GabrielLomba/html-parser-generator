export default {
    testName: "Wikipedia Prometheus Page",
    url: "https://en.wikipedia.org/wiki/Prometheus",
    verify: (actual) => {
        if (!actual.title?.includes("Prometheus")) {
            throw new Error("Title is not Prometheus");
        }
        if (actual.content && !JSON.stringify(actual.content).includes('Greek')) {
            throw new Error("Content missing information");
        }
    }
}
