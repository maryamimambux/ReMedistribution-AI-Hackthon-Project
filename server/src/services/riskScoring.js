/**
 * Counterfeit Risk Scoring Engine
 *
 * Scores donations on a GREEN / YELLOW / RED risk scale based on:
 * - Batch number format validity
 * - Known manufacturer database
 * - Expiry date plausibility
 * - OCR confidence score
 * - Vision check results
 */

// Known Pakistani pharmaceutical manufacturers
const KNOWN_MANUFACTURERS = [
  'getz pharma', 'sami pharmaceuticals', 'ferozsons laboratories',
  'the searle company', 'abbott laboratories', 'gsk pakistan',
  'martin dow', 'indus pharma', 'highnoon laboratories',
  'siza pharma', 'wilshire laboratories', 'bayer pakistan',
  'ccl pharmaceuticals', 'barrett hodgson', 'herbion pharmex',
  'helix pharmaceuticals', 'brookes pharmaceuticals',
  'pharmevo', 'nexa pharmaceuticals', 'genix pharma',
];

/**
 * Calculate risk score for a donation
 * @param {Object} params - Donation parameters
 * @returns {Object} { level: 'LOW'|'MEDIUM'|'HIGH', confidence: number, notes: string }
 */
function calculateRiskScore({
  batchNumber,
  expiryDate,
  sealIntact,
  ocrConfidence,
  manufacturer,
  visionResult,
}) {
  let score = 0; // 0-100, lower is safer
  const notes = [];

  // 1. Batch number check (0-25 points)
  if (!batchNumber || batchNumber.trim() === '') {
    score += 25;
    notes.push('No batch number provided');
  } else {
    // Typical batch numbers are alphanumeric, 6-15 characters
    const batchPattern = /^[A-Z0-9]{4,15}$/i;
    if (!batchPattern.test(batchNumber)) {
      score += 15;
      notes.push('Batch number format is unusual');
    }
  }

  // 2. Manufacturer check (0-20 points)
  if (!manufacturer || manufacturer.trim() === '') {
    score += 15;
    notes.push('No manufacturer specified');
  } else {
    const isKnown = KNOWN_MANUFACTURERS.some(
      (m) => manufacturer.toLowerCase().includes(m) || m.includes(manufacturer.toLowerCase())
    );
    if (!isKnown) {
      score += 20;
      notes.push('Manufacturer not in known database — verify manually');
    }
  }

  // 3. Expiry date plausibility (0-25 points)
  if (!expiryDate) {
    score += 20;
    notes.push('No expiry date provided');
  } else {
    const expiry = new Date(expiryDate);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry <= 0) {
      score += 25;
      notes.push('Medicine is EXPIRED');
    } else if (daysUntilExpiry <= 30) {
      score += 15;
      notes.push(`Expiring in ${daysUntilExpiry} days`);
    } else if (daysUntilExpiry > 3650) {
      // More than 10 years — suspicious
      score += 10;
      notes.push('Expiry date unusually far in the future');
    }
  }

  // 4. Seal integrity (0-15 points)
  if (sealIntact === false) {
    score += 15;
    notes.push('Seal reported as broken');
  } else if (sealIntact === undefined || sealIntact === null) {
    score += 5;
    notes.push('Seal status not confirmed');
  }

  // 5. OCR confidence (0-15 points)
  if (ocrConfidence > 0 && ocrConfidence < 0.5) {
    score += 15;
    notes.push('Low OCR confidence — label may be unclear');
  } else if (ocrConfidence >= 0.5 && ocrConfidence < 0.75) {
    score += 8;
    notes.push('Moderate OCR confidence');
  }

  // 6. Vision check results (bonus/penalty)
  if (visionResult) {
    if (visionResult.tampered) {
      score += 20;
      notes.push('AI vision detected possible tampering');
    }
    if (visionResult.damaged) {
      score += 10;
      notes.push('AI vision detected packaging damage');
    }
  }

  // Determine risk level
  let level;
  if (score <= 25) {
    level = 'LOW';
  } else if (score <= 50) {
    level = 'MEDIUM';
  } else {
    level = 'HIGH';
  }

  // Confidence in the score itself
  const confidence = Math.min(1, (0.3 + notes.length * 0.1)).toFixed(2);

  return {
    level,
    score,
    confidence: parseFloat(confidence),
    notes: notes.join('. ') || 'All checks passed — low risk',
  };
}

module.exports = { calculateRiskScore };
