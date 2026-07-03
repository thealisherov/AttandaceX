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

/**
 * Euclidean distance between two face embeddings.
 * Used at check-in to compare live face vs. stored enrollment.
 * Typical match threshold: < 0.6
 */
export function embeddingDistance(a: FaceEmbedding, b: FaceEmbedding): number {
  if (a.length !== b.length) throw new Error("Embedding dimension mismatch");
  return Math.sqrt(a.reduce((sum, val, i) => sum + (val - b[i]) ** 2, 0));
}

/**
 * Check if two embeddings likely belong to the same person.
 * Threshold 0.55 is conservative (lower = stricter).
 */
export function isSamePerson(
  a: FaceEmbedding,
  b: FaceEmbedding,
  threshold = 0.55
): boolean {
  return embeddingDistance(a, b) < threshold;
}
