module.exports = {
    testName: "teacherspayteachers",
    url: "teacherspayteachers.com/Product/FREE-Behavior-Emotional-Regulation-Social-Narrative-2528617",
    pattern: "teacherspayteachers.com/Product/{id}",
    verify: (actual) => {
        if (!actual.title?.includes("FREE Behavior Emotional Regulation Social Narrative by Allison Fors")) {
            throw new Error("Wrong title");
        }
        if (!JSON.stringify(actual).includes('A great way to discuss feelings and appropriate ways to express them')) {
            throw new Error("Content missing information");
        }
    }
}
