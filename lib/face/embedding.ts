/**
 * Face embedding extraction using face-api.js
 *
 * Generates a 128-dimensional face descriptor (embedding) from a
 * video or canvas element. This embedding is stored in the `employees`
 * table (face_embedding JSONB column) and compared at check-in time.
 *
 * Returns null if no face is detected — caller must handle this case.
 */

import { loadModels, faceapi } from "./faceApi";

export type FaceEmbedding = number[]; // 128-dim Float32Array serialized

/**
 * Standard face-api.js match threshold (face_recognition_model docs).
 * Single source of truth — imported by both enrollment and matching code
 * so they never drift apart.
 */
export const FACE_MATCH_THRESHOLD = 0.6;

/** Number of good-quality frames averaged together at enrollment time. */
export const ENROLLMENT_SAMPLE_COUNT = 5;

/** Minimum face-api.js detector confidence for a frame to count as a sample. */
export const MIN_DETECTION_SCORE = 0.6;

/**
 * Detect a face in the given video element and return its 128-dim embedding.
 * Returns null if no face is found or detection confidence is too low.
 */
export async function getEmbeddingFromVideo(
  video: HTMLVideoElement
): Promise<FaceEmbedding | null> {
  await loadModels();

  const detection = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) return null;

  // Convert Float32Array → regular number[] for JSON serialization
  return Array.from(detection.descriptor);
}

export interface EnrollmentProgress {
  captured: number;
  total: number;
}

/**
 * Capture several good-quality frames from the video and return their raw
 * embeddings. A single enrollment frame is fragile — one bad angle or
 * lighting condition produces a descriptor that drifts far enough from the
 * person's "true" embedding to cause false negatives at check-in. Averaging
 * several confident samples produces a centroid that is far more stable.
 *
 * Returns null if `sampleCount` qualifying frames couldn't be captured.
 */
export async function captureEnrollmentSamples(
  video: HTMLVideoElement,
  sampleCount: number = ENROLLMENT_SAMPLE_COUNT,
  onProgress?: (progress: EnrollmentProgress) => void
): Promise<FaceEmbedding[] | null> {
  await loadModels();

  const samples: FaceEmbedding[] = [];
  const maxAttempts = sampleCount * 8; // give up if the face never stabilizes

  for (let attempt = 0; attempt < maxAttempts && samples.length < sampleCount; attempt++) {
    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (detection && detection.detection.score >= MIN_DETECTION_SCORE) {
      samples.push(Array.from(detection.descriptor));
      onProgress?.({ captured: samples.length, total: sampleCount });
      await new Promise((resolve) => setTimeout(resolve, 300)); // let pose vary slightly between samples
    } else {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  return samples.length === sampleCount ? samples : null;
}

/** Element-wise mean of several embeddings — the enrollment "centroid". */
export function averageEmbeddings(samples: FaceEmbedding[]): FaceEmbedding {
  const dim = samples[0].length;
  const sum = new Array(dim).fill(0);
  for (const sample of samples) {
    for (let i = 0; i < dim; i++) sum[i] += sample[i];
  }
  return sum.map((v) => v / samples.length);
}

/**
 * Euclidean distance between two face embeddings.
 * Used at check-in to compare live face vs. stored enrollment.
 */
export function embeddingDistance(a: FaceEmbedding, b: FaceEmbedding): number {
  if (a.length !== b.length) throw new Error("Embedding dimension mismatch");
  return Math.sqrt(a.reduce((sum, val, i) => sum + (val - b[i]) ** 2, 0));
}

/**
 * Check if two embeddings likely belong to the same person.
 */
export function isSamePerson(
  a: FaceEmbedding,
  b: FaceEmbedding,
  threshold: number = FACE_MATCH_THRESHOLD
): boolean {
  return embeddingDistance(a, b) < threshold;
}
