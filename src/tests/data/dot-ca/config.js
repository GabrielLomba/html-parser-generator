export default {
    testName: "dot.ca",
    url: "dot.ca.gov/caltrans-near-me/district-4/d4-projects/d4-alameda-sr-84-expressway-widening-sr-84-i-680-interchange",
    verify: (actual) => {
        if (!actual.title?.includes("84 Expressway Widening")) {
            throw new Error("Wrong title");
        }
        if (actual.content && !JSON.stringify(actual.content).includes('Widen SR 84 to a 4-lane expressway')) {
            throw new Error("Content missing information");
        }
    }
}
