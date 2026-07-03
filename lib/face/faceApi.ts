/**
 * face-api.js model loader
 *
 * Loads required models from /public/models/ directory.
 * Models must be placed there manually (see setup instructions below).
 *
 * Required model files in /public/models/:
 *   - tiny_face_detector_model-weights_manifest.json + shard files
 *   - face_landmark_68_model-weights_manifest.json  + shard files
 *   - face_recognition_model-weights_manifest.json  + shard files
 *
 * Download from:
 *   https://github.com/justadudewhohacks/face-api.js/tree/master/weights
 */

import * as faceapi from "face-api.js";

let modelsLoaded = false;

export async function loadModels(): Promise<void> {
  if (modelsLoaded) return;

  const MODEL_URL = "/models";

  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);

  modelsLoaded = true;
}

export { faceapi };
