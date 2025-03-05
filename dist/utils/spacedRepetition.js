"use strict";
/**
 * Spaced Repetition System (SRS) based on SuperMemo 2 Algorithm
 * Quality ratings:
 * 5 - Perfect response
 * 4 - Correct response after a hesitation
 * 3 - Correct response with serious difficulty
 * 2 - Incorrect response; easy mistake
 * 1 - Incorrect response; difficult material
 * 0 - Complete blackout
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateNextReview = calculateNextReview;
exports.initializeCard = initializeCard;
exports.isDue = isDue;
exports.calculateProgress = calculateProgress;
function calculateNextReview(quality, previousInterval, previousEaseFactor, repetitions) {
    // Ensure quality is between 0 and 5
    quality = Math.min(5, Math.max(0, quality));
    let easeFactor = previousEaseFactor;
    let interval = previousInterval;
    let status = 'learning';
    // Calculate new ease factor
    easeFactor = previousEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    // Ensure ease factor doesn't go below 1.3
    easeFactor = Math.max(1.3, easeFactor);
    // Calculate next interval based on quality
    if (quality < 3) {
        // If response was poor, reset interval to 1 day
        interval = 1;
        status = 'learning';
    }
    else {
        if (previousInterval === 0) {
            interval = 1;
        }
        else if (previousInterval === 1) {
            interval = 6;
        }
        else {
            interval = Math.round(previousInterval * easeFactor);
        }
        // Cap maximum interval at 365 days
        interval = Math.min(365, interval);
        // Determine status based on interval
        if (interval >= 21) {
            status = 'mastered';
        }
    }
    // Calculate next review date
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);
    return {
        interval,
        easeFactor,
        nextReview,
        status,
    };
}
/**
 * Initialize a new card's spaced repetition values
 */
function initializeCard() {
    return {
        interval: 0,
        easeFactor: 2.5,
        nextReview: new Date(),
    };
}
/**
 * Get cards due for review
 * @param lastReviewed - When the card was last reviewed
 * @param nextReview - When the card is scheduled for next review
 */
function isDue(lastReviewed, nextReview) {
    const now = new Date();
    return !lastReviewed || nextReview <= now;
}
/**
 * Calculate study progress statistics
 * @param totalCards - Total number of cards in the deck
 * @param masteredCards - Number of mastered cards
 * @param learningCards - Number of cards in learning
 */
function calculateProgress(totalCards, masteredCards, learningCards) {
    return {
        mastered: masteredCards,
        learning: learningCards,
        new: totalCards - (masteredCards + learningCards),
    };
}
//# sourceMappingURL=spacedRepetition.js.map